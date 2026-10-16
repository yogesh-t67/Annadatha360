import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenTitle, StepProgress } from '../../components/Blocks';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';

export function FarmerProfileScreen() {
  const { t } = useTranslation();
  const { navigation } = useAppNavigation();
  const name = useFarmStore((s) => s.name);
  const phone = useFarmStore((s) => s.phone);
  const update = useFarmStore((s) => s.update);

  return (
    <ScreenContainer showBack>
      <StepProgress step={1} />
      <ScreenTitle emoji="👤">{t('farmerProfile.title')}</ScreenTitle>
      <TextField
        label={t('farmerProfile.name')}
        value={name}
        onChangeText={(v) => update({ name: v })}
        autoCapitalize="words"
        returnKeyType="next"
      />
      <TextField
        label={t('farmerProfile.phone')}
        value={phone}
        onChangeText={(v) => update({ phone: v.replace(/[^\d+ ]/g, '') })}
        keyboardType="phone-pad"
        maxLength={15}
      />
      <Button label={t('common.next')} trailing="→" onPress={() => navigation.navigate('VerifyPhone')} />
    </ScreenContainer>
  );
}
