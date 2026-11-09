import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, qk } from "@/src/api";
import { EmptyState } from "@/src/components/EmptyState";
import { FilterChipRowInteractive } from "@/src/components/FilterChips";
import { ReportCard } from "@/src/components/ReportCard";
import { RoleSwitchButton } from "@/src/components/RoleSwitchButton";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SkeletonList } from "@/src/components/SkeletonList";
import { VerifiedCrewBadge } from "@/src/components/VerifiedCrewBadge";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { useSession } from "@/src/session";

const FILTERS = [
  { key: "all", label: "All active" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "rework", label: "Rework" },
];

export default function ContractorActive() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const session = useSession();
  const [filter, setFilter] = useState("all");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: qk.reports("contractor"),
    queryFn: () => api.reports({ contractorId: session?.contractor_id }),
    enabled: !!session?.contractor_id,
  });
  const { data: contractors } = useQuery({
    queryKey: qk.contractors,
    queryFn: api.contractors,
  });
  const crew = contractors?.find((contractor) => contractor.id === session?.contractor_id);

  const active = useMemo(() => (data ?? []).filter((r) =>
    ["assigned", "in_progress", "rework"].includes(r.status) &&
    (filter === "all" || r.status === filter)), [data, filter]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="My Jobs"
        subtitle={session?.name ?? "Contractor"}
        right={<RoleSwitchButton />}
        bottom={
          <View style={styles.headerBottom}>
            {crew?.is_verified ? <VerifiedCrewBadge /> : null}
            <FilterChipRowInteractive options={FILTERS} value={filter} onChange={setFilter} />
          </View>
        }
      />
      {isLoading || !session?.contractor_id ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={active}
          keyExtractor={(r) => r.id}
          renderItem={({ item, index }) => (
            <ReportCard report={item} onPress={() => router.push(`/contractor/job/${item.id}`)} testID={`contractor-job-card-${index}`} />
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: bottomChrome + 24, gap: spacing.md }}
          ListEmptyComponent={
            <EmptyState
              icon={isError ? "cloud-offline" : "construct"}
              title={isError ? "Could not load jobs" : "No active repair orders"}
              subtitle={isError ? "The service is temporarily unavailable. Refresh to try again." : "Jobs assigned by the Mayor Office will appear here with full location details."}
              actionTitle={isError ? "Retry" : undefined}
              onAction={isError ? () => refetch() : undefined}
              testID="contractor-active-empty"
            />
          }
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} tintColor={colors.brandPrimary} />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  headerBottom: { gap: spacing.xs },
}));
