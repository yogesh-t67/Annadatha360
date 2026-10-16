import React from 'react';
import { Image, View } from 'react-native';

import { theme } from '../theme';
import { cropIcon } from '../data/cropCatalog';
import { cropImages } from '../data/cropImages';

/** Square crop photo with rounded corners; falls back to the category icon for unknown codes. */
export function CropImage({ code, size = 48 }: { code: string; size?: number }) {
  const source = (cropImages as Record<string, (typeof cropImages)[keyof typeof cropImages]>)[code];
  const radius = Math.round(size * 0.24);

  if (!source) {
    const Icon = cropIcon(code);
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.color.tint.leaf.bg,
        }}
      >
        <Icon size={Math.round(size * 0.52)} color={theme.color.surface.brandDeep} strokeWidth={2} />
      </View>
    );
  }

  return (
    <Image
      source={source}
      accessibilityIgnoresInvertColors
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: theme.color.surface.sunken,
      }}
      resizeMode="cover"
    />
  );
}
