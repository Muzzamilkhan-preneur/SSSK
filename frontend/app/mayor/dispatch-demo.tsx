import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api } from "@/src/api";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { DispatchDemoGroup, DispatchDemoResult } from "@/src/types";

const CATEGORY_LABELS: Record<DispatchDemoGroup["category"], string> = {
  road_damage: "Road repair",
  garbage_dump: "Illegal waste dump",
  drainage: "Drainage / manhole",
  other: "Other · review",
};

const PRIORITY_COLORS: Record<DispatchDemoGroup["priority"], "error" | "warning" | "info" | "muted"> = {
  critical: "error",
  high: "warning",
  medium: "info",
  low: "muted",
};

function dispatchErrorMessage(message: string): string {
  switch (message) {
    case "AI_AUTH_ERROR":
      return "The AI service is not configured. Add its API key on the backend, then retry.";
    case "AI_RATE_LIMITED":
      return "The AI service is busy. Wait a moment before retrying.";
    case "AI_NETWORK_ERROR":
    case "AI_PROVIDER_ERROR":
      return "The AI service could not be reached. No reports were changed; try again shortly.";
    case "AI_INVALID_RESPONSE":
    case "DISPATCH_INVALID_RESPONSE":
      return "The AI returned an incomplete or invalid grouping. Nothing was changed; retry the demo.";
    case "DISPATCH_DEMO_UNAVAILABLE":
      return "The dispatch demo is temporarily unavailable. Try again shortly.";
    default:
      return message;
  }
}

export default function DispatchDemo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const run = useMutation({ mutationFn: api.runDispatchDemo });
  const result = run.data;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="AI Dispatch Demo"
        subtitle="Synthetic 100-report simulation"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/mayor/tabs/queue"))}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <View style={styles.notice} testID="dispatch-demo-safety-note">
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={styles.noticeText}>
            Demo only: each run sends generated synthetic reports to the configured AI provider and uses one billable model request. It does not read or change Firestore reports, and crew suggestions do not assign real jobs. Token counts are shown; charges depend on the configured model and its current rates.
          </Text>
        </View>

        <View style={styles.intro}>
          <Text style={styles.sectionTitle}>One run, one review-ready queue</Text>
          <Text style={styles.body}>
            The agent groups reports about the same incident, recommends a priority and next action, then balances suggestions across simulated crews. Its groupings are scored against hidden synthetic labels.
          </Text>
          <PrimaryButton
            title={result ? "Run demo again" : "Run AI dispatch"}
            icon="git-network"
            loading={run.isPending}
            onPress={() => run.mutate()}
            testID="dispatch-demo-run"
          />
          {run.isPending ? (
            <View style={styles.progress} testID="dispatch-demo-loading">
              <ActivityIndicator size="small" color={colors.brandPrimary} />
              <Text style={styles.body}>Analyzing 100 reports and preparing grouped recommendations…</Text>
            </View>
          ) : null}
          {run.isError ? (
            <View style={styles.error} testID="dispatch-demo-error">
              <Text style={styles.errorText}>{dispatchErrorMessage(run.error.message)}</Text>
              <Text style={styles.body}>No reports were changed. Check the AI service configuration and retry.</Text>
            </View>
          ) : null}
        </View>

        {result ? <Results result={result} /> : null}
      </ScrollView>
    </View>
  );
}

function Results({ result }: { result: DispatchDemoResult }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const metrics = result.metrics;

  return (
    <View style={styles.results} testID="dispatch-demo-results">
      <View style={styles.resultHeading}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={styles.sectionTitle}>Simulation results</Text>
          <Text style={styles.muted}>
            {result.report_count} reports · {result.model} · {(result.inference_ms / 1000).toFixed(1)}s{result.cached ? " · cached result" : ""}
          </Text>
        </View>
        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
      </View>

      <View style={styles.metrics}>
        <Metric label="Incidents found" value={`${metrics.predicted_incidents} / ${metrics.expected_incidents}`} />
        <Metric label="Exact incident match" value={`${Math.round(metrics.exact_incident_accuracy * 100)}%`} />
        <Metric label="Pairwise F1" value={`${Math.round(metrics.pairwise_f1 * 100)}%`} />
        <Metric label="API tokens" value={result.token_usage ? result.token_usage.total_tokens.toLocaleString() : "Unavailable"} />
      </View>
      <Text style={styles.muted}>
        Pairwise precision {Math.round(metrics.pairwise_precision * 100)}% · recall {Math.round(metrics.pairwise_recall * 100)}%
        {result.token_usage ? ` · ${result.token_usage.input_tokens.toLocaleString()} in / ${result.token_usage.output_tokens.toLocaleString()} out` : ""}
      </Text>
      {result.cached ? (
        <Text style={styles.muted}>Reusing the last result for 5 minutes to avoid another model charge.</Text>
      ) : null}

      <Text style={styles.sectionTitle}>Simulated crew workload</Text>
      <View style={styles.workload}>
        {result.crew_workload.map((crew) => (
          <View key={crew.id} style={styles.workloadRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.cardTitle}>{crew.name}</Text>
              <Text style={styles.muted}>{crew.specialty}</Text>
            </View>
            <Text style={styles.workloadCount}>{crew.assigned_groups} / {crew.capacity}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Prioritized incident groups</Text>
      {result.groups.map((group) => {
        const priorityColor = colors[PRIORITY_COLORS[group.priority]];
        const reportNumbers = group.report_ids
          .map((id) => id.replace("synthetic-report-", "#"))
          .join(", ");
        return (
          <View key={group.id} style={styles.groupCard} testID={`dispatch-group-${group.id}`}>
            <View style={styles.groupHeading}>
              <View style={styles.groupNumber}>
                <Text style={styles.groupNumberText}>{group.report_ids.length}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.category}>{CATEGORY_LABELS[group.category]}</Text>
                <Text style={[styles.priority, { color: priorityColor }]}>{group.priority.toUpperCase()} PRIORITY</Text>
              </View>
              {group.demo_crew ? (
                <Ionicons name="construct" size={17} color={colors.brandPrimary} />
              ) : (
                <Ionicons name="alert-circle" size={17} color={colors.warning} />
              )}
            </View>
            <Text style={styles.cardTitle}>{group.summary}</Text>
            <Text style={styles.body}>{group.recommended_action}</Text>
            <Text style={styles.muted}>{group.reports[0]?.address}</Text>
            <Text style={styles.reportIds}>Reports {reportNumbers}</Text>
            <View style={styles.assignment}>
              <Text style={styles.assignmentLabel}>
                {group.assignment_status === "suggested" ? "Simulated crew suggestion" : "Needs manual review"}
              </Text>
              {group.demo_crew ? <Text style={styles.assignmentValue}>{group.demo_crew.name}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary },
  noticeText: { flex: 1, fontFamily: fonts.text, fontSize: 12, lineHeight: 18, color: colors.onSurfaceSecondary },
  intro: { gap: spacing.md },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onSurface },
  body: { fontFamily: fonts.text, fontSize: 13, lineHeight: 19, color: colors.onSurfaceSecondary },
  progress: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  error: { borderWidth: 1, borderColor: colors.error, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  errorText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error },
  results: { gap: spacing.md },
  resultHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  muted: { fontFamily: fonts.text, fontSize: 11, lineHeight: 16, color: colors.muted },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: { minWidth: "47%", flexGrow: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  metricValue: { fontFamily: fonts.display, fontSize: 20, color: colors.onSurface },
  metricLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  workload: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  workloadRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  workloadCount: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  groupCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  groupHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  groupNumber: { width: 30, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary },
  groupNumberText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onBrandTertiary },
  category: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurface },
  priority: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.3 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurface },
  reportIds: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, color: colors.muted },
  assignment: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm, gap: 2 },
  assignmentLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.muted },
  assignmentValue: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onSurface },
}));
