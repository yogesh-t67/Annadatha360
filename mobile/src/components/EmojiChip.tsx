import React from 'react';
import { Text as RNText, View } from 'react-native';

import { theme, Tint } from '../theme';

export function EmojiChip({ emoji, tint = 'leaf', size = 48 }: { emoji: string; tint?: Tint; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.31),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.color.tint[tint].bg,
      }}
    >
      <RNText style={{ fontSize: Math.round(size * 0.52) }}>{emoji}</RNText>
    </View>
  );
}
