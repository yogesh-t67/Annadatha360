import React, { useState } from 'react';
import { Image, ImageSourcePropType, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme } from '../theme';
import { Text } from './primitives';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Photo thumbnail; takes precedence over icon. */
  image?: ImageSourcePropType;
}

function OptionLeading<T extends string>({ option, size }: { option: SelectOption<T>; size: number }) {
  if (option.image) {
    return (
      <Image
        source={option.image}
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.24) }}
      />
    );
  }
  if (option.icon) {
    const Icon = option.icon;
    return <Icon size={Math.round(size * 0.65)} color={theme.color.surface.brandDeep} strokeWidth={2} />;
  }
  return null;
}

export interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
}

/** Dropdown that opens a bottom sheet of large, easy-to-tap rows. */
export function SelectField<T extends string>({ label, value, options, onChange }: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="bodyStrong" color={theme.color.text.secondary}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? ''}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          minHeight: 56,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          borderWidth: 1.5,
          borderColor: open ? theme.color.border.focus : theme.color.border.default,
          backgroundColor: pressed ? theme.color.surface.sunken : theme.color.surface.base,
        })}
      >
        {current ? <OptionLeading option={current} size={32} /> : null}
        <Text variant="label" weight="medium" style={{ flex: 1 }}>
          {current?.label}
        </Text>
        <ChevronDown size={22} color={theme.color.surface.brand} strokeWidth={2.5} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.color.surface.overlay }} onPress={() => setOpen(false)} />
        <View
          style={{
            backgroundColor: theme.color.surface.canvas,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            paddingTop: theme.spacing.sm,
            paddingBottom: insets.bottom + theme.spacing.md,
            maxHeight: '70%',
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 5,
              borderRadius: 3,
              backgroundColor: theme.color.border.strong,
              marginBottom: theme.spacing.sm,
            }}
          />
          <Text variant="h2" style={{ paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.xs }}>
            {label}
          </Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.xs }}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    minHeight: 56,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.md,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? theme.color.surface.brand : theme.color.border.default,
                    backgroundColor: selected || pressed ? theme.color.surface.brandSoft : theme.color.surface.base,
                  })}
                >
                  <OptionLeading option={option} size={40} />
                  <Text variant="label" weight={selected ? 'bold' : 'medium'} style={{ flex: 1 }}>
                    {option.label}
                  </Text>
                  {selected ? <Check size={20} color={theme.color.surface.brand} strokeWidth={3} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
