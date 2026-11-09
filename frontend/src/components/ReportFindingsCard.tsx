import { Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Card, Kicker } from "@/src/components/Card";
import { SeverityChip } from "@/src/components/SeverityChip";
import { fonts, makeStyles, spacing, useTheme } from "@/src/theme";
import type { Finding, Severity } from "@/src/types";

export function ReportFindingsCard({
  findings,
  severity,
  testID = "report-ai-findings",
}: {
  findings: Finding[];
  severity?: Severity | null;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <Card testID={testID}>
      <Kicker icon="sparkles">What the AI saw</Kicker>
      {severity ? (
        <View style={styles.severityRow}>
          <Text style={styles.severityLabel}>Severity</Text>
          <SeverityChip severity={severity} testID="inspection-severity" />
        </View>
      ) : null}
      {findings.length ? (
        <View style={styles.findingsList}>
          {findings.map((finding) => (
            <View key={finding.key} style={styles.findingRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.brandPrimary} />
              <Text style={styles.findingText}>{finding.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  severityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  severityLabel: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.onSurface,
  },
  findingsList: { gap: spacing.md },
  findingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  findingText: { flex: 1, fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.onSurface },
}));
