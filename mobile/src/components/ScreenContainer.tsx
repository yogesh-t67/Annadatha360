import React from 'react';
import { ScrollView, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { AppHeader } from './AppHeader';

export interface ScreenContainerProps {
  showBack?: boolean;
  contentStyle?: ViewStyle;
  children: React.ReactNode;
}

export function ScreenContainer({ showBack = false, contentStyle, children }: ScreenContainerProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface.canvas }} edges={['top', 'left', 'right']}>
      <AppHeader showBack={showBack} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          {
            paddingHorizontal: theme.spacing.md,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.xl,
            gap: theme.spacing.md,
          },
          contentStyle,
        ]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
