import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: qk.reports("mayor"), queryFn: () => api.reports() });
  const { data: stats } = useQuery({ queryKey: qk.stats, queryFn: api.stats });

  // Most dangerous and most-reported first.
  const filtered = useMemo(() => {
    const statuses = FILTERS.find((f) => f.key === filter)?.statuses;
    return (data ?? [])
      .filter((r) => !statuses || (statuses as string[]).includes(r.status))
      .sort((a, b) => (SEVERITY_RANK[b.severity ?? "minor"] - SEVERITY_RANK[a.severity ?? "minor"]) || b.reporter_count - a.reporter_count);
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
        subtitle="Karachi Municipal Authority"
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
          ListEmptyComponent={<EmptyState icon="shield-checkmark" title="Queue is clear" subtitle="New citizen reports will appear here for your decision." testID="mayor-queue-empty" />}
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
}));
