import { colors } from '../../theme/colors';
import { useEffect } from 'react';
import { useNotificationsStore } from '../../store/notifications';
import { useSessionStore } from '../../store/session';
import { Tabs } from 'expo-router';
import { AppState, StyleSheet, View } from 'react-native';
import { appTabs } from '../../navigation/tabs';

const tint = { active: colors.accent, inactive: '#737373' };

/** Shared tab navigator. Screens supply content; navigation stays in this component. */
export function AppTabs() {
  const session = useSessionStore((state) => state.session);
  const refresh = useNotificationsStore((state) => state.refresh);
  const unread = useNotificationsStore((state) => state.items.filter((item) => !item.is_read).length);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;
    async function poll() {
      if (stopped || polling || AppState.currentState !== 'active') return;
      polling = true;
      await refresh();
      polling = false;
      if (!stopped) timer = setTimeout(poll, 10000);
    }
    void poll();
    const subscription = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active') void poll();
    });
    return () => { stopped = true; clearTimeout(timer); subscription.remove(); };
  }, [session, refresh]);
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#fafafa' },
        tabBarPosition: 'bottom',
        tabBarLabelPosition: 'below-icon',
        tabBarActiveTintColor: tint.active,
        tabBarInactiveTintColor: tint.inactive,
        tabBarHideOnKeyboard: true,
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
      }}>
      {appTabs.map((tab) => (
        <Tabs.Screen
          key={tab.route}
          name={tab.route}
          options={{
            title: tab.label,
            tabBarBadge: tab.route === 'notifications' && unread ? unread : undefined,
            tabBarAccessibilityLabel: tab.label,
            tabBarButtonTestID: `tab-${tab.route}`,
            tabBarIcon: ({ focused }) => (
              <View style={styles.icon}>
                <tab.icon size={23} color={focused ? tint.active : tint.inactive} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#fff', borderTopColor: '#e5e5e5', elevation: 0 },
  item: { paddingTop: 4 },
  label: { fontSize: 11, fontWeight: '600' },
  icon: { width: 48, height: 28, alignItems: 'center', justifyContent: 'center' },
});
