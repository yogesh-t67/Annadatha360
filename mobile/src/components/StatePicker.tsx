import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../theme';
import { Text } from './primitives';
import { SelectedBadge } from './FeatureTile';
import { districtsOf, RegionKey } from '../data/farm';

const STATE_ORDER: RegionKey[] = ['ts', 'ap'];

/** Two large buttons, Telangana and Andhra Pradesh, each with its district count. */
export function StatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RegionKey;
  onChange: (r: RegionKey) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="bodyStrong" color={theme.color.text.secondary}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {STATE_ORDER.map((r) => {
          const selected = value === r;
          return (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(r)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 72,
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radius.lg,
                borderWidth: selected ? 2.5 : 1,
                borderColor: selected ? theme.color.surface.brand : theme.color.border.default,
                backgroundColor: selected ? theme.color.surface.brandSoft : theme.color.surface.base,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Text variant="label" weight={selected ? 'bold' : 'medium'} style={{ paddingRight: 24 }}>
                {t(`states.${r}`)}
              </Text>
              <Text variant="caption" color={theme.color.text.muted}>
                {t('farmLocation.districtCount', { count: districtsOf(r).length })}
              </Text>
              {selected ? <SelectedBadge /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
