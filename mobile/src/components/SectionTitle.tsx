import React from 'react';

import { theme } from '../theme';
import { Text } from './primitives';

/**
 * Heading for a section of a screen (outside cards). The extra space above separates it from the previous
 * section; the screen's own gap sits below it. Inside a card use `<Text variant="label" weight="bold">`.
 */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="h2" accessibilityRole="header" style={{ marginTop: theme.spacing.xs }}>
      {children}
    </Text>
  );
}
