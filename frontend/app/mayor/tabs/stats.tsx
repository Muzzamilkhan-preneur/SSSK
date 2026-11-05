import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, qk } from "@/src/api";
import { Card, Kicker } from "@/src/components/Card";
import { RoleSwitchButton } from "@/src/components/RoleSwitchButton";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { ScoreBar } from "@/src/components/ScoreBar";
import { SkeletonList } from "@/src/components/SkeletonList";
import { severityMeta, statusMeta } from "@/src/components/status-meta";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { ReportStatus, Severity } from "@/src/types";

const SEVERITIES: Severity[] = ["minor", "moderate", "severe", "dangerous"];
const STATUSES: ReportStatus[] = ["pending_review", "assigned", "in_progress", "rework", "verified", "rejected"];

export default function MayorStats() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const { data: stats, isLoading } = useQuery({ queryKey: qk.stats, queryFn: api.stats });

  const header = <ScreenHeader title="City Stats" subtitle="Karachi Municipal Authority" right={<RoleSwitchButton />} />;
  if (isLoading || !stats) {
    return (
      <View style={styles.screen}>
        {header}
        <SkeletonList rows={4} />
      </View>
    );
  }
  const maxSev = Math.max(...SEVERITIES.map((s) => stats.by_severity[s] ?? 0), 1);
  const total = Math.max(stats.total, 1);

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.lg }}>
        <View style={styles.tiles}>
          {[
            { key: "total", label: "Total reports", value: stats.total },
            { key: "in-review", label: "Awaiting review", value: stats.by_status.pending_review },
            { key: "fixed", label: "Fixed", value: stats.fixed },
          ].map((t) => (
            <View key={t.key} style={styles.tile} testID={`kpi-${t.key}`}>
              <Text style={styles.tileValue}>{t.value}</Text>
              <Text style={styles.tileLabel}>{t.label}</Text>
            </View>
          ))}
        </View>

        <Card testID="repair-rate-card">
          <Kicker icon="trending-up">Repair rate</Kicker>
          <Text style={styles.rate}>{Math.round(stats.fixed_rate * 100)}%</Text>
          <Text style={styles.rateNote}>of reports repaired and verified by AI</Text>
          <ScoreBar value={stats.fixed_rate} color={colors.success} testID="repair-rate-bar" />
        </Card>

        <Card testID="severity-card">
          <Kicker icon="warning">Severity</Kicker>
          {SEVERITIES.map((s) => {
            const m = severityMeta(s, colors);
            return <BarRow key={s} label={m.label} value={stats.by_severity[s] ?? 0} max={maxSev} color={m.color} testID={`severity-bar-${s}`} />;
          })}
        </Card>

        <Card testID="workflow-card">
          <Kicker icon="git-network">Workflow</Kicker>
          {STATUSES.map((s) => {
            const m = statusMeta(s, colors);
            return <BarRow key={s} label={m.label} value={stats.by_status[s]} max={total} color={m.color} testID={`workflow-bar-${s}`} />;
          })}
        </Card>
      </ScrollView>
    </View>
  );
}

function BarRow({ label, value, max, color, testID }: { label: string; value: number; max: number; color: string; testID: string }) {
  const styles = useStyles();
  return (
    <View style={styles.barRow} testID={testID}>
      <Text style={styles.barLabel}>{label}</Text>
      <ScoreBar value={value / max} color={color} />
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  tiles: { flexDirection: "row", gap: spacing.sm },
  tile: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  tileValue: { fontFamily: fonts.display, fontSize: 26, color: colors.onSurface },
  tileLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  rate: { fontFamily: fonts.display, fontSize: 40, color: colors.onSurface, letterSpacing: -1.2 },
  rateNote: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, marginTop: -spacing.sm },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  barLabel: { width: 112, fontFamily: fonts.medium, fontSize: 12.5, color: colors.onSurfaceTertiary },
  barValue: { width: 24, textAlign: "right", fontFamily: fonts.bold, fontSize: 13, color: colors.onSurface },
}));
