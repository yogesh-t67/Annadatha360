import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Droplets, Plus, Sprout, Wheat } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { theme } from '../../theme';
import { Button, Card, Stack, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { EmptyState } from '../../components/EmptyState';
import { mockMyCrops, mockPrimaryField } from '../../mocks/farmManagement';

type Tab = 'myFields' | 'activities' | 'expenses';

const stageColor = {
  growing: { text: theme.color.status.successText, bg: theme.color.status.successBg },
  sowing: { text: theme.color.status.infoText, bg: theme.color.status.infoBg },
  planning: { text: theme.color.status.warningText, bg: theme.color.status.warningBg },
};

const fieldActions = [
  { key: 'addField', icon: Plus },
  { key: 'cropPlan', icon: ClipboardList },
  { key: 'irrigation', icon: Droplets },
  { key: 'harvest', icon: Wheat },
] as const;

export function FarmManagementScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('myFields');

  return (
    <ScreenContainer scroll>
      <Text variant="h1">{t('farmManagement.title')}</Text>

      <Stack
        direction="row"
        gap="xxs"
        style={{ backgroundColor: theme.color.surface.raised, borderRadius: theme.radius.md, padding: 4 }}
      >
        {(['myFields', 'activities', 'expenses'] as Tab[]).map((option) => {
          const active = tab === option;
          return (
            <Pressable
              key={option}
              onPress={() => setTab(option)}
              style={{
                flex: 1,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.radius.sm,
                alignItems: 'center',
                backgroundColor: active ? theme.color.interactive.primaryBg : 'transparent',
              }}
            >
              <Text
                variant="caption"
                weight="semibold"
                color={active ? theme.color.text.inverse : theme.color.text.secondary}
              >
                {t(`farmManagement.tabs.${option}`)}
              </Text>
            </Pressable>
          );
        })}
      </Stack>

      {tab !== 'myFields' ? (
        <EmptyState icon={ClipboardList} title={t(`farmManagement.tabs.${tab}`)} body={t('farmManagement.title')} />
      ) : (
        <>
          <Card>
            <Stack gap="sm">
              <Stack gap="xxs">
                <Text variant="h2">{mockPrimaryField.name}</Text>
                <Text variant="caption" color={theme.color.text.secondary}>
                  {t('farmManagement.fieldAcres', { acres: mockPrimaryField.acres })}
                  {' · '}
                  {t(`farmManagement.crops.${mockPrimaryField.cropKey}`)}
                </Text>
              </Stack>
              <Stack direction="row" gap="sm" wrap>
                {fieldActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Stack key={action.key} align="center" gap="xxs" style={{ width: 70 }}>
                      <Pressable
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: theme.radius.md,
                          backgroundColor: theme.color.status.successBg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={22} color={theme.color.interactive.primaryBg} strokeWidth={1.75} />
                      </Pressable>
                      <Text variant="micro" align="center">
                        {t(`farmManagement.actions.${action.key}`)}
                      </Text>
                    </Stack>
                  );
                })}
              </Stack>
            </Stack>
          </Card>

          <Button label={t('farmManagement.addNewCrop')} variant="secondary" icon={Sprout} />

          <Stack gap="sm">
            <Text variant="h2">{t('farmManagement.myCropsTitle')}</Text>
            {mockMyCrops.map((crop) => {
              const colors = stageColor[crop.stage];
              return (
                <Card key={crop.key}>
                  <Stack direction="row" justify="space-between" align="center">
                    <Stack gap="xxs">
                      <Text variant="bodyStrong">{t(`farmManagement.crops.${crop.key}`)}</Text>
                      <Text variant="caption" color={theme.color.text.secondary}>
                        {t('farmManagement.fieldAcres', { acres: crop.acres })}
                      </Text>
                    </Stack>
                    <Stack
                      style={{
                        backgroundColor: colors.bg,
                        borderRadius: theme.radius.full,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: theme.spacing.xxs,
                      }}
                    >
                      <Text variant="micro" weight="semibold" color={colors.text}>
                        {t(`farmManagement.stages.${crop.stage}`)}
                      </Text>
                    </Stack>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </>
      )}
    </ScreenContainer>
  );
}
