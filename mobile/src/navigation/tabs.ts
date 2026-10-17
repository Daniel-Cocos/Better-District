import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

type TabDefinition = {
  route: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  activeIcon: ComponentProps<typeof Ionicons>['name'];
};

// Order, labels, and icons live here; the navigator owns selection and history.
export const appTabs = [
  { route: 'notifications', label: 'Notifications', icon: 'notifications-outline', activeIcon: 'notifications' },
  { route: 'index', label: 'Map', icon: 'map-outline', activeIcon: 'map' },
  { route: 'feed', label: 'Feed', icon: 'newspaper-outline', activeIcon: 'newspaper' },
  { route: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
] as const satisfies readonly TabDefinition[];
