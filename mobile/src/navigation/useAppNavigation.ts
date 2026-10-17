import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AppRouteParamList, FeatureScreen, MainTabParamList } from './types';

export function useAppNavigation() {
  const navigation = useNavigation<NativeStackNavigationProp<AppRouteParamList>>();

  return {
    navigation,
    open: (screen: FeatureScreen) => navigation.navigate(screen),
    tab: (tab: keyof MainTabParamList) => navigation.navigate(tab),
    ask: (question?: string) => navigation.navigate('AskTab', { screen: 'Voice', params: { question } }),
    /** Open Ask and start listening right away. */
    talk: () => navigation.navigate('AskTab', { screen: 'Voice', params: { listen: Date.now() } }),
    enterApp: () => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }),
  };
}
