import React from 'react';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme, Tint } from '../theme';

const TINT_ICON_COLOR: Record<Tint, string> = {
  leaf: theme.color.surface.brandDeep,
  sky: theme.color.status.infoText,
  water: theme.color.status.infoText,
  sun: theme.color.status.warningText,
  clay: theme.color.status.dangerText,
  stone: theme.color.text.muted,
};

export function IconChip({ icon: Icon, tint = 'leaf', size = 48 }: { icon: LucideIcon; tint?: Tint; size?: number }) {
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
      <Icon size={Math.round(size * 0.52)} color={TINT_ICON_COLOR[tint]} strokeWidth={2} />
    </View>
  );
}
