import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api, qk } from "@/src/api";
import { EmptyState } from "@/src/components/EmptyState";
import { FilterChipRowInteractive } from "@/src/components/FilterChips";
import { ReportCard } from "@/src/components/ReportCard";
import { RoleSwitchButton } from "@/src/components/RoleSwitchButton";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SkeletonList } from "@/src/components/SkeletonList";
import { STATUS_FILTERS } from "@/src/components/status-meta";
import { usesNativeTabs } from "@/src/navigation";
import { useSession } from "@/src/session";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function CitizenReports() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const session = useSession();
  const [filter, setFilter] = useState("all");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: qk.reports(`citizen-${session?.citizen_id}`),
    queryFn: () => api.reports({ citizenId: session?.citizen_id }),
    enabled: !!session?.citizen_id,
  });

  const filtered = useMemo(() => {
    const statuses = STATUS_FILTERS.find((f) => f.key === filter)?.statuses;
    return (data ?? []).filter((r) => !statuses || statuses.includes(r.status));
  }, [data, filter]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="My Reports"
        subtitle={`${session?.name ?? "Citizen"} · Verified citizen`}
        right={<RoleSwitchButton />}
        bottom={<FilterChipRowInteractive options={STATUS_FILTERS} value={filter} onChange={setFilter} />}
      />
      {isLoading || !session ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          renderItem={({ item, index }) => <ReportCard report={item} citizenId={session?.citizen_id} onPress={() => router.push(`/citizen/report/${item.id}`)} testID={`citizen-report-card-${index}`} />}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: bottomChrome + 96, gap: spacing.md }}
          ListEmptyComponent={
            <EmptyState
              icon={isError ? "cloud-offline" : "camera"}
              title={isError ? "Could not load reports" : filter === "all" ? "No reports yet" : "Nothing here yet"}
              subtitle={isError ? "The service is temporarily unavailable. Try again." : "Photograph a pothole and the AI will inspect it before it reaches the Mayor's office."}
              actionTitle={isError ? "Retry" : "Report a Pothole"}
              onAction={() => (isError ? refetch() : router.push("/citizen/new"))}
              testID="citizen-reports-empty"
            />
          }
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} tintColor={colors.brandPrimary} />}
        />
      )}
      <Pressable testID="new-report-fab" onPress={() => router.push("/citizen/new")} style={({ pressed }) => [styles.fab, { bottom: bottomChrome + 16 }, pressed && styles.fabPressed]}>
        <Ionicons name="add" size={26} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  fab: { position: "absolute", right: spacing.xl, width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", shadowColor: colors.surfaceInverse, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabPressed: { backgroundColor: colors.onBrandTertiary },
}));
