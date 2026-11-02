import React, { useState } from 'react';
import { Image, ImageSourcePropType, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { resolveFontFamily, theme } from '../theme';
import { Text } from './primitives';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Extra text the search box matches, e.g. the English name when the label is Telugu. */
  keywords?: string;
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
  /** `null`: nothing chosen yet; the field shows `placeholder`. */
  value: T | null;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  /** Show a search box at the top of the sheet (long lists like districts). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shown when the search matches nothing. */
  noResultsText?: string;
  /** Shown while `value` is null. */
  placeholder?: string;
}

/** Dropdown that opens a bottom sheet of large, easy-to-tap rows. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  searchable = false,
  searchPlaceholder,
  noResultsText,
  placeholder,
}: SelectFieldProps<T>) {
  const { t, i18n } = useTranslation();
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const current = value === null ? undefined : (options.find((o) => o.value === value) ?? options[0]);

  const setOpen = (o: boolean) => {
    setOpenState(o);
    setQuery('');
  };

  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter((o) => `${o.label} ${o.keywords ?? ''} ${o.value}`.toLowerCase().includes(q))
    : options;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="bodyStrong" color={theme.color.text.secondary}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder ?? ''}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          height: theme.touchTarget.field,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          borderWidth: 1.5,
          borderColor: open ? theme.color.border.focus : theme.color.border.default,
          backgroundColor: pressed ? theme.color.surface.sunken : theme.color.surface.base,
        })}
      >
        {current ? <OptionLeading option={current} size={40} /> : null}
        <Text
          variant="label"
          weight="medium"
          color={current ? undefined : theme.color.text.tertiary}
          style={{ flex: 1 }}
        >
          {current?.label ?? placeholder}
        </Text>
        <ChevronDown size={22} color={theme.color.surface.brand} strokeWidth={2.5} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: theme.color.surface.overlay }} onPress={() => setOpen(false)} />
        <View
          style={{
            backgroundColor: theme.color.surface.canvas,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            paddingTop: theme.spacing.sm,
            paddingBottom: insets.bottom + theme.spacing.md,
            // Fixed height while searching so the sheet doesn't jump as results shrink.
            ...(searchable ? { height: '85%' } : { maxHeight: '70%' }),
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: theme.spacing.xxs,
              borderRadius: theme.radius.full,
              backgroundColor: theme.color.border.strong,
              marginBottom: theme.spacing.sm,
            }}
          />
          <Text variant="h2" style={{ paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.xs }}>
            {label}
          </Text>
          {searchable ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.xs,
                marginHorizontal: theme.spacing.md,
                marginBottom: theme.spacing.sm,
                height: theme.touchTarget.field,
                paddingHorizontal: theme.spacing.sm,
                borderRadius: theme.radius.md,
                borderWidth: 1.5,
                borderColor: theme.color.border.focus,
                backgroundColor: theme.color.surface.base,
              }}
            >
              <Search size={20} color={theme.color.text.muted} strokeWidth={2.25} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={theme.color.text.tertiary}
                accessibilityLabel={searchPlaceholder ?? label}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                style={{
                  flex: 1,
                  paddingVertical: theme.spacing.xs,
                  color: theme.color.text.primary,
                  fontFamily: resolveFontFamily(i18n.language, 'medium'),
                  fontSize: theme.typography.label.fontSize,
                }}
              />
              {query ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.clear')}
                  onPress={() => setQuery('')}
                  style={{ width: theme.touchTarget.minimum, height: theme.touchTarget.minimum, alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={theme.iconSize.row} color={theme.color.text.muted} strokeWidth={2.25} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.xs }}
          >
            {shown.length === 0 && noResultsText ? (
              <Text variant="body" align="center" color={theme.color.text.muted} style={{ paddingVertical: theme.spacing.lg }}>
                {noResultsText}
              </Text>
            ) : null}
            {shown.map((option) => {
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
                    minHeight: theme.touchTarget.row,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.lg,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? theme.color.surface.brand : theme.color.border.default,
                    backgroundColor: selected || pressed ? theme.color.surface.brandSoft : theme.color.surface.base,
                  })}
                >
                  <OptionLeading option={option} size={40} />
                  <Text variant="label" weight={selected ? 'bold' : 'medium'} style={{ flex: 1 }}>
                    {option.label}
                  </Text>
                  {selected ? <Check size={theme.iconSize.row} color={theme.color.surface.brand} strokeWidth={3} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
