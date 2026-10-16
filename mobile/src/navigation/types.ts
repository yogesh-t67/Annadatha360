import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Welcome: undefined;
  Language: undefined;
  FarmerProfile: undefined;
  /** returnTo 'back': opened from inside the app (e.g. Voice) rather than during onboarding. */
  VerifyPhone: { returnTo?: 'back' } | undefined;
  FarmLocation: undefined;
  CropSelection: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
};

/** Feature screens that open on top of whichever tab the farmer is in, keeping the bottom bar visible. */
export type FeatureStackParamList = {
  Diagnosis: undefined;
  Weather: undefined;
  Irrigation: undefined;
  Market: undefined;
  Schemes: undefined;
  Expert: undefined;
  Alerts: undefined;
  Settings: undefined;
};
export type FeatureScreen = keyof FeatureStackParamList;

export type HomeStackParamList = { Home: undefined } & FeatureStackParamList;
export type AskStackParamList = { Voice: { question?: string } | undefined } & FeatureStackParamList;
export type FarmStackParamList = { MyFarm: undefined } & FeatureStackParamList;
export type ServicesStackParamList = { Services: undefined } & FeatureStackParamList;

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  AskTab: NavigatorScreenParams<AskStackParamList> | undefined;
  FarmTab: NavigatorScreenParams<FarmStackParamList> | undefined;
  ServicesTab: NavigatorScreenParams<ServicesStackParamList> | undefined;
};

/** Every route name in the app; navigate() bubbles up to whichever navigator owns the route. */
export type AppRouteParamList = RootStackParamList &
  MainTabParamList &
  HomeStackParamList &
  AskStackParamList &
  FarmStackParamList &
  ServicesStackParamList;
