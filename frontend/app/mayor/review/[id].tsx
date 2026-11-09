import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api, qk } from "@/src/api";
import { BottomSheet } from "@/src/components/BottomSheet";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { ReportBody } from "@/src/components/ReportBody";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { StatusBadge } from "@/src/components/StatusBadge";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { Contractor } from "@/src/types";

export default function ReviewReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [fakeOpen, setFakeOpen] = useState(false);
  const [fakeNote, setFakeNote] = useState("");

  const { data: report, isLoading } = useQuery({ queryKey: qk.report(String(id)), queryFn: () => api.report(String(id)), enabled: !!id });
  const { data: contractors } = useQuery({ queryKey: qk.contractors, queryFn: api.contractors });

  const review = useMutation({
    mutationFn: (input: { verdict: "genuine" | "fake"; contractorId?: string; note?: string }) => api.review(String(id), input.verdict, input.contractorId, input.note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await queryClient.invalidateQueries({ queryKey: qk.stats });
      await queryClient.invalidateQueries({ queryKey: qk.report(String(id)) });
      setAssignOpen(false);
      setFakeOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace("/mayor/tabs/queue");
    },
  });

  if (isLoading || !report) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Review" onBack={() => (router.canGoBack() ? router.back() : router.replace("/mayor/tabs/queue"))} />
        <ActivityIndicator style={{ marginTop: spacing.xxxl }} color={colors.brandPrimary} testID="review-loading" />
      </View>
    );
  }
  const pending = report.status === "pending_review";

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Review" subtitle={report.address ?? "Karachi"} onBack={() => (router.canGoBack() ? router.back() : router.replace("/mayor/tabs/queue"))} right={<StatusBadge status={report.status} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: insets.bottom + (pending ? 120 : spacing.xl), gap: spacing.lg }}>
        <ReportBody report={report} communityCount={report.reporter_count}>
          {!pending && report.contractor_name ? (
            <View style={styles.assigned} testID="assignment-card">
              <Ionicons name="construct" size={16} color={colors.onSurfaceTertiary} />
              <Text style={styles.assignedText}>Assigned to {report.contractor_name}</Text>
            </View>
          ) : null}
        </ReportBody>
      </ScrollView>

      {pending ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]} testID="review-footer">
          <PrimaryButton title="Mark Fake" icon="close-circle" variant="secondary" testID="review-fake-btn" onPress={() => setFakeOpen(true)} style={{ flex: 1 }} />
          <PrimaryButton title="Genuine · Assign" icon="checkmark-circle" testID="review-genuine-btn" onPress={() => setAssignOpen(true)} style={{ flex: 1.3 }} />
        </View>
      ) : null}

      <BottomSheet visible={assignOpen} onClose={() => setAssignOpen(false)} title="Assign a contractor" testID="assign-contractor-sheet">
        <View style={styles.list}>
          {(contractors ?? []).map((c: Contractor) => (
            <Pressable key={c.id} testID={`contractor-row-${c.id}`} disabled={review.isPending} onPress={() => review.mutate({ verdict: "genuine", contractorId: c.id })} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.rowSub}>{c.specialty} · {c.completed_jobs} jobs</Text>
              </View>
              <Ionicons name="star" size={12} color={colors.warning} />
              <Text style={styles.rating}>{c.rating.toFixed(1)}</Text>
            </Pressable>
          ))}
          {review.isPending ? <ActivityIndicator color={colors.brandPrimary} testID="assign-loading" /> : null}
          {review.isError ? <Text style={styles.err}>{review.error.message}</Text> : null}
        </View>
      </BottomSheet>

      <BottomSheet visible={fakeOpen} onClose={() => setFakeOpen(false)} title="Mark as fake" testID="fake-sheet">
        <Text style={styles.sheetNote}>The citizen will see this verdict on their report.</Text>
        <TextInput testID="fake-note-input" value={fakeNote} onChangeText={setFakeNote} placeholder="Reason (optional)" placeholderTextColor={colors.muted} style={styles.input} />
        <PrimaryButton title="Confirm, Mark Fake" icon="close-circle" variant="danger" testID="fake-confirm-btn" loading={review.isPending} onPress={() => review.mutate({ verdict: "fake", note: fakeNote })} style={{ marginTop: spacing.lg }} />
      </BottomSheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  assigned: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  assignedText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  list: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg },
  rowPressed: { backgroundColor: colors.surfaceSecondary },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  rowSub: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  rating: { fontFamily: fonts.bold, fontSize: 13, color: colors.onSurface },
  err: { fontFamily: fonts.medium, fontSize: 13, color: colors.error, textAlign: "center" },
  sheetNote: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.onSurfaceTertiary, marginBottom: spacing.md },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 52, fontFamily: fonts.text, fontSize: 14, color: colors.onSurface },
}));
