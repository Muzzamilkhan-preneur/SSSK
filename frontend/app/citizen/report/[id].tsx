import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api, qk } from "@/src/api";
import { ReportBody } from "@/src/components/ReportBody";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { StatusBadge } from "@/src/components/StatusBadge";
import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";

export default function ReportDetail() {
  const { id, merged } = useLocalSearchParams<{ id: string; merged?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const { data: report, isLoading } = useQuery({ queryKey: qk.report(String(id)), queryFn: () => api.report(String(id)), enabled: !!id });
  const back = () => (router.canGoBack() ? router.back() : router.replace("/citizen/tabs/reports"));

  if (isLoading || !report) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Report" onBack={back} />
        <ActivityIndicator style={{ marginTop: spacing.xxxl }} color={colors.brandPrimary} testID="report-detail-loading" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Report" subtitle={new Date(report.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} onBack={back} right={<StatusBadge status={report.status} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        {merged ? (
          <View style={styles.merged} testID="merged-banner">
            <Ionicons name="people" size={18} color={colors.info} />
            <Text style={styles.mergedText}>
              Already reported. You&apos;ve been added. {report.reporter_count} citizens have reported this pothole.
            </Text>
          </View>
        ) : null}
        <ReportBody report={report} />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  merged: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: withAlpha(colors.info, 0.4), backgroundColor: withAlpha(colors.info, 0.08), borderRadius: radius.md, padding: spacing.md },
  mergedText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 19, color: colors.onSurface },
}));
