import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenTitle, StepProgress } from '../../components/Blocks';
import { SelectField } from '../../components/SelectField';
import { farmDistricts, regions } from '../../data/farm';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';

export function FarmLocationScreen() {
  const { t } = useTranslation();
  const { navigation } = useAppNavigation();
  const region = useFarmStore((s) => s.region);
  const district = useFarmStore((s) => s.district);
  const village = useFarmStore((s) => s.village);
  const update = useFarmStore((s) => s.update);

  return (
    <ScreenContainer showBack>
      <StepProgress step={2} />
      <ScreenTitle emoji="📍">{t('farmLocation.title')}</ScreenTitle>
      <SelectField
        label={t('farmLocation.state')}
        value={region}
        options={regions.map((r) => ({ value: r, label: t(`states.${r}`) }))}
        onChange={(v) => update({ region: v })}
      />
      <SelectField
        label={t('farmLocation.district')}
        value={district}
        options={farmDistricts.map((d) => ({ value: d, label: t(`districts.${d}`) }))}
        onChange={(v) => update({ district: v })}
      />
      <TextField label={t('farmLocation.village')} value={village} onChangeText={(v) => update({ village: v })} />
      <Button label={t('common.next')} trailing="→" onPress={() => navigation.navigate('CropSelection')} />
    </ScreenContainer>
  );
}
