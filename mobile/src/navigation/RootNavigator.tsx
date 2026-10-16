import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { LanguageScreen } from '../screens/onboarding/LanguageScreen';
import { FarmerProfileScreen } from '../screens/onboarding/FarmerProfileScreen';
import { VerifyPhoneScreen } from '../screens/onboarding/VerifyPhoneScreen';
import { FarmLocationScreen } from '../screens/onboarding/FarmLocationScreen';
import { CropSelectionScreen } from '../screens/onboarding/CropSelectionScreen';
import { MainTabs } from './MainTabs';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator({ onboarded }: { onboarded: boolean }) {
  return (
    <Stack.Navigator initialRouteName={onboarded ? 'Main' : 'Welcome'} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="FarmerProfile" component={FarmerProfileScreen} />
      <Stack.Screen name="VerifyPhone" component={VerifyPhoneScreen} />
      <Stack.Screen name="FarmLocation" component={FarmLocationScreen} />
      <Stack.Screen name="CropSelection" component={CropSelectionScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
    </Stack.Navigator>
  );
}
