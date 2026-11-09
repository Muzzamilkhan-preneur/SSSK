import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { api, qk } from "@/src/api";
import { Card, Kicker } from "@/src/components/Card";
import { CheckProgress } from "@/src/components/CheckProgress";
import { PhotoActions } from "@/src/components/PhotoActions";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { ReportBody } from "@/src/components/ReportBody";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { StatusBadge } from "@/src/components/StatusBadge";
import { fonts, makeStyles, spacing, useTheme } from "@/src/theme";
import type { LocalFile } from "@/src/utils/upload";

const STEPS = [
  { key: "same_spot", label: "Same spot as the report" },
  { key: "filled", label: "Pothole filled" },
  { key: "level", label: "Surface level with the road" },
];

export default function ContractorJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useQuery({ queryKey: qk.report(String(id)), queryFn: () => api.report(String(id)), enabled: !!id });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.report(String(id)) });
    await queryClient.invalidateQueries({ queryKey: ["reports"] });
    await queryClient.invalidateQueries({ queryKey: qk.stats });
  };

  const start = useMutation({ mutationFn: () => api.startRepair(String(id)), onSuccess: refresh });
  const proof = useMutation({
    mutationFn: (file: LocalFile) => api.completeRepair(String(id), file),
    onSuccess: async (r) => {
      Haptics.notificationAsync(r.verification?.verified ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
      await refresh();
    },
  });

  if (isLoading || !report) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Repair Order" onBack={() => (router.canGoBack() ? router.back() : router.replace("/contractor/tabs/active"))} />
        <ActivityIndicator style={{ marginTop: spacing.xxxl }} color={colors.brandPrimary} testID="job-loading" />
      </View>
    );
  }
  const canUpload = report.status === "in_progress" || report.status === "rework";

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Repair Order" subtitle={report.address ?? "Karachi"} onBack={() => (router.canGoBack() ? router.back() : router.replace("/contractor/tabs/active"))} right={<StatusBadge status={report.status} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <ReportBody report={report} communityCount={report.reporter_count}>
          {report.status === "assigned" ? (
            <PrimaryButton title="Start Repair" icon="play" testID="start-repair-btn" loading={start.isPending} onPress={() => start.mutate()} />
          ) : null}
          {canUpload ? (
            <Animated.View entering={FadeIn.duration(200)}>
              <Card testID="proof-upload-card">
                <Kicker icon="camera">Upload repair proof</Kicker>
                <Text style={styles.help}>Photograph the same spot from a similar angle. AI compares it with the citizen&apos;s photo before the report is marked fixed.</Text>
                {proof.isPending ? <CheckProgress title="AI repair check" steps={STEPS} pending results={null} testID="repair-check" /> : null}
                {proof.isError ? <Text style={styles.err} testID="proof-error">{proof.error.message}</Text> : null}
                {!proof.isPending ? <PhotoActions onPicked={(f) => proof.mutate(f)} cameraTitle={report.status === "rework" ? "Retake Proof" : "Proof Photo"} galleryTitle="From Gallery" /> : null}
              </Card>
            </Animated.View>
          ) : null}
        </ReportBody>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  help: { fontFamily: fonts.text, fontSize: 13.5, lineHeight: 19, color: colors.onSurfaceTertiary },
  err: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },
}));
