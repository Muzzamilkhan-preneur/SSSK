import Ionicons from "@react-native-vector-icons/ionicons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { fonts, useTheme } from "@/src/theme";

export default function ContractorTabsLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="active">
          <NativeTabs.Trigger.Icon sf="wrench.and.screwdriver" />
          <NativeTabs.Trigger.Label>Jobs</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="completed">
          <NativeTabs.Trigger.Icon sf="checkmark.seal" />
          <NativeTabs.Trigger.Label>Done</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="active"
        options={{ title: "Jobs", tabBarIcon: ({ color, size }) => <Ionicons name="construct" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="completed"
        options={{ title: "Done", tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
