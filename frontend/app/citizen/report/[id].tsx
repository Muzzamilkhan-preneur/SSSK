import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, ReduceMotion, useReducedMotion } from "react-native-reanimated";

import { api, qk } from "@/src/api";
import { EmptyState } from "@/src/components/EmptyState";
import { ReportBody } from "@/src/components/ReportBody";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function ReportDetail() {
  const { id, merged, already } = useLocalSearchParams<{ id: string; merged?: string; already?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const { data: report, isLoading, isError, refetch } = useQuery({ queryKey: qk.report(String(id)), queryFn: () => api.report(String(id)), enabled: !!id });
  const back = () => (router.canGoBack() ? router.back() : router.replace("/citizen/tabs/reports"));

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Report" onBack={back} />
        <ActivityIndicator style={{ marginTop: spacing.xxxl }} color={colors.brandPrimary} testID="report-detail-loading" />
      </View>
    );
  }
  if (isError || !report) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Report" onBack={back} />
        <EmptyState
          icon="cloud-offline"
          title="Could not load this report"
          subtitle="The service is temporarily unavailable. Try again."
          actionTitle="Retry"
          onAction={() => { refetch(); }}
          testID="report-detail-error"
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Report" subtitle={new Date(report.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} onBack={back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <Animated.View entering={FadeIn.duration(reduceMotion ? 0 : 240).reduceMotion(ReduceMotion.System)}>
          <ReportBody
            report={report}
            communityCount={report.reporter_count}
            communityNotice={
              merged
                ? already
                  ? "You’re already a contributor to this report."
                  : "This location already has a report. You have been added as a contributor. The AI assessment is based on the original photo."
                : undefined
            }
            animated
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
}));
