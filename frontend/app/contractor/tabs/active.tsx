import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, qk } from "@/src/api";
import { EmptyState } from "@/src/components/EmptyState";
import { ReportCard } from "@/src/components/ReportCard";
import { RoleSwitchButton } from "@/src/components/RoleSwitchButton";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SkeletonList } from "@/src/components/SkeletonList";
import { usesNativeTabs } from "@/src/navigation";
import { useSession } from "@/src/session";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function ContractorActive() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const session = useSession();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: qk.reports("contractor"),
    queryFn: () => api.reports({ contractorId: session?.contractor_id }),
    enabled: !!session?.contractor_id,
  });

  const active = useMemo(
    () => (data ?? []).filter((r) => ["assigned", "in_progress", "rework"].includes(r.status)),
    [data],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="My Jobs" subtitle={`${session?.name ?? "Contractor"} · approved crew`} right={<RoleSwitchButton />} />
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
            <EmptyState icon="construct" title="No active repair orders"             subtitle={isError ? "The service is temporarily unavailable. Refresh to try again." : "Jobs assigned by the Mayor Office will appear here with full location details."}
            actionTitle={isError ? "Retry" : undefined}
            onAction={isError ? () => refetch() : undefined} testID="contractor-active-empty" />
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
}));
