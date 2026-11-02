import React, { useState } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { resolveFontFamily, theme } from '../../theme';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Omit for a label-less field; accessibilityLabel then falls back to placeholder. */
  label?: string;
}

export function TextField({ label, multiline, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const { i18n } = useTranslation();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? (
        <Text variant="bodyStrong" color={theme.color.text.secondary}>
          {label}
        </Text>
      ) : null}
      <TextInput
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={theme.color.text.tertiary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label ?? rest.placeholder}
        style={{
          // Single-line fields get a fixed height (room for Telugu's taller letters) so they are the same size
          // in both languages; the Telugu font would otherwise make the field taller than in English.
          ...(multiline ? { minHeight: 110, paddingVertical: theme.spacing.sm } : { height: theme.touchTarget.field, paddingVertical: 0 }),
          borderWidth: 1.5,
          borderColor: focused ? theme.color.border.focus : theme.color.border.default,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.color.surface.base,
          color: theme.color.text.primary,
          fontFamily: resolveFontFamily(i18n.language, 'medium'),
          fontSize: theme.typography.label.fontSize,
        }}
        {...rest}
      />
    </View>
  );
}
