import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import { Minus, Smartphone, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { CropImage } from '../../components/CropImage';
import { SelectField } from '../../components/SelectField';
import { Notice } from '../../components/Notice';
import { StatePicker } from '../../components/StatePicker';
import { districtKeyForFeed, marketName, varietyName } from '../../data/mandiNames';
import {
  CropKey,
  cropImages,
  crops,
  DistrictKey,
  districtsOf,
  getDistrict,
  RegionKey,
  STATE_CODE,
} from '../../data/farm';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { getMarketPrices } from '../../api/endpoints';
import { errorMessageKey } from '../../api/errorMessage';
import { hasSession } from '../../api/tokens';
import type { MarketPrice } from '../../api/types';

const ALL = 'all';
type MarketKey = DistrictKey | typeof ALL;

const trendColor = {
  up: theme.color.status.successText,
  down: theme.color.status.dangerText,
  flat: theme.color.text.muted,
} as const;

const trendIcon = { up: TrendingUp, down: TrendingDown, flat: Minus } as const;

export function MarketPricesScreen() {
  const { t, i18n } = useTranslation();
  const { navigation } = useAppNavigation();
  const farmCrop = useFarmStore((s) => s.crop);
  const farmDistrict = useFarmStore((s) => s.district);
  const farmRegion = getDistrict(farmDistrict)?.state ?? 'ap';
  const [crop, setCrop] = useState<CropKey>(farmCrop);
  // Any state and district can be browsed; start at the farmer's own.
  const [region, setRegion] = useState<RegionKey>(farmRegion);
  const [market, setMarket] = useState<MarketKey>(farmDistrict);

  // Follow the farm district when it changes in My Farm / profile.
  useEffect(() => {
    setRegion(farmRegion);
    setMarket(farmDistrict);
  }, [farmDistrict, farmRegion]);

  const chooseState = (r: RegionKey) => {
    if (r === region) return;
    setRegion(r);
    setMarket(r === farmRegion ? farmDistrict : ALL);
  };

  const marketOptions: { value: MarketKey; label: string }[] = [
    { value: ALL, label: t('market.allDistricts', { state: t(`states.${region}`) }) },
    ...districtsOf(region)
      .map((d) => ({
        value: d.key as MarketKey,
        label: t(`districts.${d.key}`),
        keywords: i18n.getFixedT('en')(`districts.${d.key}`),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
  // The mandi feed is English-only; translate what we can, fall back to the feed text.
  const lang = i18n.language;
  const en = i18n.getFixedT('en');
  const feedDistrict = (name: string) => {
    const key = districtKeyForFeed(name, (k) => en(`districts.${k}`));
    return key ? t(`districts.${key}`) : name;
  };
  const marketLabel = market === ALL ? t(`states.${region}`) : t(`districts.${market}`);
  const [prices, setPrices] = useState<MarketPrice[] | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      hasSession().then(setSignedIn);
    }, []),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);
    try {
      const d = market === ALL ? undefined : getDistrict(market);
      const res = await getMarketPrices({
        crop,
        state: STATE_CODE[d?.state ?? region],
        // Agmarknet spelling where it differs from ours.
        district: d ? (d.mandi ?? i18n.getFixedT('en')(`districts.${d.key}`)) : undefined,
      });
      setPrices(res.prices);
      setAsOf(res.as_of);
    } catch (e) {
      setErrorKey(errorMessageKey(e));
      setPrices(null);
    } finally {
      setLoading(false);
    }
  }, [crop, market, region, i18n]);

  useEffect(() => {
    if (signedIn) load();
    else if (signedIn === false) setLoading(false);
  }, [signedIn, load]);

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('market.title')}</Text>
      <SelectField
        label={t('market.crop')}
        value={crop}
        options={crops.map((c) => ({ value: c.code, label: t(`crops.${c.code}`), image: cropImages[c.code] }))}
        onChange={setCrop}
      />
      <StatePicker label={t('farmLocation.state')} value={region} onChange={chooseState} />
      <SelectField
        key={region}
        label={t('market.market')}
        value={market}
        options={marketOptions}
        searchable
        searchPlaceholder={t('farmLocation.searchDistrict')}
        noResultsText={t('farmLocation.noDistrict')}
        onChange={setMarket}
      />

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
      ) : !prices || prices.length === 0 ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <CropImage code={crop} size={56} />
            <Text variant="h2" style={{ flex: 1 }}>
              {`${t(`crops.${crop}`)} · ${marketLabel}`}
            </Text>
          </View>
          <Text variant="body" color={theme.color.text.muted}>
            {t('market.noReports')}
          </Text>
          {market !== ALL ? (
            <Button
              label={t('market.allDistricts', { state: t(`states.${region}`) })}
              variant="secondary"
              compact
              onPress={() => setMarket(ALL)}
            />
          ) : null}
        </Card>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {asOf ? (
            <Text variant="caption" color={theme.color.text.muted}>
              {t('market.asOf', { date: asOf })}
            </Text>
          ) : null}
          {prices.map((p, i) => (
            <Card key={`${p.market}-${p.variety}-${i}`} style={{ gap: theme.spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <CropImage code={crop} size={44} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{`${marketName(p.market, lang)}, ${feedDistrict(p.district)}`}</Text>
                  <Text variant="caption" color={theme.color.text.muted}>
                    {[
                      t(`crops.${crop}`),
                      // Skip a variety that only repeats the crop ("Paddy", "Tomato").
                      p.variety.trim().toLowerCase() === en(`crops.${crop}`).toLowerCase()
                        ? ''
                        : varietyName(p.variety, lang),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.xs }}>
                <Text variant="h2">{`₹${p.modal_price.toLocaleString('en-IN')}`}</Text>
                <Text variant="caption" color={theme.color.text.muted}>
                  {t('market.perQuintal')}
                </Text>
                {p.trend
                  ? (() => {
                      const TrendIcon = trendIcon[p.trend];
                      return (
                        <View
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                        >
                          <TrendIcon size={16} color={trendColor[p.trend]} strokeWidth={2.5} />
                          <Text variant="bodyStrong" color={trendColor[p.trend]}>
                            {p.change_pct != null ? `${Math.abs(p.change_pct).toFixed(1)}%` : ''}
                          </Text>
                        </View>
                      );
                    })()
                  : null}
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}
