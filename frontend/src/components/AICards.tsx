import { Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Card, Kicker } from "@/src/components/Card";
import { ScoreBar } from "@/src/components/ScoreBar";
import { SeverityChip } from "@/src/components/SeverityChip";
import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";
import type { Finding, Severity, Verification } from "@/src/types";

// Confidence checklist: each finding with a probability bar.
export function FindingsList({ findings, testID = "findings-list" }: { findings: Finding[]; testID?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.list} testID={testID}>
      {findings.map((f) => {
        const yes = f.probability >= 0.5;
        const color = yes ? colors.onSurface : colors.muted;
        return (
          <View key={f.key} style={styles.row} testID={`finding-${f.key}`}>
            <Ionicons name={yes ? "checkmark-circle" : "remove-circle-outline"} size={16} color={yes ? colors.brandPrimary : colors.border} />
            <Text style={[styles.label, { color }]} numberOfLines={2}>
              {f.label}
            </Text>
            <View style={styles.bar}>
              <ScoreBar value={f.probability} color={yes ? colors.onSurfaceSecondary : colors.border} />
            </View>
            <Text style={styles.pct}>{Math.round(f.probability * 100)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

export function NeedsReviewTag() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.reviewTag} testID="needs-review-tag">
      <Ionicons name="eye" size={12} color={colors.info} />
      <Text style={styles.reviewText}>Needs Mayor review</Text>
    </View>
  );
}

type InspectionProps = {
  severity?: Severity | null;
  severityConfidence?: number | null;
  findings: Finding[];
  needsReview?: boolean;
  testID?: string;
};

export function InspectionCard({ severity, severityConfidence, findings, needsReview, testID = "ai-inspection-card" }: InspectionProps) {
  const styles = useStyles();
  return (
    <Card testID={testID}>
      <View style={styles.head}>
        <Kicker icon="sparkles">What the AI saw</Kicker>
        {needsReview ? <NeedsReviewTag /> : null}
      </View>
      {severity ? (
        <View style={styles.sevRow}>
          <Text style={styles.sevLabel}>Severity</Text>
          <SeverityChip severity={severity} testID="inspection-severity" />
          {severityConfidence != null ? <Text style={styles.sevConf}>{Math.round(severityConfidence * 100)}% confident</Text> : null}
        </View>
      ) : null}
      {findings.length ? <FindingsList findings={findings} /> : null}
    </Card>
  );
}

export function VerificationCard({ verification, testID = "verification-card" }: { verification: Verification; testID?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const ok = verification.verified;
  const tone = ok ? colors.success : colors.error;
  return (
    <Card testID={testID} style={{ borderColor: withAlpha(tone, 0.45) }}>
      <View style={styles.head}>
        <Kicker icon="shield-checkmark">AI repair check</Kicker>
        <Text style={[styles.verdict, { color: tone }]} testID="verification-verdict">
          {ok ? "Repair confirmed" : "Rework needed"}
        </Text>
      </View>
      <Text style={styles.reason}>{verification.reason}</Text>
      {verification.checks?.length ? <FindingsList findings={verification.checks} testID="verification-checks" /> : null}
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  bar: {
    width: 64,
    flexDirection: "row",
  },
  pct: {
    width: 38,
    textAlign: "right",
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sevRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sevLabel: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.onSurface,
  },
  sevConf: {
    marginLeft: "auto",
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
  reviewTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    height: 24,
    backgroundColor: withAlpha(colors.info, 0.1),
  },
  reviewText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.info,
  },
  verdict: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  reason: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
  },
}));
