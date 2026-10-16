import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  NotoSansTelugu_400Regular,
  NotoSansTelugu_500Medium,
  NotoSansTelugu_600SemiBold,
  NotoSansTelugu_700Bold,
} from '@expo-google-fonts/noto-sans-telugu';
import {
  BalooTammudu2_600SemiBold,
  BalooTammudu2_700Bold,
  BalooTammudu2_800ExtraBold,
} from '@expo-google-fonts/baloo-tammudu-2';

import './src/i18n';
import { theme } from './src/theme';
import { getStoredLanguage, setStoredLanguage } from './src/i18n';
import { useFarmStore } from './src/store/farmStore';
import { RootNavigator } from './src/navigation/RootNavigator';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.color.surface.brand,
    background: theme.color.surface.canvas,
    card: theme.color.surface.base,
    border: theme.color.border.default,
    text: theme.color.text.primary,
  },
};

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      await Promise.all([
        Font.loadAsync({
          Inter_400Regular,
          Inter_500Medium,
          Inter_600SemiBold,
          Inter_700Bold,
          NotoSansTelugu_400Regular,
          NotoSansTelugu_500Medium,
          NotoSansTelugu_600SemiBold,
          NotoSansTelugu_700Bold,
          BalooTammudu2_600SemiBold,
          BalooTammudu2_700Bold,
          BalooTammudu2_800ExtraBold,
        }),
        useFarmStore.persist.rehydrate(),
      ]);
      const storedLanguage = await getStoredLanguage();
      if (storedLanguage) {
        await setStoredLanguage(storedLanguage);
      }
      setReady(true);
    }
    prepare();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.surface.canvas }}>
        <ActivityIndicator color={theme.color.surface.brand} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
          <RootNavigator onboarded={useFarmStore.getState().onboarded} />
        </NavigationContainer>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
