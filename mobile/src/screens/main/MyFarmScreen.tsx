import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CircleCheck, Pencil, Plus } from 'lucide-react-native';

import { theme } from '../../theme';
import { Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { CropImage } from '../../components/CropImage';
import { Farm, farmName, useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';

/**
 * The farmer's farms. Tap a card to choose the farm every screen is about; "Edit" and "Add new farm" open
 * FarmEditScreen, so choosing, editing and adding never share one form.
 */
export function MyFarmScreen() {
  const { t } = useTranslation();
  const { navigation } = useAppNavigation();
  const farms = useFarmStore((s) => s.farms);
  const activeFarmId = useFarmStore((s) => s.activeFarmId);
  const selectFarm = useFarmStore((s) => s.selectFarm);

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="h1">{t('farm.title')}</Text>
        {farms.length > 1 ? (
          <Text variant="body" color={theme.color.text.muted}>
            {t('farm.tapToChoose')}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {farms.map((farm) => (
          <FarmCard
            key={farm.id}
            farm={farm}
            name={farmName(farms, farm, t)}
            active={farm.id === activeFarmId}
            onSelect={() => selectFarm(farm.id)}
            onEdit={() => navigation.navigate('FarmEdit', { farmId: farm.id })}
          />
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('farm.addFarm')}
          onPress={() => navigation.navigate('FarmEdit', {})}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xs,
            minHeight: theme.touchTarget.row,
            borderRadius: theme.radius.lg,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: theme.color.surface.brand,
            backgroundColor: pressed ? theme.color.surface.brandSoft : theme.color.surface.base,
          })}
        >
          <Plus size={theme.iconSize.row} color={theme.color.surface.brandDeep} strokeWidth={2.5} />
          <Text variant="label" weight="bold" color={theme.color.surface.brandDeep}>
            {t('farm.addFarm')}
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

function FarmCard({
  farm,
  name,
  active,
  onSelect,
  onEdit,
}: {
  farm: Farm;
  name: string;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const district = useFarmStore((s) => s.district);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${name}, ${t(`crops.${farm.crop}`)}, ${t('home.acresValue', { acres: farm.acres })}`}
      onPress={onSelect}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        borderWidth: 2,
        borderColor: active ? theme.color.surface.brand : theme.color.border.default,
        backgroundColor: active ? theme.color.surface.brandSoft : pressed ? theme.color.surface.sunken : theme.color.surface.base,
        ...theme.elevation.level1,
      })}
    >
      <CropImage code={farm.crop} size={72} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label" weight="bold" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="body" color={theme.color.text.secondary} numberOfLines={1}>
          {`${t(`crops.${farm.crop}`)} · ${t('home.acresValue', { acres: farm.acres })}`}
        </Text>
        <Text variant="body" color={theme.color.text.muted} numberOfLines={1}>
          {`${t(`stages.${farm.stage}`)} · ${t(`districts.${district}`)}`}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' }}>
        {active ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }}>
            <CircleCheck size={theme.iconSize.inline} color={theme.color.surface.brandDeep} strokeWidth={2.5} />
            <Text variant="caption" weight="bold" color={theme.color.surface.brandDeep}>
              {t('farm.selected')}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('farm.edit')}: ${name}`}
          onPress={onEdit}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xxs,
            minHeight: theme.touchTarget.minimum,
            paddingHorizontal: theme.spacing.sm,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.color.border.brand,
            backgroundColor: pressed ? theme.color.surface.brandMid : theme.color.surface.base,
          })}
        >
          <Pencil size={theme.iconSize.inline} color={theme.color.surface.brandDeep} strokeWidth={2.25} />
          <Text variant="bodyStrong" color={theme.color.surface.brandDeep}>
            {t('farm.edit')}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
