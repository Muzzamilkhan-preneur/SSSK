/* eslint-disable react-hooks/set-state-in-effect */
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api, qk } from "@/src/api";
import { InspectionCard } from "@/src/components/AICards";
import { AppMap } from "@/src/components/AppMap";
import { Card, Kicker } from "@/src/components/Card";
import { CheckProgress } from "@/src/components/CheckProgress";
import { PhotoActions } from "@/src/components/PhotoActions";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { KARACHI_CENTER } from "@/src/components/status-meta";
import { useSession } from "@/src/session";
import { isRecoverableSyncError, queueReport } from "@/src/offline-reports";
import { ensureLocationPermission } from "@/src/utils/permissions";
import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";
import type { AiAnalysis, Report } from "@/src/types";
import type { LocalFile } from "@/src/utils/upload";

const STEPS = [
  { key: "road", label: "Checking this is road damage", doneLabel: "Road damage confirmed" },
  { key: "severity", label: "Rating severity" },
  { key: "findings", label: "Listing what the AI saw" },
];

export default function NewReport() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const session = useSession();

  const [step, setStep] = useState<"photo" | "location">("photo");
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const analysisRequest = useRef(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);
  const [locBlocked, setLocBlocked] = useState(false);
  const [desc, setDesc] = useState("");
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // Live address as the pin moves (debounced).
  useEffect(() => {
    if (!coords) return;
    setAddrLoading(true);
    const t = setTimeout(() => {
      api
        .geocode(coords.lat, coords.lng)
        .then((r) => setAddress(r.address))
        .catch(() => setAddress(null))
        .finally(() => setAddrLoading(false));
    }, 500);
    return () => clearTimeout(t);
  }, [coords]);

  const submit = useMutation({
    mutationFn: async (): Promise<{ queued: true } | { queued: false; merged: boolean; report: Report }> => {
      if (!photo || !coords || !session?.citizen_id) throw new Error("Missing report details");
      const offlineInput = { photo, lat: coords.lat, lng: coords.lng, citizenId: session.citizen_id, citizenName: session.name, description: desc };
      if (!analysis) {
        await queueReport(offlineInput);
        return { queued: true };
      }
      try {
        const result = await api.createReport({ file: photo, lat: coords.lat, lng: coords.lng, citizenId: session.citizen_id, citizenName: session.name, description: desc, analysis });
        return { queued: false, ...result };
      } catch (error) {
        if (!isRecoverableSyncError(error)) throw error;
        await queueReport(offlineInput);
        return { queued: true };
      }
    },
    onSuccess: async (result) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (result.queued) {
        router.replace("/citizen/tabs/reports");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await queryClient.invalidateQueries({ queryKey: qk.stats });
      router.replace({ pathname: "/citizen/report/[id]", params: { id: result.report.id, ...(result.merged ? { merged: "1" } : {}) } });
    },
    onError: (e) => setSubmitErr(e.message || "Could not submit report"),
  });

  const onPicked = async (file: LocalFile) => {
    const requestId = ++analysisRequest.current;
    setPhoto(file);
    setAnalysis(null);
    setAnalysisError(null);
    setAnalyzing(true);
    try {
      const nextAnalysis = await api.analyzePothole(file);
      if (requestId === analysisRequest.current) setAnalysis(nextAnalysis);
    } catch (error) {
      if (requestId === analysisRequest.current) {
        setAnalysisError(error instanceof Error ? error.message : "AI inspection is unavailable.");
      }
    } finally {
      if (requestId === analysisRequest.current) setAnalyzing(false);
    }
  };

  const useGps = async () => {
    const perm = await ensureLocationPermission();
    if (perm === "blocked") return setLocBlocked(true);
    if (perm !== "granted") return;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocBlocked(false);
    } catch {
      // the tap-to-pin flow stays usable when GPS fails
    }
  };

  const blockedReason = analysis?.duplicate_photo
    ? "This photo was already submitted."
    : analysis && !analysis.is_road_damage
      ? "This doesn't look like road damage. Please photograph the pothole."
      : analysisError
        ? analysisError
        : null;
  const usable = !!analysis && !blockedReason;
  const results: Record<string, boolean> | null = analysis
    ? analysis.duplicate_photo || !analysis.is_road_damage
      ? { road: false }
      : { road: true, severity: true, findings: true }
    : analysisError
      ? { road: false }
      : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={step === "photo" ? "New Report" : "Confirm Location"}
        subtitle={step === "photo" ? "Step 1 of 2 · Photo and AI inspection" : "Step 2 of 2 · Drop the pin"}
        onBack={() => {
          if (step === "location") {
            setStep("photo");
          } else if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/citizen/tabs/reports");
          }
        }}
        right={
          <View style={styles.steps}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={[styles.stepDot, step === "location" && styles.stepDotActive]} />
          </View>
        }
      />

      <KeyboardAwareScrollView bottomOffset={110} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}>
        {step === "photo" ? (
          <Animated.View key="photo" entering={FadeIn.duration(200)} style={styles.gap}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.hero} contentFit="cover" transition={200} testID="report-photo-preview" />
            ) : (
              <Card>
                <Kicker icon="camera">Photograph the damage</Kicker>
                <Text style={styles.body}>Stand 1 to 2 metres back so the damaged patch fills most of the frame. Avoid shooting into the sun.</Text>
              </Card>
            )}

            {photo && (analyzing || results) ? <CheckProgress title="AI inspection" steps={STEPS} pending={analyzing} results={results} testID="pothole-check" /> : null}

            {blockedReason && !analyzing ? (
              <View style={[styles.banner, { backgroundColor: withAlpha(colors.error, 0.07), borderColor: withAlpha(colors.error, 0.4) }]} testID="analysis-blocked-banner">
                <Ionicons name="close-circle" size={18} color={colors.error} />
                <Text style={styles.bannerText}>{blockedReason}</Text>
              </View>
            ) : null}

            {analysisError && !analyzing ? (
              <Card>
                <Kicker icon="cloud-offline">Offline capture</Kicker>
                <Text style={styles.body}>Your photo can be saved on this phone now. AI inspection and submission will run automatically when the service is reachable again.</Text>
                <PrimaryButton title="Continue Offline" icon="cloud-upload" testID="continue-offline-btn" onPress={() => setStep("location")} />
              </Card>
            ) : null}

            {usable && analysis ? (
              <>
                <InspectionCard severity={analysis.severity} findings={analysis.findings ?? []} />
                <PrimaryButton title="Confirm Location" icon="arrow-forward" testID="confirm-location-btn" onPress={() => setStep("location")} />
                <PrimaryButton title="Use a different photo" variant="ghost" small testID="change-photo-btn" onPress={() => { analysisRequest.current += 1; setPhoto(null); setAnalysis(null); setAnalysisError(null); }} />
              </>
            ) : null}

            {(!photo || blockedReason) && !analyzing ? <PhotoActions onPicked={onPicked} cameraTitle={photo ? "Retake" : "Take Photo"} galleryTitle="From Gallery" /> : null}
          </Animated.View>
        ) : (
          <Animated.View key="location" entering={SlideInRight.duration(220)} style={styles.gap}>
            {analysis ? (
              <AppMap lat={coords?.lat ?? KARACHI_CENTER.lat} lng={coords?.lng ?? KARACHI_CENTER.lng} pickable height={280} onSelect={(lat, lng) => setCoords({ lat, lng })} testID="location-map" />
            ) : (
              <Card>
                <Kicker icon="navigate">Offline location</Kicker>
                <Text style={styles.body}>GPS can locate your phone without mobile data. Map tiles and the street name will be added when the report synchronizes.</Text>
              </Card>
            )}
            <View style={styles.addressRow} testID="pin-address">
              <Ionicons name="location" size={18} color={coords ? colors.brandPrimary : colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addrLabel}>{coords ? "Pinned location" : "No pin yet"}</Text>
                <Text style={styles.addrText} numberOfLines={2} testID="pin-address-text">
                  {!coords ? "Tap the map or use your location" : addrLoading ? "Finding address…" : address || "Karachi"}
                </Text>
              </View>
              {addrLoading ? <ActivityIndicator size="small" color={colors.muted} /> : null}
            </View>
            <PrimaryButton title="Use My Location" icon="locate" variant="secondary" small testID="use-my-location-btn" onPress={useGps} />
            {locBlocked ? (
              <View style={[styles.banner, { backgroundColor: withAlpha(colors.warning, 0.1), borderColor: withAlpha(colors.warning, 0.35) }]} testID="location-blocked-banner">
                <Text style={styles.bannerText}>Location access is off. Drop the pin manually, or allow it in Settings.</Text>
                <PrimaryButton title="Open Settings" small variant="secondary" testID="open-location-settings-btn" onPress={() => Linking.openSettings()} />
              </View>
            ) : null}
            <Card>
              <Kicker icon="chatbubble-ellipses">Add a note (optional)</Kicker>
              <TextInput testID="report-note-input" value={desc} onChangeText={setDesc} placeholder="e.g. outside the school gate, near the bus stop" placeholderTextColor={colors.muted} multiline style={styles.noteInput} />
            </Card>
          </Animated.View>
        )}
      </KeyboardAwareScrollView>

      {step === "location" ? (
        <KeyboardStickyView>
          <View style={[styles.sticky, { paddingBottom: insets.bottom + spacing.md }]}>
            {submitErr ? <Text style={styles.submitErr} testID="submit-error">{submitErr}</Text> : null}
            <PrimaryButton title={analysis ? "Submit Report" : "Save Offline Report"} icon={analysis ? "send" : "cloud-upload"} testID="report-submit-btn" loading={submit.isPending} disabled={!coords} onPress={() => { setSubmitErr(null); submit.mutate(); }} />
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  steps: { flexDirection: "row", gap: 6, alignItems: "center" },
  stepDot: { width: 12, height: 6, borderRadius: radius.pill, backgroundColor: colors.border },
  stepDotActive: { width: 24, backgroundColor: colors.brandPrimary },
  gap: { gap: spacing.lg },
  hero: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surfaceTertiary },
  body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.onSurfaceTertiary },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  bannerText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 19, color: colors.onSurface },
  addressRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  addrLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.muted },
  addrText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface, marginTop: 2 },
  noteInput: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 88, textAlignVertical: "top", fontFamily: fonts.text, fontSize: 14, color: colors.onSurface },
  sticky: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, gap: spacing.sm },
  submitErr: { fontFamily: fonts.medium, fontSize: 13, color: colors.error, textAlign: "center" },
}));
