import React from 'react';
import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { Bell, Mic, Sprout, UserRound } from 'lucide-react-native';

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

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { navigation, tab } = useAppNavigation();
  const voiceEnabled = useFarmStore((s) => s.voiceEnabled);
  const notificationsEnabled = useFarmStore((s) => s.notificationsEnabled);
  const setVoiceEnabled = useFarmStore((s) => s.setVoiceEnabled);
  const setNotificationsEnabled = useFarmStore((s) => s.setNotificationsEnabled);

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
      <ToggleRow icon={Bell} label={t('settings.notifications')} value={notificationsEnabled} onChange={setNotificationsEnabled} />
      <Button label={t('settings.editProfile')} variant="secondary" icon={UserRound} onPress={() => navigation.navigate('FarmerProfile')} />
      <Button label={t('settings.manageFarm')} variant="secondary" icon={Sprout} onPress={() => tab('FarmTab')} />
      <Text variant="caption" align="center" color={theme.color.text.muted}>
        {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
      </Text>
    </ScreenContainer>
  );
}
