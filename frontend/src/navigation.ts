import { Platform } from "react-native";

// iOS 26+ renders the native (liquid glass) tab bar via expo-router's
// NativeTabs; older iOS, Android and web fall back to the classic JS Tabs.
export const usesNativeTabs = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
