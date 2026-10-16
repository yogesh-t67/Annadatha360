import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
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

import './src/i18n';
import { theme } from './src/theme';
import { getStoredLanguage, setStoredLanguage } from './src/i18n';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      await Font.loadAsync({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
        NotoSansTelugu_400Regular,
        NotoSansTelugu_500Medium,
        NotoSansTelugu_600SemiBold,
        NotoSansTelugu_700Bold,
      });
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.surface.brand }}>
        <ActivityIndicator color={theme.color.text.inverse} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
