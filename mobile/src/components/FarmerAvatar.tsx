import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';

import { theme } from '../theme';
import { getMouthLevel } from '../voice/speech';

/**
 * The assistant's face: a friendly Telugu farmer (white shirt, green-and-white checked kanduva).
 *
 * 21 frames (assets/avatar) built from ONE base portrait: every frame differs from the base only where the
 * expression changes (mouth, eyes or face), so talking and blinking never make the turban or shirt shimmer.
 * - idle: base, with real blinks (open -> half -> closed -> half -> open), glances left/right, a warm smile
 * - listening: attentive look, nodding warmly now and then
 * - thinking: "hmm" look, glancing aside
 * - speaking: lip-sync across 8 mouth shapes, driven by the voice's live loudness when the audio reports it
 *   (server Telugu voice), otherwise a natural syllable rhythm with word pauses
 * - finished: lips close, then a reaction (`mood`), then idle
 *
 * Frames cross-fade; only the frames the current state can use are mounted. Built-in Animated only.
 */
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'finished';
export type AvatarMood = 'happy' | 'agree' | 'confused' | 'surprised' | 'concerned';

const FRAMES = {
  base: require('../../assets/avatar/base.jpg'), // relaxed smile (rest pose)
  mouth_rest: require('../../assets/avatar/mouth_rest.jpg'), // closed, neutral
  mouth_mbp: require('../../assets/avatar/mouth_mbp.jpg'), // lips pressed (m, b, p)
  mouth_small: require('../../assets/avatar/mouth_small.jpg'), // slightly open
  mouth_mid: require('../../assets/avatar/mouth_mid.jpg'), // half open ("eh")
  mouth_wide: require('../../assets/avatar/mouth_wide.jpg'), // wide open ("aa")
  mouth_o: require('../../assets/avatar/mouth_o.jpg'), // rounded ("oh", "oo")
  mouth_ee: require('../../assets/avatar/mouth_ee.jpg'), // stretched ("ee")
  mouth_fv: require('../../assets/avatar/mouth_fv.jpg'), // teeth on lip (f, v)
  blink_half: require('../../assets/avatar/blink_half.jpg'),
  blink_closed: require('../../assets/avatar/blink_closed.jpg'),
  look_left: require('../../assets/avatar/look_left.jpg'),
  look_right: require('../../assets/avatar/look_right.jpg'),
  listen: require('../../assets/avatar/listen.jpg'), // attentive
  listen_nod: require('../../assets/avatar/listen_nod.jpg'), // understanding / warm
  think: require('../../assets/avatar/think.jpg'), // "hmm", looking up
  happy: require('../../assets/avatar/happy.jpg'),
  agree: require('../../assets/avatar/agree.jpg'), // wink
  confused: require('../../assets/avatar/confused.jpg'),
  surprised: require('../../assets/avatar/surprised.jpg'),
  concerned: require('../../assets/avatar/concerned.jpg'),
};
type Frame = keyof typeof FRAMES;

const MOUTHS: Frame[] = ['mouth_rest', 'mouth_mbp', 'mouth_small', 'mouth_mid', 'mouth_wide', 'mouth_o', 'mouth_ee', 'mouth_fv'];
const BLINK: Frame[] = ['blink_half', 'blink_closed'];

/** Frames each state can show; only these are mounted, to keep decoded-bitmap memory small. */
const STATE_FRAMES: Record<AvatarState, Frame[]> = {
  idle: ['base', ...BLINK, 'look_left', 'look_right', 'listen_nod'],
  listening: ['listen', 'listen_nod', ...BLINK],
  thinking: ['think', 'look_left', 'look_right'],
  speaking: ['base', ...MOUTHS, ...BLINK],
  finished: ['mouth_rest', 'base', 'happy', 'agree', 'confused', 'surprised', 'concerned'],
};

/** Cross-fade length: very quick for mouth shapes, softer for expression changes. */
const FADE_MS = { mouth: 45, blink: 50, expression: 200 };
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
  const [frame, setFrame] = useState<{ name: Frame; prev: Frame; fade: number }>({ name: 'base', prev: 'base', fade: 0 });
  const show = (name: Frame, fade = FADE_MS.expression) =>
    setFrame((f) => (f.name === name ? f : { name, prev: f.name, fade }));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = (fn: () => void, ms: number) => {
      timer = setTimeout(fn, ms);
    };
    /** A real blink: open -> half -> closed -> half -> back to `open`. */
    const blink = (open: Frame, then: () => void) => {
      show('blink_half', FADE_MS.blink);
      later(() => {
        show('blink_closed', FADE_MS.blink);
        later(() => {
          show('blink_half', FADE_MS.blink);
          later(() => {
            show(open, FADE_MS.blink);
            then();
          }, 60);
        }, 90);
      }, 55);
    };

    if (shown === 'idle' && reaction) {
      show(reaction);
      return;
    }

    if (shown === 'listening') {
      show('listen');
      if (!reduceMotion) {
        const next = () =>
          later(() => {
            if (Math.random() < 0.4) return blink('listen', next);
            show('listen_nod'); // "I understand"
            later(() => {
              show('listen');
              next();
            }, between(800, 1200));
          }, between(1400, 2400));
        next();
      }
    } else if (shown === 'thinking') {
      show('think');
      if (!reduceMotion) {
        const next = () =>
          later(() => {
            show(pick<Frame>(['look_left', 'look_right']));
            later(() => {
              show('think');
              next();
            }, between(700, 1000));
          }, between(1300, 2000));
        next();
      }
    } else if (shown === 'speaking') {
      if (reduceMotion) {
        show('mouth_mid');
      } else {
        // Lip-sync. With live loudness (server voice): louder = more open, with "oh"/"ee" variety and closed
        // lips in pauses. Without it (phone voice): syllable-like shapes every 80-160 ms with short word pauses.
        let lastMouth: Frame = 'mouth_rest';
        let sinceBlink = 0;
        let syllables = 0;
        let pauseEvery = Math.round(between(3, 6));
        const fromLevel = (lvl: number): Frame => {
          if (lvl < 0.12) return lastMouth === 'mouth_rest' && Math.random() < 0.4 ? 'mouth_mbp' : 'mouth_rest';
          if (lvl < 0.32) return Math.random() < 0.25 ? 'mouth_fv' : 'mouth_small';
          if (lvl < 0.6) return Math.random() < 0.3 ? 'mouth_ee' : 'mouth_mid';
          return Math.random() < 0.3 ? 'mouth_o' : 'mouth_wide';
        };
        const rhythm = (): Frame => {
          if (++syllables >= pauseEvery) {
            syllables = 0;
            pauseEvery = Math.round(between(3, 6));
            return Math.random() < 0.5 ? 'mouth_rest' : 'mouth_mbp'; // between words
          }
          const options: Frame[] = ['mouth_small', 'mouth_mid', 'mouth_mid', 'mouth_wide', 'mouth_o', 'mouth_ee', 'mouth_small', 'mouth_fv'];
          let m = pick(options);
          if (m === lastMouth) m = pick(options);
          return m;
        };
        const step = () => {
          const ms = between(80, 160);
          sinceBlink += ms;
          if (sinceBlink > between(3500, 5500)) {
            sinceBlink = 0;
            return blink(lastMouth, () => later(step, 60));
          }
          const lvl = getMouthLevel();
          lastMouth = lvl == null ? rhythm() : fromLevel(lvl);
          show(lastMouth, FADE_MS.mouth);
          later(step, lvl == null ? ms : 75);
        };
        step();
      }
    } else if (shown === 'finished') {
      // Close the lips, then react.
      show('mouth_rest', FADE_MS.mouth);
      later(() => show(mood), 220);
    } else {
      // idle: rest pose with natural micro-events every few seconds.
      show('base');
      if (!reduceMotion) {
        const next = () =>
          later(() => {
            const r = Math.random();
            if (r < 0.55) return blink('base', next);
            show(r < 0.72 ? 'look_left' : r < 0.89 ? 'look_right' : 'listen_nod');
            later(() => {
              show('base');
              next();
            }, between(1000, 1600));
          }, between(2500, 4500));
        next();
      }
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, reduceMotion, reaction, mood]);

  // ---- Cross-fade: one opacity value per frame; mount only frames this state can use (+ the one on screen).
  const opacity = useRef<Partial<Record<Frame, Animated.Value>>>({ base: new Animated.Value(1) }).current;
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
