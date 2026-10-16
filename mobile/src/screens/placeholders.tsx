import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Landmark,
  Leaf,
  ShoppingBag,
  ShoppingCart,
  Sprout,
  TrendingUp,
  User,
  Users,
  Wrench,
} from 'lucide-react-native';

import { EmptyState } from '../components/EmptyState';
import { ScreenContainer } from '../components/ScreenContainer';

type PlaceholderIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/**
 * Factory for screens whose real data pipeline isn't wired yet. Each still
 * renders a concrete, screen-specific empty state (not a generic stub) so the
 * app is fully navigable while backend integrations land.
 */
function makePlaceholderScreen(translationKey: string, icon: PlaceholderIcon) {
  return function PlaceholderScreen() {
    const { t } = useTranslation();
    return (
      <ScreenContainer>
        <EmptyState
          icon={icon}
          title={t(`placeholders.${translationKey}.title`)}
          body={t(`placeholders.${translationKey}.body`)}
        />
      </ScreenContainer>
    );
  };
}

export const MarketPricesScreen = makePlaceholderScreen('marketPrices', TrendingUp);
export const AgriMartScreen = makePlaceholderScreen('agriMart', ShoppingBag);
export const CartScreen = makePlaceholderScreen('cart', ShoppingCart);
export const LabourServicesScreen = makePlaceholderScreen('labourServices', Users);
export const FarmServicesScreen = makePlaceholderScreen('farmServices', Wrench);
export const GovernmentSchemesScreen = makePlaceholderScreen('governmentSchemes', Landmark);
export const CropAdvisoryScreen = makePlaceholderScreen('cropAdvisory', Leaf);
export const FarmManagementScreen = makePlaceholderScreen('farmManagement', Sprout);
export const ProfileDashboardScreen = makePlaceholderScreen('profile', User);
