import React from 'react';
import { useTranslation } from 'react-i18next';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Leaf, ShoppingBag, User, Wrench } from 'lucide-react-native';

import { theme } from '../theme';
import { HomeScreen } from '../screens/home/HomeScreen';
import { AiAssistantScreen } from '../screens/home/AiAssistantScreen';
import { WeatherScreen } from '../screens/home/WeatherScreen';
import { MarketPricesScreen } from '../screens/home/MarketPricesScreen';
import { CropAdvisoryScreen } from '../screens/advisories/CropAdvisoryScreen';
import { FarmManagementScreen } from '../screens/advisories/FarmManagementScreen';
import { AgriMartScreen } from '../screens/shop/AgriMartScreen';
import { CartScreen } from '../screens/shop/CartScreen';
import { FarmServicesScreen } from '../screens/services/FarmServicesScreen';
import { LabourServicesScreen } from '../screens/services/LabourServicesScreen';
import { GovernmentSchemesScreen } from '../screens/services/GovernmentSchemesScreen';
import { ProfileDashboardScreen } from '../screens/profile/ProfileDashboardScreen';
import {
  AdvisoriesStackParamList,
  HomeStackParamList,
  MainTabParamList,
  ProfileStackParamList,
  ServicesStackParamList,
  ShopStackParamList,
} from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ShopStack = createNativeStackNavigator<ShopStackParamList>();
const ServicesStack = createNativeStackNavigator<ServicesStackParamList>();
const AdvisoriesStack = createNativeStackNavigator<AdvisoriesStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeDashboard" component={HomeScreen} />
      <HomeStack.Screen name="Weather" component={WeatherScreen} options={{ headerShown: true, title: '' }} />
      <HomeStack.Screen
        name="MarketPrices"
        component={MarketPricesScreen}
        options={{ headerShown: true, title: '' }}
      />
      <HomeStack.Screen name="AiAssistant" component={AiAssistantScreen} />
    </HomeStack.Navigator>
  );
}

function ShopStackNavigator() {
  return (
    <ShopStack.Navigator screenOptions={{ headerShown: false }}>
      <ShopStack.Screen name="AgriMart" component={AgriMartScreen} />
      <ShopStack.Screen name="Cart" component={CartScreen} options={{ headerShown: true, title: '' }} />
    </ShopStack.Navigator>
  );
}

function ServicesStackNavigator() {
  return (
    <ServicesStack.Navigator screenOptions={{ headerShown: false }}>
      <ServicesStack.Screen name="FarmServices" component={FarmServicesScreen} />
      <ServicesStack.Screen
        name="LabourServices"
        component={LabourServicesScreen}
        options={{ headerShown: true, title: '' }}
      />
      <ServicesStack.Screen
        name="GovernmentSchemes"
        component={GovernmentSchemesScreen}
        options={{ headerShown: true, title: '' }}
      />
    </ServicesStack.Navigator>
  );
}

function AdvisoriesStackNavigator() {
  return (
    <AdvisoriesStack.Navigator screenOptions={{ headerShown: false }}>
      <AdvisoriesStack.Screen name="CropAdvisory" component={CropAdvisoryScreen} />
      <AdvisoriesStack.Screen
        name="FarmManagement"
        component={FarmManagementScreen}
        options={{ headerShown: true, title: '' }}
      />
    </AdvisoriesStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileDashboard" component={ProfileDashboardScreen} />
    </ProfileStack.Navigator>
  );
}

export function MainTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.interactive.primaryBg,
        tabBarInactiveTintColor: theme.color.text.tertiary,
        tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: theme.typography.micro.fontSize },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="ShopTab"
        component={ShopStackNavigator}
        options={{
          title: t('nav.shop'),
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="ServicesTab"
        component={ServicesStackNavigator}
        options={{
          title: t('nav.services'),
          tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="AdvisoriesTab"
        component={AdvisoriesStackNavigator}
        options={{
          title: t('nav.advisories'),
          tabBarIcon: ({ color, size }) => <Leaf color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color, size }) => <User color={color} size={size} strokeWidth={2} />,
        }}
      />
    </Tab.Navigator>
  );
}
