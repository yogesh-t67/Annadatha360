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
import { CropKey, cropImages, crops, marketDistricts } from '../../data/farm';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { getMarketPrices } from '../../api/endpoints';
import { errorMessageKey } from '../../api/errorMessage';
import { hasSession } from '../../api/tokens';
import type { MarketPrice } from '../../api/types';

type MarketKey = (typeof marketDistricts)[number];

const trendColor = {
  up: theme.color.status.successText,
  down: theme.color.status.dangerText,
  flat: theme.color.text.muted,
} as const;

const trendIcon = { up: TrendingUp, down: TrendingDown, flat: Minus } as const;

export function MarketPricesScreen() {
  const { t } = useTranslation();
  const { navigation } = useAppNavigation();
  const farmCrop = useFarmStore((s) => s.crop);
  const farmDistrict = useFarmStore((s) => s.district);
  const [crop, setCrop] = useState<CropKey>(farmCrop);
  const [market, setMarket] = useState<MarketKey>(
    (marketDistricts as readonly string[]).includes(farmDistrict) ? (farmDistrict as MarketKey) : 'guntur',
  );
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
      const district = market.charAt(0).toUpperCase() + market.slice(1);
      const res = await getMarketPrices({ crop, district });
      setPrices(res.prices);
      setAsOf(res.as_of);
    } catch (e) {
      setErrorKey(errorMessageKey(e));
      setPrices(null);
    } finally {
      setLoading(false);
    }
  }, [crop, market]);

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
      <SelectField
        label={t('market.market')}
        value={market}
        options={marketDistricts.map((d) => ({ value: d, label: t(`districts.${d}`) }))}
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
              {`${t(`crops.${crop}`)} · ${t(`districts.${market}`)}`}
            </Text>
          </View>
          <Text variant="body" color={theme.color.text.muted}>
            {t('market.noReports')}
          </Text>
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
                  <Text variant="bodyStrong">{`${p.market}, ${p.district}`}</Text>
                  <Text variant="caption" color={theme.color.text.muted}>
                    {`${p.commodity} · ${p.variety}`}
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
