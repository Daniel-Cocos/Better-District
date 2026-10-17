import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { appTabs } from '../../navigation/tabs';

const tint = { active: '#171717', inactive: '#737373' };

/** Shared tab navigator. Screens supply content; navigation stays in this component. */
export function AppTabs() {
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
            tabBarAccessibilityLabel: tab.label,
            tabBarButtonTestID: `tab-${tab.route}`,
            tabBarIcon: ({ focused }) => (
              <View style={styles.icon}>
                <Ionicons name={focused ? tab.activeIcon : tab.icon} size={23} color={focused ? tint.active : tint.inactive} />
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
