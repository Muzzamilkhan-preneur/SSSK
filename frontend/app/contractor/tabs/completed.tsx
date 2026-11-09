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
import { useSession } from "@/src/session";
import { makeStyles, spacing, useTheme } from "@/src/theme";

const FILTERS = [
  { key: "all", label: "All completed" },
  { key: "verified", label: "Fixed & verified" },
];

export default function ContractorCompleted() {
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

  const completed = useMemo(
    () => (data ?? []).filter((report) =>
      report.status === "verified" && (filter === "all" || report.status === filter)),
    [data, filter],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Completed Jobs"
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
          data={completed}
          keyExtractor={(report) => report.id}
          renderItem={({ item, index }) => (
            <ReportCard
              report={item}
              onPress={() => router.push(`/contractor/job/${item.id}`)}
              testID={`contractor-completed-card-${index}`}
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: bottomChrome + 24,
            gap: spacing.md,
          }}
          ListEmptyComponent={
            <EmptyState
              icon={isError ? "cloud-offline" : "checkmark-done"}
              title={isError ? "Could not load completed jobs" : "No completed jobs yet"}
              subtitle={isError ? "The service is temporarily unavailable. Refresh to try again." : "Jobs verified as complete will appear here."}
              actionTitle={isError ? "Retry" : undefined}
              onAction={isError ? () => refetch() : undefined}
              testID="contractor-completed-empty"
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => { refetch(); }}
              tintColor={colors.brandPrimary}
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  headerBottom: { gap: spacing.xs },
}));
