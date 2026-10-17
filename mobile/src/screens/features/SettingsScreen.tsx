import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { Bell, Check, LogOut, Mic, Sprout, UserRound, Volume2 } from 'lucide-react-native';

import { AppVoice, speak, stopSpeaking, voicesFor } from '../../voice/speech';

import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import { signOut } from '../../api/signOut';

import { theme } from '../../theme';
import { Button, Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SelectField } from '../../components/SelectField';
import { LanguageCode, setStoredLanguage, supportedLanguages } from '../../i18n';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';

function ToggleRow({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: typeof Mic;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 40 }}>
        <Icon size={20} color={theme.color.surface.brandDeep} strokeWidth={2} />
        <Text variant="label" weight="semibold" style={{ flex: 1 }}>
          {label}
        </Text>
        <Switch
          accessibilityLabel={label}
          value={value}
          onValueChange={onChange}
          trackColor={{ false: theme.color.border.strong, true: theme.color.surface.brand }}
          thumbColor={theme.color.surface.base}
        />
      </View>
    </Card>
  );
}

/** Pick the assistant's voice by ear: tap a voice to hear a sample and use it. */
function VoicePicker() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'te' ? 'te' : 'en';
  const saved = useFarmStore((s) => s.voiceIds[lang]);
  const setVoiceId = useFarmStore((s) => s.setVoiceId);
  const [voices, setVoices] = useState<AppVoice[] | null>(null);

  useEffect(() => {
    voicesFor(lang).then(setVoices);
  }, [lang]);
  useEffect(() => () => stopSpeaking(), []);

  if (!voices) return null;
  // Telugu: the server's natural male voice is the default (phones rarely have a male Telugu voice).
  const SERVER = '__server__';
  const options: (AppVoice & { server?: boolean })[] = [
    ...(lang === 'te' ? [{ identifier: SERVER, label: '', male: true, server: true }] : []),
    ...voices,
  ];
  const current =
    saved && voices.some((v) => v.identifier === saved)
      ? saved
      : lang === 'te'
        ? SERVER
        : voices.find((v) => v.male)?.identifier;
  let maleN = 0;
  let otherN = 0;

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Volume2 size={20} color={theme.color.surface.brandDeep} strokeWidth={2} />
        <Text variant="label" weight="semibold" style={{ flex: 1 }}>
          {t('settings.assistantVoice')}
        </Text>
      </View>
      {options.length === 0 ? (
        <Text variant="caption" color={theme.color.text.muted}>
          {t('settings.noVoices')}
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {options.map((v) => {
            const selected = v.identifier === current;
            const label = v.server
              ? t('settings.naturalMaleVoice')
              : v.male
                ? t('settings.maleVoice', { n: ++maleN })
                : t('settings.otherVoice', { n: ++otherN });
            return (
              <Pressable
                key={v.identifier}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  if (v.server) {
                    setVoiceId(lang, ''); // no phone voice chosen → server voice
                    speak(t('settings.voiceSample'), i18n.language);
                  } else {
                    setVoiceId(lang, v.identifier);
                    speak(t('settings.voiceSample'), i18n.language, undefined, v.identifier);
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 44,
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radius.full,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? theme.color.surface.brand : theme.color.border.default,
                  backgroundColor: selected ? theme.color.surface.brandSoft : theme.color.surface.base,
                }}
              >
                {selected ? <Check size={16} color={theme.color.surface.brand} strokeWidth={3} /> : null}
                <Text variant="bodyStrong">{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Text variant="caption" color={theme.color.text.muted}>
        {t('settings.voiceHint')}
      </Text>
    </Card>
  );
}

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { navigation, tab } = useAppNavigation();
  const voiceEnabled = useFarmStore((s) => s.voiceEnabled);
  const notificationsEnabled = useFarmStore((s) => s.notificationsEnabled);
  const setVoiceEnabled = useFarmStore((s) => s.setVoiceEnabled);
  const setNotificationsEnabled = useFarmStore((s) => s.setNotificationsEnabled);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('settings.title')}</Text>
      <SelectField
        label={t('settings.language')}
        value={i18n.language as LanguageCode}
        options={supportedLanguages.map((code) => ({ value: code, label: t(`languageName.${code}`) }))}
        onChange={(code) => setStoredLanguage(code)}
      />
      <ToggleRow icon={Mic} label={t('settings.voice')} value={voiceEnabled} onChange={setVoiceEnabled} />
      <VoicePicker />
      <ToggleRow icon={Bell} label={t('settings.notifications')} value={notificationsEnabled} onChange={setNotificationsEnabled} />
      <Button label={t('settings.editProfile')} variant="secondary" icon={UserRound} onPress={() => navigation.navigate('FarmerProfile')} />
      <Button label={t('settings.manageFarm')} variant="secondary" icon={Sprout} onPress={() => tab('FarmTab')} />
      <Button
        label={t('settings.logout')}
        variant="secondary"
        icon={LogOut}
        loading={signingOut}
        onPress={() =>
          Alert.alert(t('settings.logoutTitle'), t('settings.logoutBody'), [
            { text: t('settings.cancel'), style: 'cancel' },
            {
              text: t('settings.logout'),
              style: 'destructive',
              onPress: async () => {
                setSigningOut(true);
                await signOut().catch((e) => console.warn('Sign out failed', e));
                // Reset the whole app (not just this tab) back to the first screen.
                let root: NavigationProp<ParamListBase> = navigation;
                while (root.getParent()) root = root.getParent()!;
                root.reset({ index: 0, routes: [{ name: 'Welcome' }] });
              },
            },
          ])
        }
      />
      <Text variant="caption" align="center" color={theme.color.text.muted}>
        {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
      </Text>
    </ScreenContainer>
  );
}
