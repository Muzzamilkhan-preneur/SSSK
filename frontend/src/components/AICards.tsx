import { Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion, useReducedMotion } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Card, Kicker } from "@/src/components/Card";
import { SeverityChip } from "@/src/components/SeverityChip";
import { fonts, makeStyles, spacing, useTheme, withAlpha } from "@/src/theme";
import type { Finding, Severity, Verification } from "@/src/types";

export function FindingsList({
  findings,
  testID = "findings-list",
  animated = false,
}: {
  findings: Finding[];
  testID?: string;
  animated?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.list} testID={testID}>
      {findings.map((f, index) => {
        const yes = f.probability >= 0.5;
        const color = yes ? colors.onSurface : colors.muted;
        return (
          <Animated.View
            key={f.key}
            entering={animated
              ? FadeIn.duration(reduceMotion ? 0 : 220)
                .delay(reduceMotion ? 0 : Math.min(index, 3) * 70)
                .reduceMotion(ReduceMotion.System)
              : undefined}
            style={styles.row}
            testID={`finding-${f.key}`}
          >
            <Ionicons
              name={yes ? "checkmark-circle" : "remove-circle-outline"}
              size={16}
              color={yes ? colors.brandPrimary : colors.border}
            />
            <Text style={[styles.label, { color }]} numberOfLines={2}>
              {f.label}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

type InspectionProps = {
  severity?: Severity | null;
  findings: Finding[];
  testID?: string;
  animated?: boolean;
};

export function InspectionCard({ severity, findings, testID = "ai-inspection-card", animated = false }: InspectionProps) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={animated ? FadeIn.duration(reduceMotion ? 0 : 240).reduceMotion(ReduceMotion.System) : undefined}
    >
      <Card testID={testID}>
        <View style={styles.head}>
          <Kicker icon="sparkles">What the AI saw</Kicker>
        </View>
        {severity ? (
          <View style={styles.sevRow}>
            <Text style={styles.sevLabel}>Severity</Text>
            <SeverityChip severity={severity} testID="inspection-severity" />
          </View>
        ) : null}
        {findings.length ? <FindingsList findings={findings} animated={animated} /> : null}
      </Card>
    </Animated.View>
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
