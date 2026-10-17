import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';

import { theme } from '../theme';

/**
 * The assistant's face: a friendly Telugu farmer (white shirt, green-and-white checked kanduva).
 *
 * 28 hand-drawn frames (assets/avatar), sequenced per state and cross-faded so changes never look abrupt:
 * - idle: smiling base with natural micro-events — blinks, a gentle smile, looking around, a friendly nod
 * - listening: attentive base, with curious / understanding / nodding reactions while the farmer speaks
 * - thinking: looking up → hand on chin → "hmm" → slight frown while the AI works; "eureka" as the answer arrives
 * - speaking: mouth cycles closed → small → medium → wide (+ smiling talk), with occasional explaining /
 *   happy-talk gestures, and a "finish" frame when the audio ends
 * - finished: a short reaction (`mood`: happy / agree / confused / surprised / concerned), then idle
 *
 * Only the frames the current state can use are mounted (≤ 10 of 384 px JPEG), each with its own native-driver
 * opacity. Built-in Animated only — no extra dependencies, light on low-end Android.
 */
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'finished';
export type AvatarMood = 'happy' | 'agree' | 'confused' | 'surprised' | 'concerned';

const FRAMES = {
  idle_01: require('../../assets/avatar/idle_01.jpg'), // smiling (base)
  idle_02: require('../../assets/avatar/idle_02.jpg'), // gentle smile
  idle_03: require('../../assets/avatar/idle_03.jpg'), // soft blink
  idle_04: require('../../assets/avatar/idle_04.jpg'), // looking around
  idle_05: require('../../assets/avatar/idle_05.jpg'), // friendly nod
  listen_01: require('../../assets/avatar/listen_01.jpg'), // attentive (base)
  listen_02: require('../../assets/avatar/listen_02.jpg'), // curious
  listen_03: require('../../assets/avatar/listen_03.jpg'), // understanding
  listen_04: require('../../assets/avatar/listen_04.jpg'), // surprised
  listen_05: require('../../assets/avatar/listen_05.jpg'), // nodding
  talk_01: require('../../assets/avatar/talk_01.jpg'), // mouth closed
  talk_02: require('../../assets/avatar/talk_02.jpg'), // mouth open small
  talk_03: require('../../assets/avatar/talk_03.jpg'), // mouth open medium
  talk_04: require('../../assets/avatar/talk_04.jpg'), // mouth open wide
  talk_05: require('../../assets/avatar/talk_05.jpg'), // smiling talk
  talk_06: require('../../assets/avatar/talk_06.jpg'), // explaining (gesture)
  talk_07: require('../../assets/avatar/talk_07.jpg'), // happy talk (gesture)
  talk_08: require('../../assets/avatar/talk_08.jpg'), // finish / close
  think_01: require('../../assets/avatar/think_01.jpg'), // looking up
  think_02: require('../../assets/avatar/think_02.jpg'), // hand on chin
  think_03: require('../../assets/avatar/think_03.jpg'), // slight frown
  think_04: require('../../assets/avatar/think_04.jpg'), // hmm
  think_05: require('../../assets/avatar/think_05.jpg'), // eureka / idea
  happy: require('../../assets/avatar/happy.jpg'),
  agree: require('../../assets/avatar/agree.jpg'),
  confused: require('../../assets/avatar/confused.jpg'),
  surprised: require('../../assets/avatar/surprised.jpg'),
  concerned: require('../../assets/avatar/concerned.jpg'),
};
type Frame = keyof typeof FRAMES;

/** Frames each state can show — only these are mounted, to keep decoded-bitmap memory small. */
const STATE_FRAMES: Record<AvatarState, Frame[]> = {
  idle: ['idle_01', 'idle_02', 'idle_03', 'idle_04', 'idle_05'],
  listening: ['listen_01', 'listen_02', 'listen_03', 'listen_04', 'listen_05'],
  thinking: ['think_01', 'think_02', 'think_03', 'think_04', 'think_05'],
  speaking: ['talk_01', 'talk_02', 'talk_03', 'talk_04', 'talk_05', 'talk_06', 'talk_07', 'talk_08'],
  finished: ['talk_08', 'happy', 'agree', 'confused', 'surprised', 'concerned', 'idle_01'],
};

/** Cross-fade length: quick for the mouth, softer for expression changes. */
const FADE_MS = { mouth: 60, expression: 200 };
const FINISHED_MS = 1500;

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const between = (min: number, max: number) => min + Math.random() * (max - min);

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

export function FarmerAvatar({
  state,
  size = 140,
  mood = 'agree',
  onPress,
  disabled,
  accessibilityLabel,
}: {
  state: AvatarState;
  size?: number;
  /** Reaction shown when an answer finishes (e.g. 'concerned' for a crop problem, 'confused' if nothing was heard). */
  mood?: AvatarMood;
  /** Makes the avatar the voice button (tap to talk / tap again to send). */
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const reduceMotion = useReduceMotion();

  // "finished" is also entered automatically when speaking stops; "eureka" bridges thinking → speaking.
  const [shown, setShown] = useState<AvatarState>(state);
  const prev = useRef(state);
  useEffect(() => {
    const was = prev.current;
    prev.current = state;
    if (state === 'idle' && was === 'speaking') {
      setShown('finished');
      const t = setTimeout(() => setShown('idle'), FINISHED_MS);
      return () => clearTimeout(t);
    }
    setShown(state);
    if (state === 'finished') {
      const t = setTimeout(() => setShown('idle'), FINISHED_MS);
      return () => clearTimeout(t);
    }
  }, [state]);

  // A reaction shown while idle, when the mood changes (e.g. an error → concerned / confused).
  const [reaction, setReaction] = useState<AvatarMood | null>(null);
  const lastMood = useRef(mood);
  useEffect(() => {
    if (mood === lastMood.current) return;
    lastMood.current = mood;
    if (mood === 'confused' || mood === 'concerned' || mood === 'surprised') {
      setReaction(mood);
      const t = setTimeout(() => setReaction(null), 1800);
      return () => clearTimeout(t);
    }
  }, [mood]);

  // ---- Frame sequencer: which frame is on screen, and how fast to fade to it.
  const [frame, setFrame] = useState<{ name: Frame; prev: Frame; fade: number }>({ name: 'idle_01', prev: 'idle_01', fade: 0 });
  const show = (name: Frame, fade = FADE_MS.expression) =>
    setFrame((f) => (f.name === name ? f : { name, prev: f.name, fade }));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = (fn: () => void, ms: number) => {
      timer = setTimeout(fn, ms);
    };

    if (shown === 'idle' && reaction) {
      show(reaction);
      return;
    }

    if (shown === 'listening') {
      show('listen_01');
      if (!reduceMotion) {
        // Attentive base, reacting now and then: understanding, nodding, curious.
        const react = () =>
          later(() => {
            show(pick<Frame>(['listen_03', 'listen_05', 'listen_03', 'listen_02']));
            later(() => {
              show('listen_01');
              react();
            }, between(700, 1100));
          }, between(1200, 2000));
        react();
      }
    } else if (shown === 'thinking') {
      // looking up → hand on chin → hmm → slight frown, looping while the AI works
      const seq: Frame[] = ['think_01', 'think_02', 'think_04', 'think_03'];
      let i = 0;
      show(seq[0]);
      if (!reduceMotion) {
        const step = () =>
          later(() => {
            i = (i + 1) % seq.length;
            show(seq[i]);
            step();
          }, between(900, 1300));
        step();
      }
    } else if (shown === 'speaking') {
      if (reduceMotion) {
        show('talk_05');
      } else {
        // Brief "eureka" if we were thinking, then the mouth: closed → small → medium → wide, irregular like
        // syllables, with a smiling-talk frame mixed in and an occasional explaining / happy-talk gesture.
        const mouth: Frame[] = ['talk_02', 'talk_03', 'talk_04', 'talk_03', 'talk_02', 'talk_01', 'talk_05', 'talk_03', 'talk_01'];
        let i = 0;
        let sinceGesture = 0;
        const talk = () => {
          if (sinceGesture > between(2800, 4200)) {
            sinceGesture = 0;
            show(pick<Frame>(['talk_06', 'talk_07']), FADE_MS.expression);
            later(talk, between(550, 750));
            return;
          }
          i = (i + 1 + (Math.random() < 0.3 ? 1 : 0)) % mouth.length;
          show(mouth[i], FADE_MS.mouth);
          const ms = between(95, 190);
          sinceGesture += ms;
          later(talk, ms);
        };
        if (frame.name.startsWith('think_')) {
          show('think_05');
          later(talk, 420);
        } else {
          talk();
        }
      }
    } else if (shown === 'finished') {
      // Close the mouth, then react.
      show('talk_08');
      later(() => show(mood), 280);
    } else {
      // idle: smiling base with natural micro-events every few seconds.
      show('idle_01');
      if (!reduceMotion) {
        const next = () =>
          later(() => {
            const r = Math.random();
            if (r < 0.45) {
              show('idle_03', 90); // blink
              later(() => {
                show('idle_01', 90);
                next();
              }, 160);
            } else {
              const look = r < 0.65 ? 'idle_02' : r < 0.85 ? 'idle_04' : 'idle_05';
              show(look);
              later(() => {
                show('idle_01');
                next();
              }, between(1100, 1700));
            }
          }, between(2500, 4500));
        next();
      }
    }
    return () => clearTimeout(timer);
    // `frame` is read once to decide on "eureka"; re-running on every frame change would restart the sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, reduceMotion, reaction, mood]);

  // ---- Cross-fade: one opacity value per frame; mount only frames this state can use (+ the one on screen).
  const opacity = useRef<Partial<Record<Frame, Animated.Value>>>({ idle_01: new Animated.Value(1) }).current;
  const valueFor = (f: Frame) => (opacity[f] ??= new Animated.Value(0));
  // The outgoing frame stays mounted until its fade is done, so a state change never flashes white.
  const mounted = useMemo(
    () => Array.from(new Set<Frame>([...STATE_FRAMES[shown], ...(reaction ? [reaction] : []), frame.name, frame.prev])),
    [shown, reaction, frame.name, frame.prev],
  );
  useEffect(() => {
    const from = frame.prev;
    const to = frame.name;
    if (from === to) return;
    // Anything else still visible (an interrupted fast mouth change) is hidden now.
    for (const [f, v] of Object.entries(opacity)) if (f !== from && f !== to) v!.setValue(0);
    const toValue = valueFor(to);
    const fromValue = valueFor(from);
    if (frame.fade <= 0) {
      toValue.setValue(1);
      fromValue.setValue(0);
      return;
    }
    // Fade the new frame in over the old one, then hide the old one (no see-through dip in between).
    Animated.timing(toValue, { toValue: 1, duration: frame.fade, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) fromValue.setValue(0);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  // Breathing (scale) + floating (translateY), always on unless reduce-motion.
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reduceMotion]);

  // Ring pulse while listening (red) or thinking (green).
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if ((shown !== 'listening' && shown !== 'thinking') || reduceMotion) {
      ring.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(ring, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [shown, ring, reduceMotion]);

  // The ring is the control's state: green = ready / answering, red = recording the farmer.
  const ringColor = shown === 'listening' ? theme.color.status.dangerText : theme.color.surface.brand;
  const RING = Math.max(5, Math.round(size * 0.045));

  const content = (
    <>
      {shown === 'listening' || shown === 'thinking' ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size + RING * 2,
            height: size + RING * 2,
            borderRadius: (size + RING * 2) / 2,
            borderWidth: 3,
            borderColor: ringColor,
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
          }}
        />
      ) : null}
      <Animated.View
        style={{
          width: size + RING * 2,
          height: size + RING * 2,
          borderRadius: (size + RING * 2) / 2,
          borderWidth: RING,
          borderColor: ringColor,
          overflow: 'hidden',
          backgroundColor: theme.color.surface.base,
          ...theme.elevation.level2,
          shadowColor: ringColor,
          transform: [
            { translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
            { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) },
          ],
        }}
      >
        {mounted.map((f) => (
          <Animated.Image
            key={f}
            source={FRAMES[f]}
            fadeDuration={0}
            accessibilityIgnoresInvertColors
            // Explicit size: percentage sizes stretched images on some Android phones (see crop tiles).
            // The frame on screen is drawn last so a fading-in frame sits on top of the old one.
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: size,
              height: size,
              opacity: valueFor(f),
              zIndex: f === frame.name ? 2 : 1,
            }}
          />
        ))}
      </Animated.View>
    </>
  );

  const box = { width: size * 1.35, height: size * 1.35, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' } as const;
  if (!onPress) {
    return (
      <View style={box} accessibilityRole="image" accessibilityLabel={accessibilityLabel ?? 'Annadata assistant'}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: shown === 'thinking' }}
      style={({ pressed }) => [box, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
    >
      {content}
    </Pressable>
  );
}
