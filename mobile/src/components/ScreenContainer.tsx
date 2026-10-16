import React from 'react';
import { ScrollView, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';

export interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  children: React.ReactNode;
}

export function ScreenContainer({ scroll = false, style, children, ...rest }: ScreenContainerProps) {
  const padding = { padding: theme.spacing.md, gap: theme.spacing.md };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface.sunken }} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[padding, style]} {...rest}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, style]} {...rest}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
