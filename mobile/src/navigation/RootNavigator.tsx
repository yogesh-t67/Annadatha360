import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SplashScreen } from '../screens/onboarding/SplashScreen';
import { LanguageSelectScreen } from '../screens/onboarding/LanguageSelectScreen';
import { MainTabs } from './MainTabs';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
    </Stack.Navigator>
  );
}
