import React from 'react';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Button, Card, Stack, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { mockFarmServices } from '../../mocks/farmServices';

export function FarmServicesScreen() {
  const { t } = useTranslation();

  return (
    <ScreenContainer scroll>
      <Stack direction="row" justify="space-between" align="center">
        <Text variant="h1">{t('farmServices.title')}</Text>
        <Text variant="micro" color={theme.color.text.tertiary}>
          {t('farmServices.demoDataNote')}
        </Text>
      </Stack>

      <Stack gap="sm">
        {mockFarmServices.map((service) => {
          const Icon = service.icon;
          return (
            <Card key={service.key}>
              <Stack direction="row" justify="space-between" align="center">
                <Stack direction="row" gap="sm" align="center" style={{ flex: 1 }}>
                  <Stack
                    align="center"
                    justify="center"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.color.status.successBg,
                    }}
                  >
                    <Icon size={24} color={theme.color.interactive.primaryBg} strokeWidth={1.75} />
                  </Stack>
                  <Stack gap="xxs" style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{t(`farmServices.services.${service.key}`)}</Text>
                    <Text variant="caption" color={theme.color.text.secondary}>
                      {`₹${service.rateRupees} ${t('farmServices.perHour')}`}
                    </Text>
                  </Stack>
                </Stack>
                <Button label={t('farmServices.bookCta')} size="md" />
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </ScreenContainer>
  );
}
