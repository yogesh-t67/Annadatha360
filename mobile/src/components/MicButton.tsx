import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import { Mic } from 'lucide-react-native';

import { theme } from '../theme';

const SIZE = 132;

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

function Ring({ delay, still }: { delay: number; still: boolean }) {
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
        borderColor: theme.color.surface.brandMid,
        opacity: still ? 0.8 : progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ scale: still ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.28] }) }],
      }}
    />
  );
}

/** The big green microphone: the app's main entry point for farmers who prefer speaking to reading. */
export function MicButton({ onPress, accessibilityLabel }: { onPress: () => void; accessibilityLabel: string }) {
  const reduceMotion = useReduceMotion();

  return (
    <View style={{ alignSelf: 'center', alignItems: 'center', justifyContent: 'center', width: SIZE + 48, height: SIZE + 48 }}>
      <Ring delay={0} still={reduceMotion} />
      {reduceMotion ? null : <Ring delay={1300} still={false} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => ({
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? theme.color.surface.brandDeep : theme.color.surface.brand,
          borderWidth: 4,
          borderColor: theme.color.surface.brandBright,
          shadowColor: theme.color.surface.brand,
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
          elevation: 8,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <Mic size={54} color={theme.color.text.inverse} strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}
