import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import {
  Banknote,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Droplet,
  ExternalLink,
  FileText,
  Gift,
  ListChecks,
  Shield,
  Smartphone,
  Sprout,
  Square,
  Tag,
  TriangleAlert,
  UserCheck,
  Volume2,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme, Tint } from '../../theme';
import { Button, Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { IconChip } from '../../components/IconChip';
import { Notice } from '../../components/Notice';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { getScheme, getSchemes } from '../../api/endpoints';
import { errorMessageKey } from '../../api/errorMessage';
import { hasSession } from '../../api/tokens';
import type { SchemeDetail, SchemeSummary } from '../../api/types';
import { speak, stopSpeaking } from '../../voice/speech';

const CATEGORY_STYLE: Record<SchemeSummary['category'], { icon: LucideIcon; tint: Tint }> = {
  income_support: { icon: Banknote, tint: 'leaf' },
  insurance: { icon: Shield, tint: 'sky' },
  credit: { icon: CreditCard, tint: 'sun' },
  subsidy: { icon: Tag, tint: 'leaf' },
  soil: { icon: Sprout, tint: 'leaf' },
  irrigation: { icon: Droplet, tint: 'sky' },
  other: { icon: FileText, tint: 'stone' },
};

function Section({ icon: Icon, title, items }: { icon: LucideIcon; title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon size={18} color={theme.color.surface.brandDeep} strokeWidth={2.25} />
        <Text variant="bodyStrong">{title}</Text>
      </View>
      {items.map((line, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: theme.spacing.xs, paddingLeft: 4 }}>
          <Text variant="body" color={theme.color.surface.brand}>
            {items.length > 1 ? `${i + 1}.` : '•'}
          </Text>
          <Text variant="body" style={{ flex: 1 }}>
            {line}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Expandable: benefits, who can apply, documents, how to apply, official links, read aloud. */
function SchemeDetails({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SchemeDetail | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => stopSpeaking(), []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) {
      stopSpeaking();
      setSpeaking(false);
    }
    if (next && !detail) {
      setErrorKey(null);
      getScheme(slug)
        .then(setDetail)
        .catch((e) => setErrorKey(errorMessageKey(e)));
    }
  }

  function listen(d: SchemeDetail) {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const text = [d.name, d.benefits ?? d.summary, t('schemes.eligibility'), ...d.eligibility, t('schemes.howToApply'), ...d.steps]
      .filter(Boolean)
      .join('. ');
    setSpeaking(true);
    speak(text, i18n.language, () => setSpeaking(false));
  }

  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 }}
      >
        <Text variant="bodyStrong" color={theme.color.surface.brandDeep}>
          {open ? t('schemes.hideDetails') : t('schemes.details')}
        </Text>
        <Chevron size={20} color={theme.color.surface.brandDeep} strokeWidth={2.5} />
      </Pressable>

      {open ? (
        errorKey ? (
          <Notice icon={TriangleAlert} message={t(errorKey)} />
        ) : !detail ? (
          <ActivityIndicator color={theme.color.surface.brand} />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {detail.benefits ? <Section icon={Gift} title={t('schemes.benefits')} items={[detail.benefits]} /> : null}
            <Section icon={UserCheck} title={t('schemes.eligibility')} items={detail.eligibility} />
            <Section icon={FileText} title={t('schemes.documents')} items={detail.documents} />
            <Section icon={ListChecks} title={t('schemes.howToApply')} items={detail.steps} />
            <Button
              label={speaking ? t('voice.stopSpeaking') : t('voice.listen')}
              icon={speaking ? Square : Volume2}
              variant="soft"
              compact
              onPress={() => listen(detail)}
            />
            {detail.application_url ? (
              <Button
                label={t('schemes.applyOnline')}
                icon={ExternalLink}
                compact
                onPress={() => Linking.openURL(detail.application_url!)}
              />
            ) : null}
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(detail.source_url)}>
              <Text variant="caption" color={theme.color.text.muted}>
                {`${t('schemes.officialSource')}: ${detail.source_url.replace(/^https?:\/\//, '')}`}
              </Text>
            </Pressable>
          </View>
        )
      ) : null}
    </View>
  );
}

export function GovernmentSchemesScreen() {
  const { t, i18n } = useTranslation();
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
  }, [signedIn, i18n.language]); // reload in the new language when the farmer switches

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('schemes.title')}</Text>

      {signedIn === false ? (
        <Card tone="soft" style={{ gap: theme.spacing.sm }}>
          <Text variant="body">{t('voice.signInNeeded')}</Text>
          <Button
            label={t('voice.verifyNow')}
            icon={Smartphone}
            compact
            onPress={() => navigation.navigate('VerifyPhone', { returnTo: 'back' })}
          />
        </Card>
      ) : loading ? (
        <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.lg }}>
          <ActivityIndicator color={theme.color.surface.brand} />
        </Card>
      ) : errorKey ? (
        <Notice icon={TriangleAlert} message={t(errorKey)} />
      ) : !schemes || schemes.length === 0 ? (
        <Notice icon={FileText} message={t('schemes.none')} />
      ) : (
        schemes.map((s) => {
          const style = CATEGORY_STYLE[s.category];
          return (
            <Card key={s.slug} style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
                <IconChip icon={style.icon} tint={style.tint} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="h2">{s.name}</Text>
                  <Text variant="body" color={theme.color.text.muted}>
                    {s.summary}
                  </Text>
                  <Text variant="caption" color={theme.color.text.muted}>
                    {`${s.authority === 'central' ? t('schemes.central') : t(`schemes.stateGovt.${s.state === 'TG' ? 'ts' : 'ap'}`)} · ${t('schemes.verifiedOn', { date: s.last_verified_on })}`}
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
              <SchemeDetails key={`${s.slug}-${i18n.language}`} slug={s.slug} />
              <Button label={t('schemes.askEligibility')} variant="secondary" compact onPress={() => ask(s.name)} />
            </Card>
          );
        })
      )}
      <Notice message={t('schemes.contentNotice')} />
    </ScreenContainer>
  );
}
