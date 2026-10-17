import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MapPin } from 'lucide-react-native';

import { Button, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenTitle, StepProgress } from '../../components/Blocks';
import { SelectField } from '../../components/SelectField';
import { StatePicker } from '../../components/StatePicker';
import { DistrictKey, districtsOf, getDistrict, RegionKey } from '../../data/farm';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';

const DEFAULT_DISTRICT: Record<RegionKey, DistrictKey> = { ap: 'guntur', ts: 'warangal' };

export function FarmLocationScreen() {
  const { t, i18n } = useTranslation();
  const { navigation } = useAppNavigation();
  const region = useFarmStore((s) => s.region);
  const district = useFarmStore((s) => s.district);
  const village = useFarmStore((s) => s.village);
  const update = useFarmStore((s) => s.update);

  const en = i18n.getFixedT('en');
  const districtOptions = districtsOf(region)
    .map((d) => ({ value: d.key as DistrictKey, label: t(`districts.${d.key}`), keywords: en(`districts.${d.key}`) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const chooseState = (r: RegionKey) => {
    // Keep the district inside the chosen state.
    if (getDistrict(district)?.state !== r) update({ region: r, district: DEFAULT_DISTRICT[r] });
    else update({ region: r });
  };

  return (
    <ScreenContainer showBack>
      <StepProgress step={2} />
      <ScreenTitle icon={MapPin}>{t('farmLocation.title')}</ScreenTitle>

      <StatePicker label={t('farmLocation.state')} value={region} onChange={chooseState} />

      <SelectField
        key={region}
        label={t('farmLocation.district')}
        value={district}
        options={districtOptions}
        onChange={(v) => update({ district: v })}
        searchable
        searchPlaceholder={t('farmLocation.searchDistrict')}
        noResultsText={t('farmLocation.noDistrict')}
      />
      <TextField label={t('farmLocation.village')} value={village} onChangeText={(v) => update({ village: v })} />
      <Button label={t('common.next')} trailingIcon={ArrowRight} onPress={() => navigation.navigate('CropSelection')} />
    </ScreenContainer>
  );
}
