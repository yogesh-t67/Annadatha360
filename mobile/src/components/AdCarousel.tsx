import React, { useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';

import { theme } from '../theme';
import type { Ad } from '../data/ads';
import { Text } from './primitives';
import { TINT_ICON_COLOR } from './IconChip';

/**
 * Fixed, so every ad is the same size in both languages whatever its text length: padding + 2-line title +
 * 2-line body + call-to-action line at the app's line heights (same in Telugu and English).
 */
const CARD_HEIGHT = 200;
const AUTO_ADVANCE_MS = 5000;

/**
 * Full-width banner ads. One card per screen width; swipe left/right for more, and it moves on by itself
 * every few seconds (paused while the farmer is touching it). Must be a direct child of ScreenContainer:
 * it reaches past the screen's side padding so a swipe can start from the very edge.
 */
export function AdCarousel({ ads, onPress }: { ads: Ad[]; onPress: (ad: Ad) => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const gutter = theme.spacing.md; // ScreenContainer's side padding
  const gap = theme.spacing.sm;
  const cardWidth = width - gutter * 2;
  const step = cardWidth + gap;

  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [touching, setTouching] = useState(false);

  useEffect(() => {
    if (ads.length < 2 || touching) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % ads.length;
      scrollRef.current?.scrollTo({ x: next * step, animated: true });
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [index, touching, ads.length, step]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / step);
    setIndex(Math.max(0, Math.min(ads.length - 1, i)));
  };

  if (ads.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        onScrollBeginDrag={() => setTouching(true)}
        onScrollEndDrag={() => setTouching(false)}
        onMomentumScrollEnd={onScrollEnd}
        style={{ marginHorizontal: -gutter }}
        contentContainerStyle={{ paddingHorizontal: gutter, gap }}
      >
        {ads.map((ad) => (
          <AdCard key={ad.id} ad={ad} width={cardWidth} onPress={() => onPress(ad)} />
        ))}
      </ScrollView>

      {ads.length > 1 ? (
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs }}
          accessibilityLabel={t('ads.position', { current: index + 1, total: ads.length })}
        >
          {ads.map((ad, i) => (
            <View
              key={ad.id}
              style={{
                width: i === index ? theme.spacing.lg : theme.spacing.xs,
                height: theme.spacing.xs,
                borderRadius: theme.radius.full,
                backgroundColor: i === index ? theme.color.surface.brand : theme.color.border.strong,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AdCard({ ad, width, onPress }: { ad: Ad; width: number; onPress: () => void }) {
  const { t } = useTranslation();
  const accent = TINT_ICON_COLOR[ad.tint];
  const title = t(`ads.items.${ad.id}.title`);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('ads.sponsored')}. ${title}. ${t(`ads.items.${ad.id}.body`)}`}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width,
          height: CARD_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.color.tint[ad.tint].border,
          backgroundColor: theme.color.tint[ad.tint].bg,
        },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {/* "Ad" label sits in the corner so it doesn't take a line of the card's height. */}
      <View
        style={{
          position: 'absolute',
          top: theme.spacing.xs,
          right: theme.spacing.sm,
          paddingHorizontal: theme.spacing.xs,
          borderRadius: theme.radius.full,
          backgroundColor: theme.color.surface.base,
        }}
      >
        <Text variant="micro" weight="bold" color={theme.color.text.muted}>
          {t('ads.sponsored')}
        </Text>
      </View>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="label" weight="bold" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" color={theme.color.text.muted} numberOfLines={2}>
          {t(`ads.items.${ad.id}.body`)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }}>
          <Text variant="bodyStrong" weight="bold" color={accent}>
            {t(`ads.items.${ad.id}.cta`)}
          </Text>
          <ChevronRight size={theme.iconSize.inline} color={accent} strokeWidth={2.5} />
        </View>
      </View>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: theme.radius.xl,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.color.surface.base,
        }}
      >
        <ad.icon size={40} color={accent} strokeWidth={1.75} />
      </View>
    </Pressable>
  );
}
