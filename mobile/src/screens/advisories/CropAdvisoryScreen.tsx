import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Info, Leaf } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { theme } from '../../theme';
import { Button, Card, Stack, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { mockOtherAdvisories } from '../../mocks/cropAdvisory';

type Tab = 'cropCare' | 'stageGuide';

export function CropAdvisoryScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('cropCare');
  const [showDiagnosisNotice, setShowDiagnosisNotice] = useState(false);

  return (
    <ScreenContainer scroll>
      <Text variant="h1">{t('cropAdvisory.title')}</Text>

      <Stack
        direction="row"
        gap="xxs"
        style={{ backgroundColor: theme.color.surface.raised, borderRadius: theme.radius.md, padding: 4 }}
      >
        {(['cropCare', 'stageGuide'] as Tab[]).map((option) => {
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
                {t(`cropAdvisory.tabs.${option}`)}
              </Text>
            </Pressable>
          );
        })}
      </Stack>

      {tab === 'cropCare' ? (
        <Card>
          <Stack gap="sm">
            <Stack gap="xxs">
              <Text variant="h2">{t('cropAdvisory.featured.title')}</Text>
              <Text variant="body" color={theme.color.text.secondary}>
                {t('cropAdvisory.featured.body')}
              </Text>
            </Stack>
            <Button label={t('cropAdvisory.featured.cta')} icon={Camera} onPress={() => setShowDiagnosisNotice(true)} />
            {showDiagnosisNotice ? (
              <Stack
                direction="row"
                gap="sm"
                align="flex-start"
                style={{
                  backgroundColor: theme.color.status.infoBg,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                }}
              >
                <Info size={18} color={theme.color.status.infoText} strokeWidth={2} />
                <Stack gap="xxs" style={{ flex: 1 }}>
                  <Text variant="caption" weight="semibold" color={theme.color.status.infoText}>
                    {t('cropAdvisory.diagnosisPendingTitle')}
                  </Text>
                  <Text variant="micro" color={theme.color.status.infoText}>
                    {t('cropAdvisory.diagnosisPendingBody')}
                  </Text>
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        </Card>
      ) : (
        <Card>
          <Text variant="body" color={theme.color.text.secondary}>
            {t('cropAdvisory.diagnosisPendingBody')}
          </Text>
        </Card>
      )}

      <Stack gap="sm">
        <Text variant="h2">{t('cropAdvisory.otherAdvisoriesTitle')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {mockOtherAdvisories.map((crop) => (
            <Card key={crop.key} padding="sm" style={{ width: 84, alignItems: 'center' }}>
              <Stack align="center" gap="xxs">
                <Leaf size={22} color={theme.color.interactive.primaryBg} strokeWidth={1.75} />
                <Text variant="caption" weight="medium">
                  {t(`cropAdvisory.crops.${crop.key}`)}
                </Text>
              </Stack>
            </Card>
          ))}
        </View>
      </Stack>
    </ScreenContainer>
  );
}
