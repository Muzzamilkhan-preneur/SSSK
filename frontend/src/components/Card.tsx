import Ionicons from "@react-native-vector-icons/ionicons";
import { Text, View } from "react-native";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function Card({ children, style, testID }: { children: React.ReactNode; style?: object; testID?: string }) {
  const styles = useStyles();
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Kicker({ children, icon }: { children: React.ReactNode; icon?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.kickerRow}>
      {icon ? <Ionicons name={icon as never} size={13} color={colors.brandPrimary} /> : null}
      <Text style={styles.kicker}>{children}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kicker: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
  },
}));
