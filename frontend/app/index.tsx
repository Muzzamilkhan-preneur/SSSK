import Ionicons from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { api, qk } from "@/src/api";
import { BottomSheet } from "@/src/components/BottomSheet";
import { VerifiedCrewBadge } from "@/src/components/VerifiedCrewBadge";
import { getSavedCitizenProfile, getSession, homeFor, saveSession } from "@/src/session";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { Contractor, Role, Session } from "@/src/types";

export default function RolePicker() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [contractorSheet, setContractorSheet] = useState(false);
  const [savedCitizen, setSavedCitizen] = useState<Session | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((s) => {
      if (s && (s.role !== "citizen" || s.citizen_id)) router.replace(homeFor(s));
    });
  }, [router]);

  useEffect(() => {
    getSavedCitizenProfile()
      .then(setSavedCitizen)
      .catch((error: unknown) => {
        setPickerError(error instanceof Error ? error.message : "Could not load your saved citizen profile.");
      });
  }, []);

  const { data: stats } = useQuery({ queryKey: qk.stats, queryFn: api.stats });
  const {
    data: contractors,
    isLoading: contractorsLoading,
    isFetching: contractorsFetching,
    isError: contractorsError,
    refetch: refetchContractors,
  } = useQuery({ queryKey: qk.contractors, queryFn: api.contractors });

  const enter = async (role: Role, name: string, contractorId?: string) => {
    const session = { role, name, contractor_id: contractorId };
    await saveSession(session);
    setContractorSheet(false);
    router.replace(homeFor(session));
  };

  const enterCitizen = async () => {
    setPickerError(null);
    try {
      const profile = savedCitizen ?? await getSavedCitizenProfile();
      if (!profile) {
        router.push("/citizen/register");
        return;
      }
      if (!(await saveSession(profile))) {
        throw new Error("Your citizen profile could not be opened on this device. Please try again.");
      }
      router.replace(homeFor(profile));
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : "Could not open your citizen profile.");
    }
  };

  const openContractorPicker = () => {
    setContractorSheet(true);
    void refetchContractors();
  };

  const pending = stats?.by_status?.pending_review ?? 0;
  const activeJobs = stats ? stats.by_status.assigned + stats.by_status.in_progress + stats.by_status.rework : 0;

  const cards: { role: Role; icon: string; title: string; desc: string; badge: string; testID: string; onPress: () => void }[] = [
    {
      role: "citizen",
      icon: "person",
      title: savedCitizen ? `Continue as ${savedCitizen.name}` : "Citizen",
      desc: savedCitizen
        ? "Return to your verified profile, reports and repair progress."
        : "Register with a selfie, report potholes and follow each one until it is fixed.",
      badge: savedCitizen ? "Verified profile saved" : "Selfie sign-up",
      testID: "role-card-citizen",
      onPress: () => { void enterCitizen(); },
    },
    {
      role: "mayor",
      icon: "shield",
      title: "Mayor Office",
      desc: "Review reports, mark them genuine or fake, and assign repair crews.",
      badge: stats ? `${pending} awaiting review` : " ",
      testID: "role-card-mayor",
      onPress: () => enter("mayor", "Mayor Office"),
    },
    {
      role: "contractor",
      icon: "construct",
      title: "Contractor",
      desc: "See assigned repairs, upload proof of the fix and get it checked by AI.",
      badge: stats ? `${activeJobs} active jobs` : " ",
      testID: "role-card-contractor",
      onPress: openContractorPicker,
    },
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.brand}>
        <View style={styles.logoMark}>
          <Ionicons name="construct" size={22} color={colors.onBrandPrimary} />
        </View>
        <Text style={styles.title}>SSSK</Text>
        <Text style={styles.titleAccent}>SAAF KARACHI</Text>
        <Text style={styles.lede}>Report potholes, track every repair, and see it verified with photos.</Text>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(200).delay(80)} style={styles.cards}>
        <Text style={styles.section}>Continue as</Text>
        {cards.map((card) => (
          <Pressable key={card.role} testID={card.testID} onPress={card.onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
            <View style={[styles.cardIcon, card.role !== "citizen" && styles.cardIconDark]}>
              <Ionicons name={card.icon as never} size={20} color={colors.onBrandPrimary} />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardBadge}>{card.badge}</Text>
              </View>
              <Text style={styles.cardDesc}>{card.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
        {pickerError ? <Text style={styles.pickerError} testID="role-picker-error">{pickerError}</Text> : null}
      </Animated.View>

      <Text style={styles.footerText}>Independent civic-tech demo · Not an official KMC service</Text>

      <BottomSheet visible={contractorSheet} onClose={() => setContractorSheet(false)} title="Choose your crew" testID="contractor-sheet">
        <View style={styles.contractorList}>
          {contractorsLoading || contractorsFetching ? <Text style={styles.contractorMessage}>Loading crews…</Text> : null}
          {contractorsError ? (
            <Pressable onPress={() => { void refetchContractors(); }} accessibilityRole="button">
              <Text style={styles.contractorError}>Could not load crews. Tap to retry.</Text>
            </Pressable>
          ) : null}
          {!contractorsLoading && !contractorsFetching && !contractorsError && contractors?.length === 0 ? (
            <Text style={styles.contractorMessage}>No crews are available right now.</Text>
          ) : null}
          {(contractors ?? []).map((c: Contractor) => (
            <Pressable key={c.id} testID={`contractor-select-${c.id}`} onPress={() => enter("contractor", c.name, c.id)} style={({ pressed }) => [styles.contractorRow, pressed && styles.cardPressed]}>
              <View style={styles.contractorBody}>
                <View style={styles.contractorHeading}>
                  <Text style={styles.contractorName}>{c.name}</Text>
                  {c.is_verified ? <VerifiedCrewBadge /> : null}
                </View>
                <Text style={styles.contractorSpec}>{c.specialty}</Text>
              </View>
              <View style={styles.contractorMeta}>
                <Ionicons name="star" size={12} color={colors.warning} />
                <Text style={styles.contractorRating}>{c.rating.toFixed(1)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  brand: { gap: spacing.xs },
  logoMark: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 34, letterSpacing: -1, color: colors.onSurface },
  titleAccent: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 3, color: colors.brandPrimary },
  lede: { fontFamily: fonts.text, fontSize: 15, lineHeight: 22, color: colors.onSurfaceTertiary, marginTop: spacing.md, maxWidth: 310 },
  section: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.muted, marginBottom: spacing.xs },
  cards: { gap: spacing.md },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg },
  cardPressed: { backgroundColor: colors.surfaceSecondary },
  cardIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  cardIconDark: { backgroundColor: colors.brandSecondary },
  cardBody: { flex: 1, gap: 4 },
  cardHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { flexShrink: 1, fontFamily: fonts.display, fontSize: 17, color: colors.onSurface },
  cardBadge: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11, color: colors.onBrandTertiary, textAlign: "right" },
  cardDesc: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18, color: colors.onSurfaceTertiary },
  footerText: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.6, color: colors.muted, textTransform: "uppercase", textAlign: "center" },
  pickerError: { fontFamily: fonts.medium, fontSize: 13, color: colors.error },
  contractorList: { gap: spacing.sm },
  contractorMessage: { fontFamily: fonts.text, fontSize: 14, color: colors.onSurfaceTertiary, paddingVertical: spacing.sm },
  contractorError: { fontFamily: fonts.semibold, fontSize: 14, color: colors.error, paddingVertical: spacing.sm },
  contractorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, backgroundColor: colors.surface },
  contractorBody: { flex: 1, gap: 2 },
  contractorHeading: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  contractorName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  contractorSpec: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  contractorMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  contractorRating: { fontFamily: fonts.bold, fontSize: 13, color: colors.onSurface },
}));
