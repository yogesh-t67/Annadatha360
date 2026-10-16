import React from 'react';
import { View, ViewProps, ViewStyle } from 'react-native';

import { theme } from '../../theme';

type SpacingKey = keyof typeof theme.spacing;

export interface StackProps extends ViewProps {
  direction?: 'row' | 'column';
  gap?: SpacingKey;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  children: React.ReactNode;
}

/** Layout primitive. Components should compose spacing via `gap`, never margin. */
export function Stack({
  direction = 'column',
  gap,
  align,
  justify,
  wrap = false,
  style,
  children,
  ...rest
}: StackProps) {
  return (
    <View
      style={[
        {
          flexDirection: direction,
          gap: gap ? theme.spacing[gap] : undefined,
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
