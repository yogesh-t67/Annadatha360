import React, { useState } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';

import { theme } from '../../theme';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  helperText?: string;
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

export function TextField({ label, error, helperText, icon: Icon, editable = true, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? theme.color.status.dangerText
    : focused
    ? theme.color.border.focus
    : theme.color.border.default;

  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <Text variant="caption" weight="medium" color={theme.color.text.secondary}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          borderWidth: 1.5,
          borderColor,
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.spacing.sm,
          height: theme.touchTarget.minimum,
          backgroundColor: editable ? theme.color.surface.base : theme.color.surface.sunken,
        }}
      >
        {Icon ? <Icon size={20} color={theme.color.text.tertiary} strokeWidth={2} /> : null}
        <TextInput
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={theme.color.text.tertiary}
          style={{
            flex: 1,
            fontSize: theme.typography.body.fontSize,
            color: theme.color.text.primary,
          }}
          accessibilityLabel={label}
          {...rest}
        />
      </View>
      {error ? (
        <Text variant="micro" color={theme.color.status.dangerText}>
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="micro" color={theme.color.text.tertiary}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}
