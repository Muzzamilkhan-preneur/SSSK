import Ionicons from "@react-native-vector-icons/ionicons";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Props = {
  title: string;
  onPress: () => void;
  icon?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  small?: boolean;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: object;
};

export function PrimaryButton({
  title,
  onPress,
  icon,
  variant = "primary",
  small = false,
  loading = false,
  disabled = false,
  testID,
  style,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const inactive = disabled || loading;
  const palette = {
    primary: { backgroundColor: colors.brandPrimary, color: colors.onBrandPrimary },
    secondary: { backgroundColor: colors.surfaceSecondary, color: colors.onSurface },
    ghost: { backgroundColor: "transparent", color: colors.onSurface },
    danger: { backgroundColor: colors.error, color: colors.onError },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        small ? styles.small : null,
        { backgroundColor: palette.backgroundColor, opacity: pressed || inactive ? 0.65 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.color} size="small" /> : null}
      {!loading && icon ? <Ionicons name={icon as never} size={small ? 16 : 18} color={palette.color} /> : null}
      <Text style={[styles.label, small ? styles.smallLabel : null, { color: palette.color }]}>{title}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  small: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  smallLabel: {
    fontSize: 13,
  },
}));
