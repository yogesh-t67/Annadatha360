import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Landmark } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { theme } from '../../theme';
import { Card, Stack, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { mockSchemes } from '../../mocks/governmentSchemes';

type Tier = 'central' | 'state';

export function GovernmentSchemesScreen() {
  const { t } = useTranslation();
  const [tier, setTier] = useState<Tier>('central');
  const schemes = mockSchemes.filter((scheme) => scheme.tier === tier);

  return (
    <ScreenContainer scroll>
      <Text variant="h1">{t('governmentSchemes.title')}</Text>

      <Stack
        direction="row"
        gap="xxs"
        style={{ backgroundColor: theme.color.surface.raised, borderRadius: theme.radius.md, padding: 4 }}
      >
        {(['central', 'state'] as Tier[]).map((option) => {
          const active = tier === option;
          return (
            <Pressable
              key={option}
              onPress={() => setTier(option)}
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
                {t(option === 'central' ? 'governmentSchemes.centralTab' : 'governmentSchemes.stateTab')}
              </Text>
            </Pressable>
          );
        })}
      </Stack>

      <Stack gap="sm">
        {schemes.map((scheme) => (
          <Card key={scheme.key}>
            <Stack direction="row" gap="sm" align="flex-start">
              <Stack
                align="center"
                justify="center"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.color.status.successBg,
                }}
              >
                <Landmark size={22} color={theme.color.interactive.primaryBg} strokeWidth={1.75} />
              </Stack>
              <Stack gap="xxs" style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t(`governmentSchemes.schemes.${scheme.key}.name`)}</Text>
                <Text variant="caption" color={theme.color.text.secondary}>
                  {t(`governmentSchemes.schemes.${scheme.key}.description`)}
                </Text>
              </Stack>
            </Stack>
          </Card>
        ))}
      </Stack>
    </ScreenContainer>
  );
}
