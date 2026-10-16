import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { theme, Tint } from '../../theme';
import { Button, Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { EmojiChip } from '../../components/EmojiChip';
import { Notice } from '../../components/Notice';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { getSchemes } from '../../api/endpoints';
import { errorMessageKey } from '../../api/errorMessage';
import { hasSession } from '../../api/tokens';
import type { SchemeSummary } from '../../api/types';

const CATEGORY_STYLE: Record<SchemeSummary['category'], { emoji: string; tint: Tint }> = {
  income_support: { emoji: '💵', tint: 'leaf' },
  insurance: { emoji: '🛡️', tint: 'sky' },
  credit: { emoji: '💳', tint: 'sun' },
  subsidy: { emoji: '🏷️', tint: 'leaf' },
  soil: { emoji: '🌱', tint: 'leaf' },
  irrigation: { emoji: '💧', tint: 'sky' },
  other: { emoji: '📄', tint: 'stone' },
};

export function GovernmentSchemesScreen() {
  const { t } = useTranslation();
  const { navigation, ask } = useAppNavigation();

  const [schemes, setSchemes] = useState<SchemeSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      hasSession().then(setSignedIn);
    }, []),
  );

  useEffect(() => {
    if (signedIn !== true) {
      if (signedIn === false) setLoading(false);
      return;
    }
    setLoading(true);
    setErrorKey(null);
    getSchemes()
      .then(setSchemes)
      .catch((e) => setErrorKey(errorMessageKey(e)))
      .finally(() => setLoading(false));
  }, [signedIn]);

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('schemes.title')}</Text>

      {signedIn === false ? (
        <Card tone="soft" style={{ gap: theme.spacing.sm }}>
          <Text variant="body">{t('voice.signInNeeded')}</Text>
          <Button
            label={t('voice.verifyNow')}
            emoji="📱"
            compact
            onPress={() => navigation.navigate('VerifyPhone', { returnTo: 'back' })}
          />
        </Card>
      ) : loading ? (
        <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.lg }}>
          <ActivityIndicator color={theme.color.surface.brand} />
        </Card>
      ) : errorKey ? (
        <Notice emoji="⚠️" message={t(errorKey)} />
      ) : !schemes || schemes.length === 0 ? (
        <Notice emoji="📄" message={t('schemes.none')} />
      ) : (
        schemes.map((s) => {
          const style = CATEGORY_STYLE[s.category];
          return (
            <Card key={s.slug} style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
                <EmojiChip emoji={style.emoji} tint={style.tint} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="h2">{s.name}</Text>
                  <Text variant="body" color={theme.color.text.muted}>
                    {s.summary}
                  </Text>
                  <Text variant="caption" color={theme.color.text.muted}>
                    {t('schemes.verifiedOn', { date: s.last_verified_on })}
                  </Text>
                </View>
              </View>
              {s.possibly_eligible != null ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.xxs,
                    borderRadius: theme.radius.full,
                    backgroundColor: s.possibly_eligible ? theme.color.status.successBg : theme.color.status.dangerBg,
                  }}
                >
                  <Text
                    variant="caption"
                    weight="semibold"
                    color={s.possibly_eligible ? theme.color.status.successText : theme.color.status.dangerText}
                  >
                    {s.possibly_eligible ? t('schemes.mayQualify') : t('schemes.mayNotQualify')}
                  </Text>
                </View>
              ) : null}
              <Button label={t('schemes.askEligibility')} variant="secondary" compact onPress={() => ask(s.name)} />
            </Card>
          );
        })
      )}
      <Notice message={t('schemes.contentNotice')} />
    </ScreenContainer>
  );
}
