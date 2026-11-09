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
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
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
import { ensureLocationPermission } from "@/src/utils/permissions";
import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";
import type { AiAnalysis, NearbyReportMatch } from "@/src/types";
import type { LocalFile } from "@/src/utils/upload";

const STEPS = [
  { key: "road", label: "Identifying road damage", doneLabel: "Road damage identified" },
  { key: "severity", label: "Assessing severity" },
  { key: "findings", label: "Generating AI findings" },
];

function InspectionPhoto({ uri, scanning }: { uri: string; scanning: boolean }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const scanPosition = useSharedValue(0);

  useEffect(() => {
    if (scanning && !reduceMotion) {
      scanPosition.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.System }),
        -1,
        true,
      );
    } else {
      scanPosition.value = withTiming(0, { duration: 180, reduceMotion: ReduceMotion.System });
    }
    return () => {
      scanPosition.value = 0;
    };
  }, [reduceMotion, scanPosition, scanning]);

  const scanStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + Math.sin(scanPosition.value * Math.PI) * 0.55,
    transform: [{ translateY: -82 + scanPosition.value * 164 }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(reduceMotion ? 0 : 260).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)}
      style={styles.photoFrame}
      testID="report-photo-frame"
    >
      <Image source={{ uri }} style={styles.hero} contentFit="cover" transition={240} testID="report-photo-preview" />
      {scanning && !reduceMotion ? <Animated.View pointerEvents="none" style={[styles.scanLine, scanStyle]} /> : null}
    </Animated.View>
  );
}

export default function NewReport() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const session = useSession();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<"photo" | "location">("photo");
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const analysisRequest = useRef(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapFocus, setMapFocus] = useState(KARACHI_CENTER);
  const [revealedStageCount, setRevealedStageCount] = useState(0);
  const [nearbyMatch, setNearbyMatch] = useState<NearbyReportMatch | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);
  const [locBlocked, setLocBlocked] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // Live address as the pin moves (debounced).
  useEffect(() => {
    if (!coords) return;
    setAddrLoading(true);
    let active = true;
    const t = setTimeout(() => {
      api
        .geocode(coords.lat, coords.lng)
        .then((r) => {
          if (!active) return;
          setAddress(r.address);
          setLocationError(null);
        })
        .catch((error: unknown) => {
          if (!active) return;
          console.error("[report reverse geocoding]", error);
          setAddress(null);
          setLocationError("Could not find the address. Your map pin is still saved.");
        })
        .finally(() => {
          if (active) setAddrLoading(false);
        });
    }, 500);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [coords]);

  useEffect(() => {
    if (analyzing || (!analysis && !analysisError)) {
      setRevealedStageCount(0);
      return;
    }
    let count = 1;
    const total = analysis?.is_road_damage ? STEPS.length : 1;
    if (reduceMotion) {
      setRevealedStageCount(total);
      return;
    }
    setRevealedStageCount(count);
    let timer: ReturnType<typeof setTimeout>;
    const revealNext = () => {
      count += 1;
      setRevealedStageCount(count);
      if (count < total) timer = setTimeout(revealNext, 320);
    };
    if (count < total) timer = setTimeout(revealNext, 320);
    return () => clearTimeout(timer);
  }, [analysis, analysisError, analyzing, reduceMotion]);

  const submit = useMutation({
    mutationFn: async (decision?: { confirmedMatchId?: string; separateMatchId?: string }) => {
      if (!photo || !session?.citizen_id) throw new Error("Missing report details");
      if (!coords) throw new Error("Choose a report location before submitting");
      return api.createReport({
        file: photo,
        lat: coords.lat,
        lng: coords.lng,
        citizenId: session.citizen_id,
        citizenName: session.name,
        description: desc,
        analysis,
        ...decision,
      });
    },
    onSuccess: async (result) => {
      if ("match_required" in result) {
        setNearbyMatch(result.candidate);
        setSubmitErr(null);
        return;
      }
      setNearbyMatch(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await queryClient.invalidateQueries({ queryKey: qk.stats });
      router.replace({
        pathname: "/citizen/report/[id]",
        params: {
          id: result.report.id,
          ...(result.merged ? { merged: "1" } : {}),
          ...(result.already_reported ? { already: "1" } : {}),
        },
      });
    },
    onError: (e) => setSubmitErr(e.message || "Could not submit report"),
  });

  const onPicked = async (file: LocalFile) => {
    const requestId = ++analysisRequest.current;
    setPhoto(file);
    setAnalysis(null);
    setNearbyMatch(null);
    setAnalysisError(null);
    setSubmitErr(null);
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
    setLocationError(null);
    try {
      const perm = await ensureLocationPermission();
      if (perm === "blocked") {
        setLocBlocked(true);
        return;
      }
      if (perm === "denied") {
        setLocationError("Location access was denied. Drop the pin manually or allow access in Settings.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMapFocus(current);
      setCoords(current);
      setNearbyMatch(null);
      setSubmitErr(null);
      setLocBlocked(false);
    } catch (error) {
      console.error("[report current location]", error);
      setLocationError("Could not get your location. Drop the pin manually or try again.");
    }
  };

  const blockedReason = analysis && !analysis.is_road_damage
      ? "This doesn't look like road damage. Please photograph the pothole."
      : analysisError
        ? analysisError
        : null;
  const usable = !!analysis && !blockedReason;
  const inspectionReady = usable && revealedStageCount >= STEPS.length;
  const locationValid = !!coords
    && Number.isFinite(coords.lat)
    && Number.isFinite(coords.lng)
    && Math.abs(coords.lat) <= 90
    && Math.abs(coords.lng) <= 180;
  const results: Record<string, boolean> | null = analysis
    ? !analysis.is_road_damage
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
          <Animated.View
            key="photo"
            entering={FadeIn.duration(reduceMotion ? 0 : 220).reduceMotion(ReduceMotion.System)}
            layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)}
            style={styles.gap}
          >
            {photo ? (
              <InspectionPhoto uri={photo.uri} scanning={analyzing} />
            ) : (
              <Card>
                <Kicker icon="camera">Photograph the damage</Kicker>
                <Text style={styles.body}>Stand 1 to 2 metres back so the damaged patch fills most of the frame. Avoid shooting into the sun.</Text>
              </Card>
            )}

            {photo && (analyzing || results) ? (
              <CheckProgress
                title="AI inspection"
                steps={STEPS}
                pending={analyzing}
                pendingLabel="Analyzing road-damage photo…"
                pendingSteps={false}
                results={results}
                revealedCount={analyzing ? 0 : revealedStageCount}
                progressivelyReveal={!analyzing}
                testID="pothole-check"
              />
            ) : null}

            {blockedReason && !analyzing ? (
              <View style={[styles.banner, { backgroundColor: withAlpha(colors.error, 0.07), borderColor: withAlpha(colors.error, 0.4) }]} testID="analysis-blocked-banner">
                <Ionicons name="close-circle" size={18} color={colors.error} />
                <Text style={styles.bannerText}>{blockedReason}</Text>
              </View>
            ) : null}

            {usable && analysis ? (
              <>
                {inspectionReady && ((analysis.findings?.length ?? 0) > 0 || !!analysis.severity) ? (
                  <InspectionCard severity={analysis.severity} findings={analysis.findings ?? []} animated />
                ) : null}
                <PrimaryButton title="Confirm Location" icon="arrow-forward" testID="confirm-location-btn" onPress={() => setStep("location")} />
                <PrimaryButton title="Use a different photo" variant="ghost" small testID="change-photo-btn" onPress={() => { analysisRequest.current += 1; setPhoto(null); setAnalysis(null); setAnalysisError(null); setSubmitErr(null); }} />
              </>
            ) : null}

            {(!photo || blockedReason) && !analyzing ? <PhotoActions onPicked={onPicked} cameraTitle={photo ? "Retake" : "Take Photo"} galleryTitle="From Gallery" /> : null}
          </Animated.View>
        ) : (
          <Animated.View
            key="location"
            entering={FadeIn.duration(reduceMotion ? 0 : 240).reduceMotion(ReduceMotion.System)}
            style={styles.gap}
          >
            <AppMap
              lat={mapFocus.lat}
              lng={mapFocus.lng}
              selectedPoint={coords}
              markerVisible={locationValid}
              pickable
              height={280}
              onSelect={(lat, lng) => {
                setCoords({ lat, lng });
                setNearbyMatch(null);
                setSubmitErr(null);
                setLocationError(null);
              }}
              testID="location-map"
            />
            {nearbyMatch ? (
              <Card testID="nearby-match-card">
                <Kicker icon="location">Pothole report nearby</Kicker>
                <Text style={styles.matchText}>
                  {nearbyMatch.address || "Near your selected location"}
                </Text>
                <Text style={styles.matchDetail}>
                  {nearbyMatch.distance_m} m away · {nearbyMatch.reporter_count} {nearbyMatch.reporter_count === 1 ? "contributor" : "contributors"}
                </Text>
                <Text style={styles.body}>
                  {nearbyMatch.already_reported
                    ? "You already reported this pothole."
                    : "Is this the same pothole? Yes adds you as a contributor; the original photo stays on the report. No creates a separate report."}
                </Text>
              </Card>
            ) : null}
            <Animated.View
              entering={FadeInDown.duration(reduceMotion ? 0 : 220).reduceMotion(ReduceMotion.System)}
              layout={LinearTransition.duration(180).reduceMotion(ReduceMotion.System)}
              style={[styles.addressRow, locationValid && styles.addressSelected]}
              testID="pin-address"
            >
              <Ionicons name={locationValid ? "checkmark-circle" : "location-outline"} size={20} color={locationValid ? colors.success : colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.addrLabel, locationValid && { color: colors.success }]}>{locationValid ? "Location selected" : "Select a location"}</Text>
                <Text style={styles.addrText} numberOfLines={2} testID="pin-address-text">
                  {!locationValid ? "Tap the map or use your location" : addrLoading ? "Finding address…" : address || "Address unavailable"}
                </Text>
              </View>
              {addrLoading ? <ActivityIndicator size="small" color={colors.success} /> : null}
            </Animated.View>
            <PrimaryButton title="Use My Location" icon="locate" variant="secondary" small testID="use-my-location-btn" onPress={useGps} />
            {locationError ? <Text style={styles.submitErr} testID="location-error">{locationError}</Text> : null}
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

      {step === "location" && !nearbyMatch ? (
        <KeyboardStickyView>
          <View style={[styles.sticky, { paddingBottom: insets.bottom + spacing.md }]}>
            {submitErr ? <Text style={styles.submitErr} testID="submit-error">{submitErr}</Text> : null}
            <PrimaryButton title="Submit Report" icon="send" testID="report-submit-btn" loading={submit.isPending} disabled={!locationValid} onPress={() => { setSubmitErr(null); submit.mutate(); }} />
          </View>
        </KeyboardStickyView>
      ) : null}
      {step === "location" && nearbyMatch ? (
        <KeyboardStickyView>
          <View style={[styles.sticky, { paddingBottom: insets.bottom + spacing.md }]}>
            {submitErr ? <Text style={styles.submitErr} testID="submit-error">{submitErr}</Text> : null}
            <PrimaryButton
              title={
                nearbyMatch.already_reported
                  ? "View Existing Report"
                  : "Same Pothole"
              }
              icon="people"
              testID="confirm-nearby-match-btn"
              loading={submit.isPending}
              onPress={() => {
                setSubmitErr(null);
                if (nearbyMatch.already_reported) {
                  router.push({
                    pathname: "/citizen/report/[id]",
                    params: { id: nearbyMatch.id, merged: "1", already: "1" },
                  });
                } else {
                  submit.mutate({ confirmedMatchId: nearbyMatch.id });
                }
              }}
            />
            <PrimaryButton
              title="Different Pothole"
              variant="secondary"
              testID="separate-nearby-report-btn"
              disabled={submit.isPending}
              onPress={() => {
                setSubmitErr(null);
                submit.mutate({ separateMatchId: nearbyMatch.id });
              }}
            />
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
  photoFrame: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  scanLine: { position: "absolute", top: "50%", left: 0, right: 0, height: 2, backgroundColor: colors.brandPrimary, shadowColor: colors.brandPrimary, shadowOpacity: 0.7, shadowRadius: 8, elevation: 3 },
  body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.onSurfaceTertiary },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  bannerText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 19, color: colors.onSurface },
  matchText: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.onSurface },
  matchDetail: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.onSurfaceTertiary },
  addressRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  addressSelected: { borderColor: withAlpha(colors.success, 0.35), backgroundColor: withAlpha(colors.success, 0.05) },
  addrLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.muted },
  addrText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface, marginTop: 2 },
  noteInput: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 88, textAlignVertical: "top", fontFamily: fonts.text, fontSize: 14, color: colors.onSurface },
  sticky: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, gap: spacing.sm },
  submitErr: { fontFamily: fonts.medium, fontSize: 13, color: colors.error, textAlign: "center" },
}));
