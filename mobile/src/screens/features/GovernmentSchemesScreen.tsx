import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme, Tint } from '../../theme';
import { Button, Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { EmojiChip } from '../../components/EmojiChip';
import { Notice } from '../../components/Notice';
import { useAppNavigation } from '../../navigation/useAppNavigation';

const schemes: { name: string; descKey: string; emoji: string; tint: Tint }[] = [
  { name: 'PM-KISAN', descKey: 'schemes.pmKisan', emoji: '💵', tint: 'leaf' },
  { name: 'PMFBY', descKey: 'schemes.pmfby', emoji: '🛡️', tint: 'sky' },
  { name: 'Kisan Credit Card', descKey: 'schemes.kcc', emoji: '💳', tint: 'sun' },
];

export function GovernmentSchemesScreen() {
  const { t } = useTranslation();
  const { ask } = useAppNavigation();

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('schemes.title')}</Text>
      {schemes.map((s) => (
        <Card key={s.name} style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <EmojiChip emoji={s.emoji} tint={s.tint} />
            <View style={{ flex: 1 }}>
              <Text variant="h2">{s.name}</Text>
              <Text variant="body" color={theme.color.text.muted}>
                {t(s.descKey)}
              </Text>
            </View>
          </View>
          <Button label={t('schemes.askEligibility')} variant="secondary" compact onPress={() => ask(s.name)} />
        </Card>
      ))}
      <Notice />
    </ScreenContainer>
  );
}
