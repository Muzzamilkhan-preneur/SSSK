import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api, qk } from "@/src/api";
import { EmptyState } from "@/src/components/EmptyState";
import { FilterChipRowInteractive } from "@/src/components/FilterChips";
import { ReportCard } from "@/src/components/ReportCard";
import { RoleSwitchButton } from "@/src/components/RoleSwitchButton";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SkeletonList } from "@/src/components/SkeletonList";
import { SEVERITY_RANK, STATUS_FILTERS } from "@/src/components/status-meta";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const FILTERS = [...STATUS_FILTERS, { key: "fake", label: "Fake", statuses: ["rejected" as const] }];

export default function MayorQueue() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [filter, setFilter] = useState("review");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({ queryKey: qk.reports("mayor"), queryFn: () => api.reports() });
  const { data: stats } = useQuery({ queryKey: qk.stats, queryFn: api.stats });

  const filtered = useMemo(() => {
    const statuses = FILTERS.find((f) => f.key === filter)?.statuses;
    const reports = (data ?? [])
      .filter((r) => !statuses || (statuses as string[]).includes(r.status))
      .sort((a, b) => filter === "all"
        ? Date.parse(b.created_at) - Date.parse(a.created_at)
        : (SEVERITY_RANK[b.severity ?? "minor"] - SEVERITY_RANK[a.severity ?? "minor"]) || b.reporter_count - a.reporter_count);
    return reports;
  }, [data, filter]);

  const tiles = [
    { key: "review", label: "Awaiting review", value: stats?.by_status.pending_review ?? 0 },
    { key: "progress", label: "In progress", value: stats ? stats.by_status.assigned + stats.by_status.in_progress + stats.by_status.rework : 0 },
    { key: "fixed", label: "Fixed", value: stats?.by_status.verified ?? 0 },
  ];

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Review Queue"
        subtitle="Karachi Metropolitan Corporation"
        right={<RoleSwitchButton />}
        bottom={
          <View style={styles.headerStack}>
            <View style={styles.tiles} testID="mayor-stats-banner">
              {tiles.map((t) => (
                <View key={t.key} style={styles.tile} testID={`stat-${t.key}`}>
                  <Text style={styles.tileValue}>{t.value}</Text>
                  <Text style={styles.tileLabel}>{t.label}</Text>
                </View>
              ))}
            </View>
            <FilterChipRowInteractive options={FILTERS} value={filter} onChange={setFilter} />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/mayor/dispatch-demo")}
              style={({ pressed }) => [styles.demoLink, pressed && styles.demoLinkPressed]}
              testID="mayor-dispatch-demo-link"
            >
              <Ionicons name="git-network" size={18} color={colors.brandPrimary} />
              <View style={styles.demoLinkCopy}>
                <Text style={styles.demoLinkTitle}>Try AI dispatch demo</Text>
                <Text style={styles.demoLinkSubtitle}>100 synthetic reports · no live reports changed</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          </View>
        }
      />
      {isLoading ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          renderItem={({ item, index }) => <ReportCard report={item} onPress={() => router.push(`/mayor/review/${item.id}`)} testID={`mayor-report-card-${index}`} />}
          ListEmptyComponent={
            <EmptyState
              icon={isError ? "cloud-offline" : "shield-checkmark"}
              title={isError ? "Could not load review queue" : "Queue is clear"}
              subtitle={isError ? "The service is temporarily unavailable. Refresh to try again." : "New citizen reports will appear here for your decision."}
              actionTitle={isError ? "Retry" : undefined}
              onAction={isError ? () => refetch() : undefined}
              testID="mayor-queue-empty"
            />
          }
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} tintColor={colors.brandPrimary} />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  headerStack: { gap: spacing.md },
  tiles: { flexDirection: "row", gap: spacing.sm },
  tile: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, gap: 2 },
  tileValue: { fontFamily: fonts.display, fontSize: 24, color: colors.onSurface },
  tileLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted },
  demoLink: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  demoLinkPressed: { backgroundColor: colors.surfaceSecondary },
  demoLinkCopy: { flex: 1, gap: 2 },
  demoLinkTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurface },
  demoLinkSubtitle: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
}));
