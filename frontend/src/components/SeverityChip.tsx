import { Text, View } from "react-native";

import { severityMeta } from "@/src/components/status-meta";
import { makeStyles, radius, fonts, withAlpha, useTheme } from "@/src/theme";
import type { Severity } from "@/src/types";

export function SeverityChip({ severity, testID }: { severity: Severity; testID?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const meta = severityMeta(severity, colors);
  return (
    <View
      testID={testID ?? `severity-chip-${severity}`}
      style={[styles.chip, { backgroundColor: withAlpha(meta.color, 0.13), borderColor: withAlpha(meta.color, 0.28) }]}
    >
      <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
}));
