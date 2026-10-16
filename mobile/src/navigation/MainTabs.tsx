import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Mic, Sprout, Wrench } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { resolveFontFamily, theme } from '../theme';
import { HomeScreen } from '../screens/main/HomeScreen';
import { VoiceAssistantScreen } from '../screens/main/VoiceAssistantScreen';
import { MyFarmScreen } from '../screens/main/MyFarmScreen';
import { ServicesScreen } from '../screens/main/ServicesScreen';
import { CropDiagnosisScreen } from '../screens/features/CropDiagnosisScreen';
import { WeatherScreen } from '../screens/features/WeatherScreen';
import { IrrigationScreen } from '../screens/features/IrrigationScreen';
import { MarketPricesScreen } from '../screens/features/MarketPricesScreen';
import { GovernmentSchemesScreen } from '../screens/features/GovernmentSchemesScreen';
import { ExpertHelpScreen } from '../screens/features/ExpertHelpScreen';
import { AlertsScreen } from '../screens/features/AlertsScreen';
import { SettingsScreen } from '../screens/features/SettingsScreen';
import {
  AskStackParamList,
  FarmStackParamList,
  FeatureStackParamList,
  HomeStackParamList,
  MainTabParamList,
  ServicesStackParamList,
} from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const AskStack = createNativeStackNavigator<AskStackParamList>();
const FarmStack = createNativeStackNavigator<FarmStackParamList>();
const ServicesStack = createNativeStackNavigator<ServicesStackParamList>();

const featureScreens: { name: keyof FeatureStackParamList; component: React.ComponentType }[] = [
  { name: 'Diagnosis', component: CropDiagnosisScreen },
  { name: 'Weather', component: WeatherScreen },
  { name: 'Irrigation', component: IrrigationScreen },
  { name: 'Market', component: MarketPricesScreen },
  { name: 'Schemes', component: GovernmentSchemesScreen },
  { name: 'Expert', component: ExpertHelpScreen },
  { name: 'Alerts', component: AlertsScreen },
  { name: 'Settings', component: SettingsScreen },
];

type AnyStack = ReturnType<typeof createNativeStackNavigator<FeatureStackParamList>>;

function featureRoutes(StackNav: AnyStack) {
  return featureScreens.map((s) => <StackNav.Screen key={s.name} name={s.name} component={s.component} />);
}

const stackOptions = { headerShown: false, contentStyle: { backgroundColor: theme.color.surface.canvas } };

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={stackOptions}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      {featureRoutes(HomeStack as unknown as AnyStack)}
    </HomeStack.Navigator>
  );
}

function AskStackNavigator() {
  return (
    <AskStack.Navigator screenOptions={stackOptions}>
      <AskStack.Screen name="Voice" component={VoiceAssistantScreen} />
      {featureRoutes(AskStack as unknown as AnyStack)}
    </AskStack.Navigator>
  );
}

function FarmStackNavigator() {
  return (
    <FarmStack.Navigator screenOptions={stackOptions}>
      <FarmStack.Screen name="MyFarm" component={MyFarmScreen} />
      {featureRoutes(FarmStack as unknown as AnyStack)}
    </FarmStack.Navigator>
  );
}

function ServicesStackNavigator() {
  return (
    <ServicesStack.Navigator screenOptions={stackOptions}>
      <ServicesStack.Screen name="Services" component={ServicesScreen} />
      {featureRoutes(ServicesStack as unknown as AnyStack)}
    </ServicesStack.Navigator>
  );
}

function TabIcon({ icon: Icon, focused }: { icon: LucideIcon; focused: boolean }) {
  return (
    <View
      style={{
        width: 52,
        height: 30,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? theme.color.surface.brandMid : 'transparent',
      }}
    >
      <Icon size={20} color={focused ? theme.color.surface.brandDeep : theme.color.text.muted} strokeWidth={2.25} />
    </View>
  );
}

const tabs: { name: keyof MainTabParamList; component: React.ComponentType; icon: LucideIcon; label: string }[] = [
  { name: 'HomeTab', component: HomeStackNavigator, icon: Home, label: 'nav.home' },
  { name: 'AskTab', component: AskStackNavigator, icon: Mic, label: 'nav.ask' },
  { name: 'FarmTab', component: FarmStackNavigator, icon: Sprout, label: 'nav.farm' },
  { name: 'ServicesTab', component: ServicesStackNavigator, icon: Wrench, label: 'nav.services' },
];

export function MainTabs() {
  const { t, i18n } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.surface.brandDeep,
        tabBarInactiveTintColor: theme.color.text.muted,
        tabBarStyle: {
          paddingTop: theme.spacing.xs,
          borderTopColor: theme.color.border.default,
          backgroundColor: theme.color.surface.base,
        },
        tabBarLabelStyle: {
          fontFamily: resolveFontFamily(i18n.language, 'semibold'),
          fontSize: theme.typography.micro.fontSize,
          marginTop: 2,
        },
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            title: t(tab.label),
            tabBarIcon: ({ focused }) => <TabIcon icon={tab.icon} focused={focused} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
