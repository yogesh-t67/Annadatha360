import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, View } from 'react-native';
import { Mic, Square, Volume2 } from 'lucide-react-native';

import { theme } from '../theme';

const SIZE = 132;

/** idle: tap to talk · listening: recording, tap to send · thinking: waiting for the AI · speaking: reading the answer */
export type MicState = 'idle' | 'listening' | 'thinking' | 'speaking';

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Slow "tap me" pulse while idle. */
function Ring({ delay, still, color }: { delay: number; still: boolean; color: string }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, still, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: SIZE + 24,
        height: SIZE + 24,
        borderRadius: (SIZE + 24) / 2,
        borderWidth: 2,
        borderColor: color,
        opacity: still ? 0.8 : progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ scale: still ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.28] }) }],
      }}
    />
  );
}

/** While listening: a halo that grows with the farmer's voice, so they can see they're being heard. */
function LevelHalo({ level, color }: { level: number; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(scale, { toValue: 1 + level * 0.45, duration: 100, useNativeDriver: true }).start();
  }, [level, scale]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: SIZE + 16,
        height: SIZE + 16,
        borderRadius: (SIZE + 16) / 2,
        backgroundColor: color,
        opacity: 0.25,
        transform: [{ scale }],
      }}
    />
  );
}

/** The big microphone: the app's main entry point for farmers who prefer speaking to reading. */
export function MicButton({
  onPress,
  accessibilityLabel,
  state = 'idle',
  level = 0,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  state?: MicState;
  level?: number;
}) {
  const reduceMotion = useReduceMotion();
  const listening = state === 'listening';
  const bg = listening ? theme.color.status.dangerText : theme.color.surface.brand;
  const bgPressed = listening ? theme.color.status.dangerText : theme.color.surface.brandDeep;

  return (
    <View style={{ alignSelf: 'center', alignItems: 'center', justifyContent: 'center', width: SIZE + 72, height: SIZE + 72 }}>
      {listening ? (
        <LevelHalo level={level} color={theme.color.status.dangerText} />
      ) : state === 'idle' ? (
        <>
          <Ring delay={0} still={reduceMotion} color={theme.color.surface.brandMid} />
          {reduceMotion ? null : <Ring delay={1300} still={false} color={theme.color.surface.brandMid} />}
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy: state === 'thinking' }}
        onPress={onPress}
        disabled={state === 'thinking'}
        style={({ pressed }) => ({
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? bgPressed : bg,
          borderWidth: 4,
          borderColor: listening ? theme.color.status.dangerBg : theme.color.surface.brandBright,
          shadowColor: bg,
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        {state === 'listening' ? (
          <Square size={46} color={theme.color.text.inverse} fill={theme.color.text.inverse} strokeWidth={1.5} />
        ) : state === 'thinking' ? (
          <ActivityIndicator size="large" color={theme.color.text.inverse} />
        ) : state === 'speaking' ? (
          <Volume2 size={54} color={theme.color.text.inverse} strokeWidth={1.75} />
        ) : (
          <Mic size={54} color={theme.color.text.inverse} strokeWidth={1.75} />
        )}
      </Pressable>
    </View>
  );
}
