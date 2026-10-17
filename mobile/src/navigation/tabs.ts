import { Bell, Map, List, Camera, UserRound, type LucideIcon } from 'lucide-react-native';

type TabDefinition = {
  route: string;
  label: string;
  icon: LucideIcon;
};

// Order, labels, and icons live here; the navigator owns selection and history.
export const appTabs = [
  { route: 'notifications', label: 'Notifications', icon: Bell },
  { route: 'index', label: 'Map', icon: Map },
  { route: 'feed', label: 'Feed', icon: List },
  { route: 'report', label: 'Report', icon: Camera },
  { route: 'profile', label: 'Profile', icon: UserRound },
] as const satisfies readonly TabDefinition[];
