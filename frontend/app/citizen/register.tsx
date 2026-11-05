import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";

import { api } from "@/src/api";
import { CheckProgress } from "@/src/components/CheckProgress";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { homeFor, saveSession } from "@/src/session";
import { ensureMediaPermission } from "@/src/utils/permissions";
import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";
import type { SelfieResult } from "@/src/types";
import type { LocalFile } from "@/src/utils/upload";

const STEPS = [
  { key: "has_face", label: "Checking for a face", doneLabel: "Face found" },
  { key: "single_person", label: "One person only" },
  { key: "face_clear", label: "Face clearly visible" },
  { key: "real_capture", label: "Real person, not a photo of a screen or print" },
];

type Phase = "name" | "camera" | "checking" | "result";

export default function Register() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const camRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>("name");
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [result, setResult] = useState<SelfieResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        const current = await requestPermission();
        if (current.granted) setPhase((currentPhase) => currentPhase === "camera" ? "camera" : currentPhase);
      }
    });
    return () => subscription.remove();
  }, [requestPermission]);

  const runCheck = async (file: LocalFile) => {
    setPhoto(file);
    setResult(null);
    setError(null);
    setPhase("checking");
    try {
      const res = await api.register(name.trim(), file);
      setResult(res);
      setPhase("result");
      if (res.passed && res.citizen) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const session = { role: "citizen" as const, name: res.citizen.name, citizen_id: res.citizen.id, selfie_path: res.citizen.selfie_path };
        await saveSession(session);
        setTimeout(() => router.replace(homeFor(session)), 1100);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "AI verification failed for an unknown reason. Try again.");
      setPhase("result");
    }
  };

  const openCamera = async () => {
    const current = await requestPermission();
    if (!current.granted) {
      setPhase("camera");
      return;
    }
    setPhase("camera");
  };

  const capture = async () => {
    const pic = await camRef.current?.takePictureAsync({ quality: 0.6 });
    if (pic?.uri) runCheck({ uri: pic.uri, name: "selfie.jpg", mimeType: "image/jpeg" });
  };

  const upload = async () => {
    const perm = await ensureMediaPermission("gallery");
    if (perm !== "granted") return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    const a = r.canceled ? null : r.assets?.[0];
    if (a) runCheck({ uri: a.uri, name: a.fileName ?? "selfie.jpg", mimeType: a.mimeType ?? "image/jpeg" });
  };

  const resultMap = result ? Object.fromEntries(result.checks.map((c) => [c.key, !!c.passed])) : null;
  const blocked = permission && !permission.granted && !permission.canAskAgain;
  const nameOk = name.trim().length >= 2;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Citizen sign-up" subtitle={phase === "name" ? "Step 1 of 2 · Your name" : "Step 2 of 2 · Selfie check"} onBack={() => {
        if (phase !== "name") {
          setPhase("name");
        } else if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/");
        }
      }} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {phase === "name" ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.gap}>
            <Text style={styles.h1}>Who&apos;s reporting?</Text>
            <Text style={styles.body}>Your name appears on your reports. A quick selfie confirms a real person is behind every report, which keeps the Mayor&apos;s queue free of spam.</Text>
            <TextInput testID="register-name-input" value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="words" returnKeyType="next" />
            <PrimaryButton title="Take Selfie" icon="camera" testID="register-take-selfie-btn" disabled={!nameOk} onPress={openCamera} />
            <PrimaryButton title="Upload a photo" icon="image" variant="secondary" testID="register-upload-btn" disabled={!nameOk} onPress={upload} />
          </Animated.View>
        ) : null}

        {phase === "camera" ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.gap}>
            {permission?.granted ? (
              <>
                <View style={styles.cameraWrap}>
                  <CameraView ref={camRef} style={styles.camera} facing="front" onCameraReady={() => setCameraReady(true)} testID="selfie-camera" />
                  <View style={styles.oval} pointerEvents="none" />
                </View>
                <Text style={styles.hint}>Centre your face in the oval, in good light, with nothing covering it.</Text>
                <Pressable testID="selfie-capture-btn" onPress={capture} disabled={!cameraReady} style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed, !cameraReady && { opacity: 0.4 }]}>
                  <View style={styles.shutterInner} />
                </Pressable>
                <PrimaryButton title="Upload a photo instead" variant="ghost" small testID="selfie-upload-instead-btn" onPress={upload} />
              </>
            ) : (
              <View style={styles.permCard} testID="camera-permission-card">
                <Ionicons name="camera" size={22} color={colors.onSurfaceTertiary} />
                <Text style={styles.body}>{blocked ? "Camera access is turned off. Allow it in Settings to take a selfie, or upload a photo." : Platform.OS === "web" ? "Your browser blocked the camera. You can upload a photo instead." : "Allow camera access to take your selfie."}</Text>
                {blocked ? <PrimaryButton title="Open Settings" icon="settings" small testID="open-camera-settings-btn" onPress={() => Linking.openSettings()} /> : <PrimaryButton title="Allow Camera" icon="camera" small testID="allow-camera-btn" onPress={openCamera} />}
                <PrimaryButton title="Upload a photo" icon="image" variant="secondary" small testID="perm-upload-btn" onPress={upload} />
              </View>
            )}
          </Animated.View>
        ) : null}

        {phase === "checking" || phase === "result" ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.gap}>
            {photo ? <Image source={{ uri: photo.uri }} style={styles.selfie} contentFit="cover" transition={200} /> : null}
            <CheckProgress title="AI verification" steps={STEPS} pending={phase === "checking"} pendingLabel="Verifying the uploaded photo…" results={resultMap} testID="selfie-check" />
            {result?.passed ? (
              <View style={[styles.banner, { backgroundColor: withAlpha(colors.success, 0.1), borderColor: withAlpha(colors.success, 0.4) }]} testID="selfie-passed-banner">
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.bannerText}>Verified. Welcome, {result.citizen?.name}.</Text>
              </View>
            ) : null}
            {phase === "result" && (error || (result && !result.passed)) ? (
              <>
                <View style={[styles.banner, { backgroundColor: withAlpha(colors.error, 0.08), borderColor: withAlpha(colors.error, 0.4) }]} testID="selfie-failed-banner">
                  <Ionicons name="close-circle" size={18} color={colors.error} />
                  <Text style={styles.bannerText}>{error ?? result?.reason}</Text>
                </View>
                {__DEV__ && Platform.OS === "web" ? (
                  <PrimaryButton
                    title="Continue demo"
                    icon="arrow-forward"
                    testID="selfie-demo-btn"
                    onPress={async () => {
                      const session = { role: "citizen" as const, name: name.trim(), citizen_id: "demo-citizen" };
                      await saveSession(session);
                      router.replace(homeFor(session));
                    }}
                  />
                ) : null}
                <PrimaryButton title="Retake" icon="refresh" testID="selfie-retake-btn" onPress={() => (permission?.granted ? setPhase("camera") : openCamera())} />
                <PrimaryButton title="Upload a different photo" variant="secondary" icon="image" testID="selfie-reupload-btn" onPress={upload} />
              </>
            ) : null}
          </Animated.View>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  gap: { gap: spacing.lg },
  h1: { fontFamily: fonts.display, fontSize: 24, color: colors.onSurface, letterSpacing: -0.4 },
  body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21, color: colors.onSurfaceTertiary },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 52, fontFamily: fonts.text, fontSize: 15, color: colors.onSurface },
  cameraWrap: { borderRadius: radius.lg, overflow: "hidden", aspectRatio: 3 / 4, backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" },
  camera: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  oval: { width: "62%", aspectRatio: 0.78, borderRadius: 999, borderWidth: 2, borderColor: withAlpha(colors.onSurfaceInverse, 0.85) },
  hint: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, textAlign: "center" },
  shutter: { alignSelf: "center", width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  shutterPressed: { backgroundColor: colors.surfaceSecondary },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary },
  permCard: { alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.xl },
  selfie: { width: 120, height: 120, borderRadius: 60, alignSelf: "center", backgroundColor: colors.surfaceTertiary },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  bannerText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
}));
