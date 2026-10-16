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
          minHeight: multiline ? 110 : 56,
          borderWidth: 1.5,
          borderColor: focused ? theme.color.border.focus : theme.color.border.default,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
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
