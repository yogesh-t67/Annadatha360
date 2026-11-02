import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';

import { theme } from '../theme';
import { farmName, useFarmStore } from '../store/farmStore';
import { Text } from './primitives';
import { CropImage } from './CropImage';

const CHIP_HEIGHT = 64;

/**
 * Row of the farmer's farms; tap one to make it the farm every screen is about. Scrolls sideways when there
 * are many. With `onAdd`, ends with an "Add farm" chip. Must be a direct child of ScreenContainer (it reaches
 * past the side padding so the row scrolls from edge to edge).
 */
export function FarmSwitcher({ onAdd, onSelect }: { onAdd?: () => void; onSelect?: (id: string) => void }) {
  const { t } = useTranslation();
  const farms = useFarmStore((s) => s.farms);
  const activeFarmId = useFarmStore((s) => s.activeFarmId);
  const selectFarm = useFarmStore((s) => s.selectFarm);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -theme.spacing.md }}
      contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm }}
    >
      {farms.map((farm) => {
        const active = farm.id === activeFarmId;
        const name = farmName(farms, farm, t);
        return (
          <Pressable
            key={farm.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${name}, ${t(`crops.${farm.crop}`)}`}
            onPress={() => {
              selectFarm(farm.id);
              onSelect?.(farm.id);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              height: CHIP_HEIGHT,
              paddingLeft: theme.spacing.xs,
              paddingRight: theme.spacing.md,
              borderRadius: theme.radius.lg,
              borderWidth: 2,
              borderColor: active ? theme.color.surface.brand : theme.color.border.default,
              backgroundColor: active || pressed ? theme.color.surface.brandSoft : theme.color.surface.base,
            })}
          >
            <CropImage code={farm.crop} size={44} />
            <View>
              <Text variant="bodyStrong" numberOfLines={1} color={active ? theme.color.surface.brandDeep : undefined}>
                {name}
              </Text>
              <Text variant="caption" numberOfLines={1} color={theme.color.text.muted}>
                {`${t(`crops.${farm.crop}`)} · ${t('home.acresValue', { acres: farm.acres || '0' })}`}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('farm.addFarm')}
          onPress={onAdd}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            height: CHIP_HEIGHT,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.lg,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: theme.color.border.brand,
            backgroundColor: pressed ? theme.color.surface.brandSoft : theme.color.surface.base,
          })}
        >
          <Plus size={24} color={theme.color.surface.brandDeep} strokeWidth={2.5} />
          <Text variant="bodyStrong" color={theme.color.surface.brandDeep}>
            {t('farm.addFarm')}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
