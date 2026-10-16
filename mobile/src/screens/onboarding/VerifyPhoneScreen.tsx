import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';

import { theme } from '../../theme';
import { Button, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenTitle, StepProgress } from '../../components/Blocks';
import { Notice } from '../../components/Notice';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { RootStackParamList } from '../../navigation/types';
import { requestOtp, verifyOtp } from '../../api/endpoints';
import { errorMessageKey } from '../../api/errorMessage';
import { syncProfile } from '../../api/syncProfile';

/**
 * Phone + OTP login (docs/api/auth.md). Shown after the farmer profile step during onboarding, and from
 * screens that need the backend (e.g. Voice) for farmers who onboarded before verification existed.
 */
export function VerifyPhoneScreen() {
  const { t, i18n } = useTranslation();
  const { navigation } = useAppNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'VerifyPhone'>>();
  const returnBack = route.params?.returnTo === 'back';
  const storedPhone = useFarmStore((s) => s.phone);
  const update = useFarmStore((s) => s.update);

  const [phone, setPhone] = useState(storedPhone);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function proceed() {
    if (returnBack) navigation.goBack();
    else navigation.navigate('FarmLocation');
  }

  async function sendCode() {
    setBusy(true);
    setErrorKey(null);
    try {
      const res = await requestOtp(phone);
      update({ phone });
      setCodeSent(true);
      setCooldown(res.resend_after);
    } catch (e) {
      setErrorKey(errorMessageKey(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setErrorKey(null);
    try {
      await verifyOtp(phone, code);
      const state = useFarmStore.getState();
      if (state.onboarded) {
        // Already onboarded on this phone before verifying: send the saved profile now.
        syncProfile(state, i18n.language).catch((e) => console.warn('Profile sync failed', e));
      }
      proceed();
    } catch (e) {
      setErrorKey(errorMessageKey(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer showBack>
      {returnBack ? null : <StepProgress step={1} />}
      <ScreenTitle emoji="📱">{t('verifyPhone.title')}</ScreenTitle>
      <Text variant="body" color={theme.color.text.muted}>
        {t('verifyPhone.subtitle')}
      </Text>

      <TextField
        label={t('verifyPhone.phone')}
        value={phone}
        onChangeText={(v) => {
          setPhone(v.replace(/[^\d+ ]/g, ''));
          setCodeSent(false);
        }}
        keyboardType="phone-pad"
        maxLength={15}
        editable={!busy}
      />

      {codeSent ? (
        <>
          <Text variant="caption" color={theme.color.text.muted}>
            {t('verifyPhone.sentTo', { phone })}
          </Text>
          <TextField
            label={t('verifyPhone.code')}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
            editable={!busy}
          />
          <Button label={t('verifyPhone.verify')} trailing="→" loading={busy} disabled={code.length !== 6} onPress={verify} />
          <Button
            label={cooldown > 0 ? t('verifyPhone.resendIn', { seconds: cooldown }) : t('verifyPhone.resend')}
            variant="secondary"
            compact
            disabled={cooldown > 0 || busy}
            onPress={sendCode}
          />
        </>
      ) : (
        <Button label={t('verifyPhone.sendCode')} trailing="→" loading={busy} disabled={!phone.trim()} onPress={sendCode} />
      )}

      {errorKey ? <Notice emoji="⚠️" message={t(errorKey)} /> : null}

      <Button label={t('verifyPhone.skip')} variant="soft" compact disabled={busy} onPress={proceed} />
    </ScreenContainer>
  );
}
