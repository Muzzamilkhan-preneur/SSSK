import Ionicons from "@react-native-vector-icons/ionicons";
import { Text, View } from "react-native";

import { fonts, makeStyles, spacing, useTheme } from "@/src/theme";

export function VerifiedCrewBadge() {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.badge} accessibilityLabel="Verified demo crew">
      <Ionicons name="checkmark-circle" size={16} color={colors.brandPrimary} />
      <Text style={styles.label}>Verified demo crew</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  badge: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  label: { fontFamily: fonts.semibold, fontSize: 11, color: colors.brandPrimary },
}));
