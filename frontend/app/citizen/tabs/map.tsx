import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, qk } from "@/src/api";
import { AppMap } from "@/src/components/AppMap";
import { EmptyState } from "@/src/components/EmptyState";
import { FilterChipRowInteractive } from "@/src/components/FilterChips";
import { ReportCard } from "@/src/components/ReportCard";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SkeletonList } from "@/src/components/SkeletonList";
import { KARACHI_CENTER, STATUS_FILTERS } from "@/src/components/status-meta";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import type { Report } from "@/src/types";

export default function CityMap() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const listRef = useRef<FlatList<Report>>(null);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({ queryKey: qk.reports("all"), queryFn: () => api.reports() });

  const reports = useMemo(() => {
    const statuses = STATUS_FILTERS.find((f) => f.key === filter)?.statuses;
    return (data ?? []).filter((r) => r.status !== "rejected" && (!statuses || statuses.includes(r.status)));
  }, [data, filter]);

  const focus = reports.find((r) => r.id === selectedId) ?? null;
  const center = focus ?? KARACHI_CENTER;

  const onPin = (id: string) => {
    setSelectedId(id);
    const index = reports.findIndex((r) => r.id === id);
    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="City Map"
        subtitle={`${reports.length} report${reports.length === 1 ? "" : "s"} across Karachi`}
        bottom={<FilterChipRowInteractive options={STATUS_FILTERS} value={filter} onChange={(k) => { setFilter(k); setSelectedId(null); }} />}
      />
      <AppMap
        lat={center.lat}
        lng={center.lng}
        markers={reports.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, status: r.status }))}
        selectedId={selectedId}
        pannable
        onMarkerPress={onPin}
        height={250}
        testID="city-map"
      />
      {isLoading ? (
        <SkeletonList rows={3} />
      ) : (
        <FlatList
          ref={listRef}
          data={reports}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <ReportCard report={item} selected={item.id === selectedId} onPress={() => (item.id === selectedId ? router.push(`/citizen/report/${item.id}`) : setSelectedId(item.id))} testID={`map-report-${item.id}`} />}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); }} tintColor={colors.brandPrimary} />}
          onScrollToIndexFailed={() => {}}
          ListEmptyComponent={
            <EmptyState
              icon={isError ? "cloud-offline" : "map"}
              title={isError ? "Could not load reports" : "No reports in this view"}
              subtitle={isError ? "The service is temporarily unavailable. Try again." : "Try another filter to see more of the city."}
              actionTitle={isError ? "Retry" : undefined}
              onAction={isError ? () => refetch() : undefined}
              testID="map-empty"
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
}));
