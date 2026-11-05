// Design tokens for this app. Light theme only (per design guidelines).
//
// The keys match the "color" block of /app/design_guidelines.json. Keep every
// key; do not add a second theme or colors file; do not write color literals
// in components.
//
// How the names work: a plain key is a background, and its `on` partner is the
// text or icon color that sits on top of it. Always use them as a pair.
//   <View style={{ backgroundColor: colors.brandPrimary }}>
//     <Text style={{ color: colors.onBrandPrimary }}>Continue</Text>
//   </View>
//
// Styling a screen or component: build the sheet with makeStyles so colors
// and layout live together and follow the active scheme. For color props that
// are not styles (icon color, placeholderTextColor, ActivityIndicator) read
// useTheme().colors inside the component.

import { useMemo } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#F9F9F8",
  onSurface: "#141414",
  surfaceSecondary: "#EEEEEC",
  onSurfaceSecondary: "#2C2C2A",
  surfaceTertiary: "#E2E2DE",
  onSurfaceTertiary: "#444440",
  surfaceInverse: "#141414",
  onSurfaceInverse: "#F9F9F8",
  muted: "#70706B",

  // Brand
  brand: "#D94E28",
  onBrand: "#FFFFFF",
  brandPrimary: "#D94E28",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#2C2C2A",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#F3D8D0",
  onBrandTertiary: "#8C260D",

  // Status
  success: "#2D7A4E",
  onSuccess: "#FFFFFF",
  warning: "#C27803",
  onWarning: "#FFFFFF",
  error: "#D94E28",
  onError: "#FFFFFF",
  info: "#2B5C8F",
  onInfo: "#FFFFFF",

  // Lines
  border: "#D4D4CE",
  borderStrong: "#141414",
  divider: "#E2E2DE",
};

export type ThemeColors = typeof light;

// Spacing & radius tokens from design_guidelines.json
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

const systemFont = Platform.select({ ios: "System", android: "sans-serif", default: "sans-serif" });

export const fonts = {
  display: systemFont,
  text: systemFont,
  medium: systemFont,
  semibold: systemFont,
  bold: systemFont,
} as const;

export const fontScale = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

// Append alpha to a token hex: withAlpha(colors.brand, 0.12)
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${h}${a}`;
}

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
