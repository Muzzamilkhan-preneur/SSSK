import { Text, View } from "react-native";

import { statusMeta } from "@/src/components/status-meta";
import { makeStyles, radius, fonts, withAlpha, useTheme } from "@/src/theme";
import type { ReportStatus } from "@/src/types";

export function StatusBadge({ status, testID }: { status: ReportStatus; testID?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const meta = statusMeta(status, colors);
  return (
    <View
      testID={testID ?? `status-badge-${status}`}
      style={[styles.badge, { backgroundColor: withAlpha(meta.color, 0.13), borderColor: withAlpha(meta.color, 0.28) }]}
    >
      <View style={[styles.dot, { backgroundColor: meta.color }]} />
      <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    height: 24,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
}));
