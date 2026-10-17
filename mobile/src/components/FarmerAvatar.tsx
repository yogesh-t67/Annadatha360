import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

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
export type AvatarState = 'idle' | 'listening' | 'speaking' | 'finished';

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

export function FarmerAvatar({ state, size = 140 }: { state: AvatarState; size?: number }) {
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
    if (shown === 'listening') return setFrame('listening');
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

  // Listening ring pulse.
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (shown !== 'listening' || reduceMotion) {
      ring.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(ring, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [shown, ring, reduceMotion]);

  const ringColor = shown === 'listening' ? theme.color.status.dangerText : theme.color.surface.brandMid;

  return (
    <View
      style={{ width: size * 1.3, height: size * 1.3, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}
      accessibilityRole="image"
      accessibilityLabel="Annadata assistant"
    >
      {shown === 'listening' ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size + 8,
            height: size + 8,
            borderRadius: (size + 8) / 2,
            borderWidth: 3,
            borderColor: ringColor,
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
          }}
        />
      ) : null}
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: theme.color.surface.base,
          borderWidth: 3,
          borderColor: shown === 'listening' ? theme.color.status.dangerText : theme.color.surface.brandMid,
          ...theme.elevation.level1,
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
            style={{ position: 'absolute', top: -3, left: -3, width: size, height: size, opacity: f === frame ? 1 : 0 }}
          />
        ))}
      </Animated.View>
    </View>
  );
}
