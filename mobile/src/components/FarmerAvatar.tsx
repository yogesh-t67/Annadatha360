import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';

import { theme } from '../theme';

/**
 * The assistant's face: a friendly Telugu farmer (white shirt, green-and-white checked kanduva).
 *
 * - idle: smiling; breathes and floats gently, and winks now and then
 * - listening: the curious/thoughtful look, with a pulsing ring (the farmer is speaking, or the AI is thinking)
 * - speaking: mouth moves (switches between the talking and smiling frames) while audio plays
 * - finished: a short wink when an answer ends, then back to idle
 *
 * All four frames stay mounted and only their opacity changes, so switching never reloads an image.
 * Only Animated with the native driver — no extra dependencies, light on low-end Android.
 */
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'finished';

const FRAMES = {
  idle: require('../../assets/avatar/idle.jpg'),
  talking: require('../../assets/avatar/talking.jpg'),
  winking: require('../../assets/avatar/winking.jpg'),
  listening: require('../../assets/avatar/listening.jpg'),
};
type Frame = keyof typeof FRAMES;

const FINISHED_MS = 1100;

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
  onPress,
  disabled,
  accessibilityLabel,
}: {
  state: AvatarState;
  size?: number;
  /** Makes the avatar the voice button (tap to talk / tap again to send). */
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const reduceMotion = useReduceMotion();

  // "finished" is also entered automatically when speaking stops.
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

  // Which frame is on screen right now (mouth flaps and idle winks change it within a state).
  const [frame, setFrame] = useState<Frame>('idle');
  useEffect(() => {
    if (shown === 'listening' || shown === 'thinking') return setFrame('listening');
    if (shown === 'finished') return setFrame('winking');
    if (shown === 'speaking') {
      if (reduceMotion) return setFrame('talking');
      // Mouth: alternate open/closed at a slightly irregular pace, like syllables.
      let open = true;
      let timer: ReturnType<typeof setTimeout>;
      const tick = () => {
        setFrame(open ? 'talking' : 'idle');
        open = !open;
        timer = setTimeout(tick, open ? 140 + Math.random() * 90 : 110 + Math.random() * 120);
      };
      tick();
      return () => clearTimeout(timer);
    }
    // idle: an occasional wink every 6–10 s
    setFrame('idle');
    if (reduceMotion) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setFrame('winking');
        timer = setTimeout(() => {
          setFrame('idle');
          schedule();
        }, 380);
      }, 6000 + Math.random() * 4000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [shown, reduceMotion]);

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
        {(Object.keys(FRAMES) as Frame[]).map((f) => (
          <Animated.Image
            key={f}
            source={FRAMES[f]}
            fadeDuration={0}
            accessibilityIgnoresInvertColors
            // Explicit size: percentage sizes stretched images on some Android phones (see crop tiles).
            style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, opacity: f === frame ? 1 : 0 }}
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
