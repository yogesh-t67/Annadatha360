import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, UserPlus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { theme } from '../../theme';
import { Button, Card, Stack, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { EmptyState } from '../../components/EmptyState';
import { mockWorkers } from '../../mocks/labourServices';

type Tab = 'find' | 'bookings';

export function LabourServicesScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('find');

  return (
    <ScreenContainer scroll>
      <Stack direction="row" justify="space-between" align="center">
        <Text variant="h1">{t('labourServices.title')}</Text>
        <Text variant="micro" color={theme.color.text.tertiary}>
          {t('labourServices.demoDataNote')}
        </Text>
      </Stack>

      <Button label={t('labourServices.postRequirement')} variant="secondary" icon={UserPlus} />

      <Stack
        direction="row"
        gap="xxs"
        style={{ backgroundColor: theme.color.surface.raised, borderRadius: theme.radius.md, padding: 4 }}
      >
        {(['find', 'bookings'] as Tab[]).map((option) => {
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
                {t(option === 'find' ? 'labourServices.findTab' : 'labourServices.bookingsTab')}
              </Text>
            </Pressable>
          );
        })}
      </Stack>

      {tab === 'find' ? (
        <Stack gap="sm">
          {mockWorkers.map((worker) => (
            <Card key={worker.key}>
              <Stack direction="row" justify="space-between" align="center">
                <Stack direction="row" gap="sm" align="center" style={{ flex: 1 }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: theme.radius.full,
                      backgroundColor: theme.color.status.successBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text variant="bodyStrong" color={theme.color.interactive.primaryBg}>
                      {t(`labourServices.workers.${worker.key}.name`).charAt(0)}
                    </Text>
                  </View>
                  <Stack gap="xxs" style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{t(`labourServices.workers.${worker.key}.name`)}</Text>
                    <Text variant="caption" color={theme.color.text.secondary}>
                      {t(`labourServices.workers.${worker.key}.skill`)}
                    </Text>
                    <Stack direction="row" gap="xxs" align="center">
                      <Star size={13} color={theme.color.status.warningText} strokeWidth={2} fill={theme.color.status.warningText} />
                      <Text variant="micro" color={theme.color.text.tertiary}>
                        {`${worker.rating} (${worker.bookingsCount})`}
                      </Text>
                    </Stack>
                  </Stack>
                </Stack>
                <Stack gap="xs" align="flex-end">
                  <Text variant="caption" weight="semibold">
                    {`₹${worker.rateRupees} ${t('labourServices.perDay')}`}
                  </Text>
                  <Button label={t('labourServices.bookCta')} size="md" />
                </Stack>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <EmptyState
          icon={UserPlus}
          title={t('labourServices.noBookingsTitle')}
          body={t('labourServices.noBookingsBody')}
        />
      )}
    </ScreenContainer>
  );
}
