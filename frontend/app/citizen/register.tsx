import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Pressable, Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
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

import { api } from "@/src/api";
import { CheckProgress } from "@/src/components/CheckProgress";
import { PrimaryButton } from "@/src/components/PrimaryButton";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { homeFor, saveSession } from "@/src/session";
import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";
import { ensureMediaPermission } from "@/src/utils/permissions";
import type { SelfieResult, Session } from "@/src/types";
import type { LocalFile } from "@/src/utils/upload";

const STEPS = [
  { key: "has_face", label: "Face detected", doneLabel: "Face detected" },
  { key: "single_person", label: "Only one person detected" },
  { key: "real_capture", label: "Not a photo of a screen or print" },
];

type Phase = "name" | "camera" | "checking" | "result";

function sessionForCitizen(citizen: NonNullable<SelfieResult["citizen"]>): Session {
  return {
    role: "citizen",
    name: citizen.name,
    citizen_id: citizen.id,
    selfie_path: citizen.selfie_path,
    citizen_verified: citizen.selfie_verified,
  };
}

type PreviewStatus = "checking" | "success" | "failure";

function SelfiePreview({ uri, status }: { uri: string; status: PreviewStatus }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const ringColor = useSharedValue(colors.brandPrimary);
  const accentColor = colors.brandPrimary;
  const trackColor = withAlpha(accentColor, 0.22);

  useEffect(() => {
    if (status === "checking" && !reduceMotion) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1800, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
        -1,
        false,
      );
    } else {
      rotation.value = withTiming(0, { duration: 240, reduceMotion: ReduceMotion.System });
    }

    const targetColor = status === "success" ? colors.success : status === "failure" ? colors.error : colors.brandPrimary;
    ringColor.value = withTiming(targetColor, { duration: 360, reduceMotion: ReduceMotion.System });

    return () => {
      rotation.value = 0;
    };
  }, [colors.brandPrimary, colors.error, colors.success, reduceMotion, ringColor, rotation, status]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    borderColor: status === "checking" ? trackColor : ringColor.value,
    borderTopColor: status === "checking" ? accentColor : ringColor.value,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(240).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)}
      style={styles.previewStage}
      testID="selfie-preview-stage"
    >
      <Animated.View style={[styles.previewRing, ringStyle]} />
      <Image source={{ uri }} style={styles.previewPhoto} contentFit="cover" transition={240} />
      {status === "success" ? (
        <Animated.View
          entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
          style={styles.previewSuccess}
          testID="selfie-preview-success"
        >
          <Ionicons name="checkmark" size={14} color={colors.onSuccess} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export default function Register() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>("name");
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [result, setResult] = useState<SelfieResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [skipPending, setSkipPending] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFrame, setCameraFrame] = useState<{ width: number; height: number } | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [sessionSaveError, setSessionSaveError] = useState<string | null>(null);
  const flowIdRef = useRef(0);
  const nameOk = name.trim().length >= 2;
  const blocked = permission && !permission.granted && !permission.canAskAgain;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void getPermission().catch((permissionError) => {
          console.error("[camera permission status]", permissionError);
        });
      }
    });
    return () => subscription.remove();
  }, [getPermission]);

  useEffect(
    () => () => {
      flowIdRef.current += 1;
    },
    [],
  );

  const openCamera = async () => {
    setCameraError(null);
    setCaptureError(null);
    setCameraReady(false);
    setCameraFrame(null);
    setError(null);
    setPhase("camera");
    try {
      if (Platform.OS === "web" && !(await CameraView.isAvailableAsync())) {
        setCameraError("No camera is available on this device. You can continue without selfie verification.");
        return;
      }
      const current = await requestPermission();
      if (!current.granted) setCameraError("Camera access is needed to take a selfie.");
    } catch (cameraPermissionError) {
      console.error("[selfie camera setup]", cameraPermissionError);
      setCameraError(cameraPermissionError instanceof Error ? cameraPermissionError.message : "The camera could not be opened.");
    }
  };

  const captureManualSelfie = async () => {
    setCaptureError(null);
    try {
      const picture = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (!picture?.uri || !picture.width || !picture.height || !cameraFrame) {
        throw new Error("Could not capture the selfie. Please try again.");
      }
      const scale = Math.max(cameraFrame.width / picture.width, cameraFrame.height / picture.height);
      const cropWidth = Math.min(picture.width, Math.round((cameraFrame.width * 0.64) / scale));
      const cropHeight = Math.min(picture.height, Math.round((cameraFrame.width * 0.64) / scale));
      const originX = Math.max(0, Math.round((picture.width - cropWidth) / 2));
      const originY = Math.max(0, Math.round((picture.height - cropHeight) / 2));
      const cropped = await ImageManipulator.manipulateAsync(
        picture.uri,
        [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      runCheck({ uri: cropped.uri, name: "selfie.jpg", mimeType: "image/jpeg" });
    } catch (captureFailure) {
      console.error("[selfie capture]", captureFailure);
      setCaptureError(captureFailure instanceof Error ? captureFailure.message : "Could not capture the selfie. Please try again.");
    }
  };

  const uploadSelfie = async () => {
    setCaptureError(null);
    try {
      const mediaPermission = await ensureMediaPermission("gallery");
      if (mediaPermission !== "granted") return;
      const pickerResult = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      const asset = pickerResult.canceled ? null : pickerResult.assets?.[0];
      if (asset) {
        runCheck({
          uri: asset.uri,
          name: asset.fileName ?? "selfie.jpg",
          mimeType: asset.mimeType ?? "image/jpeg",
        });
      }
    } catch (pickerFailure) {
      console.error("[selfie photo picker]", pickerFailure);
      setCaptureError(pickerFailure instanceof Error ? pickerFailure.message : "Could not open your photos. Please try again.");
    }
  };

  const onCameraLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCameraFrame({ width, height });
  };

  const retryCamera = () => {
    setCameraError(null);
    setCameraReady(false);
    void openCamera();
  };

  const runCheck = useCallback(
    async (file: LocalFile) => {
      const flowId = ++flowIdRef.current;
      setPhoto(file);
      setResult(null);
      setError(null);
      setSessionSaveError(null);
      setSessionSaved(false);
      setRevealedCount(1);
      setPhase("checking");

      try {
        const prepared = await ImageManipulator.manipulateAsync(
          file.uri,
          [{ resize: { width: 720 } }],
          { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
        );
        if (flowId !== flowIdRef.current) return;

        const preparedFile: LocalFile = { uri: prepared.uri, name: "selfie.jpg", mimeType: "image/jpeg" };
        setPhoto(preparedFile);
        const response = await api.register(name.trim(), preparedFile);
        if (flowId !== flowIdRef.current) return;
        if (response.passed && !response.citizen) {
          throw new Error("The selfie passed verification, but the profile was not returned. Please retry.");
        }

        setResult(response);
        setRevealedCount(1);
        setPhase("result");
        if (response.passed && response.citizen) {
          const saved = await saveSession(sessionForCitizen(response.citizen));
          if (flowId !== flowIdRef.current) return;
          setSessionSaved(saved);
          if (!saved) setSessionSaveError("Your selfie passed, but this profile could not be saved on this device.");
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
      } catch (verificationError) {
        if (flowId !== flowIdRef.current) return;
        const message = verificationError instanceof Error ? verificationError.message : String(verificationError);
        console.error("[selfie verification]", verificationError);
        setError(message || "AI verification failed. Please try again.");
        setPhase("result");
      }
    },
    [name],
  );

  useEffect(() => {
    if (phase !== "result" || !result) return;
    let count = 1;
    let timer: ReturnType<typeof setTimeout>;
    const revealNext = () => {
      count += 1;
      setRevealedCount(count);
      if (count < STEPS.length) {
        timer = setTimeout(revealNext, 500);
      } else if (result.passed) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    };
    timer = setTimeout(revealNext, 500);
    return () => clearTimeout(timer);
  }, [phase, result]);

  const requestCameraAccess = async () => {
    setCameraError(null);
    try {
      const current = await requestPermission();
      if (!current.granted) setCameraError("Camera access is needed to take a selfie.");
    } catch (permissionError) {
      console.error("[selfie camera permission]", permissionError);
      setCameraError(permissionError instanceof Error ? permissionError.message : "Camera access could not be requested.");
    }
  };

  const skipSelfie = async () => {
    if (!nameOk || skipPending) return;
    flowIdRef.current += 1;
    setSkipPending(true);
    setError(null);
    try {
      const session: Session = {
        role: "citizen",
        name: name.trim(),
        citizen_id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        selfie_path: null,
        citizen_verified: false,
      };
      const saved = await saveSession(session);
      if (!saved) throw new Error("This profile could not be saved on this device. Please try again.");
      await router.replace(homeFor(session));
    } catch (skipError) {
      console.error("[citizen sign-up without selfie]", skipError);
      setError(skipError instanceof Error ? skipError.message : "Could not create your profile. Please try again.");
      setSkipPending(false);
    }
  };

  const retryVerification = () => {
    flowIdRef.current += 1;
    setResult(null);
    setPhoto(null);
    setError(null);
    setSessionSaveError(null);
    setSessionSaved(false);
    void openCamera();
  };

  const retrySessionSave = async () => {
    if (!result?.citizen) return;
    setSessionSaveError(null);
    try {
      const saved = await saveSession(sessionForCitizen(result.citizen));
      if (!saved) throw new Error("The profile could not be saved. Check device storage and try again.");
      setSessionSaved(true);
    } catch (saveError) {
      console.error("[citizen session save]", saveError);
      setSessionSaveError(saveError instanceof Error ? saveError.message : "The profile could not be saved.");
    }
  };

  const resultMap = result ? Object.fromEntries(result.checks.map((check) => [check.key, !!check.passed])) : null;
  const allResultsRevealed = !!result && revealedCount >= STEPS.length;
  const showVerified = phase === "result" && !!result?.passed && allResultsRevealed;
  const previewStatus: PreviewStatus =
    phase === "checking" ? "checking" : result?.passed ? "success" : "failure";
  const continueAfterVerification = () => {
    if (!sessionSaved || !result?.citizen) return;
    router.replace(homeFor(sessionForCitizen(result.citizen)));
  };

  const onBack = () => {
    if (phase !== "name") {
      flowIdRef.current += 1;
      setPhase("name");
      setCameraError(null);
      setError(null);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Citizen sign-up"
        subtitle={phase === "name" ? "Step 1 of 2 · Your name" : "Step 2 of 2 · Selfie verification"}
        onBack={onBack}
      />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {phase === "name" ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.gap}>
            <Text style={styles.h1}>Who&apos;s reporting?</Text>
            <Text style={styles.body}>
              Your name appears on your reports. This profile is saved on this device and cannot currently be recovered on another device.
            </Text>
            <TextInput
              testID="register-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {error ? <Text style={styles.error} testID="selfie-skip-error">{error}</Text> : null}
            <PrimaryButton
              title="Take selfie"
              icon="camera"
              testID="register-take-selfie-btn"
              disabled={!nameOk}
              onPress={openCamera}
            />
            <PrimaryButton title="Upload a photo" icon="image" variant="secondary" testID="register-upload-btn" disabled={!nameOk} onPress={uploadSelfie} />
            <PrimaryButton
              title="Continue without selfie"
              variant="ghost"
              testID="register-skip-selfie-btn"
              loading={skipPending}
              disabled={!nameOk || skipPending}
              onPress={skipSelfie}
            />
          </Animated.View>
        ) : null}

        {phase === "camera" ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.gap}>
            {permission?.granted && !cameraError ? (
              <View style={styles.gap}>
                <View style={styles.cameraWrap} onLayout={onCameraLayout}>
                  <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="front"
                    onCameraReady={() => setCameraReady(true)}
                    onMountError={(event) => setCameraError(event.message || "The front camera could not be started.")}
                    testID="selfie-camera"
                  />
                  <View style={styles.oval} pointerEvents="none" />
                </View>
                <Text style={styles.body}>Centre your face in the oval, in good light, with nothing covering it.</Text>
                {captureError ? <Text style={styles.error} testID="selfie-capture-error">{captureError}</Text> : null}
                <Pressable
                  testID="selfie-capture-btn"
                  onPress={() => void captureManualSelfie()}
                  disabled={!cameraReady || !cameraFrame}
                  style={({ pressed }) => [
                    styles.shutter,
                    pressed && styles.shutterPressed,
                    (!cameraReady || !cameraFrame) && styles.disabledShutter,
                  ]}
                >
                  <View style={styles.shutterInner} />
                </Pressable>
                <PrimaryButton title="Upload a photo instead" variant="ghost" small testID="selfie-upload-instead-btn" onPress={uploadSelfie} />
                <PrimaryButton
                  title="Continue without selfie"
                  variant="ghost"
                  small
                  testID="camera-skip-selfie-btn"
                  loading={skipPending}
                  disabled={skipPending}
                  onPress={skipSelfie}
                />
              </View>
            ) : (
              <View style={styles.permissionCard} testID="camera-permission-card">
                <Ionicons name="camera" size={24} color={colors.onSurfaceTertiary} />
                <Text style={styles.body}>
                  {cameraError ??
                    (blocked
                      ? "Camera access is turned off. Allow it in Settings to take a selfie."
                      : Platform.OS === "web"
                        ? "Allow your browser to use the front camera to continue."
                        : "Allow camera access to take a selfie.")}
                </Text>
                {permission?.granted && cameraError ? (
                  <PrimaryButton title="Try camera again" icon="refresh" variant="secondary" small testID="retry-selfie-camera-btn" onPress={retryCamera} />
                ) : blocked ? (
                  <PrimaryButton title="Open Settings" icon="settings" small testID="open-camera-settings-btn" onPress={() => Linking.openSettings()} />
                ) : !cameraError?.startsWith("No camera is available") ? (
                  <PrimaryButton title="Allow camera" icon="camera" small testID="allow-camera-btn" onPress={requestCameraAccess} />
                ) : null}
                <PrimaryButton
                  title="Continue without selfie"
                  variant="ghost"
                  small
                  testID="camera-skip-selfie-btn"
                  loading={skipPending}
                  disabled={!nameOk || skipPending}
                  onPress={skipSelfie}
                />
              </View>
            )}
            {error ? <Text style={styles.error} testID="selfie-skip-error">{error}</Text> : null}
          </Animated.View>
        ) : null}

        {phase === "checking" || phase === "result" ? (
          <Animated.View
            entering={FadeIn.duration(240).reduceMotion(ReduceMotion.System)}
            layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)}
            style={[styles.verificationStage, phase === "result" && styles.resultStage]}
          >
            {photo ? <SelfiePreview uri={photo.uri} status={previewStatus} /> : null}
            {showVerified ? (
              <Animated.Text
                entering={FadeIn.duration(reduceMotion ? 0 : 240).reduceMotion(ReduceMotion.System)}
                style={styles.successTitle}
                testID="selfie-success-title"
              >
                Photo verified
              </Animated.Text>
            ) : null}
            <CheckProgress
              title={undefined}
              steps={STEPS}
              pending={phase === "checking"}
              pendingLabel={phase === "checking" ? "Analyzing selfie…" : undefined}
              pendingSteps={false}
              centerPending
              results={resultMap}
              revealedCount={phase === "checking" ? 0 : revealedCount}
              singleStep={phase === "checking"}
              progressivelyReveal={phase === "result"}
              variant="kinetic"
              testID="selfie-check"
            />
            {showVerified ? (
              <View style={styles.finalSuccess} testID="selfie-success-actions">
                {sessionSaveError ? (
                  <>
                    <Text style={styles.error}>{sessionSaveError}</Text>
                    <PrimaryButton title="Save profile and continue" icon="save" testID="retry-session-save-btn" onPress={retrySessionSave} />
                  </>
                ) : (
                  <Animated.View
                    entering={FadeIn.duration(reduceMotion ? 0 : 260).delay(reduceMotion ? 0 : 180).reduceMotion(ReduceMotion.System)}
                    style={styles.continueButton}
                  >
                    <PrimaryButton
                      title={sessionSaved ? "Continue" : "Saving profile…"}
                      icon="arrow-forward"
                      testID="continue-after-selfie-btn"
                      loading={!sessionSaved}
                      disabled={!sessionSaved}
                      onPress={continueAfterVerification}
                      style={styles.fullWidth}
                    />
                  </Animated.View>
                )}
              </View>
            ) : null}
            {phase === "result" && (error || (result && !result.passed && allResultsRevealed)) ? (
              <Animated.View
                entering={FadeInDown.duration(280).reduceMotion(ReduceMotion.System)}
                style={styles.failureBanner}
                testID="selfie-failed-banner"
              >
                <Ionicons name="close-circle" size={21} color={colors.error} />
                <Text style={styles.bannerText}>{error ?? result?.reason ?? "The selfie could not be verified. Please try again."}</Text>
              </Animated.View>
            ) : null}
            {phase === "result" && (!result || !result.passed) ? (
              <View style={styles.actions}>
                <PrimaryButton
                  title="Retake selfie"
                  icon="refresh"
                  testID="selfie-retry-btn"
                  onPress={retryVerification}
                />
                <PrimaryButton title="Upload a different photo" variant="secondary" icon="image" testID="selfie-reupload-btn" onPress={uploadSelfie} />
                <PrimaryButton
                  title="Continue without selfie"
                  variant="ghost"
                  testID="result-skip-selfie-btn"
                  loading={skipPending}
                  disabled={skipPending}
                  onPress={skipSelfie}
                />
              </View>
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
  verificationStage: { gap: spacing.lg },
  resultStage: { gap: spacing.md },
  h1: { fontFamily: fonts.display, fontSize: 24, color: colors.onSurface, letterSpacing: -0.4, textAlign: "center" },
  body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21, color: colors.onSurfaceTertiary, textAlign: "center" },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.onSurface,
  },
  permissionCard: { alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.xl },
  cameraWrap: { borderRadius: radius.lg, overflow: "hidden", aspectRatio: 3 / 4, backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" },
  camera: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  oval: { width: "64%", aspectRatio: 1, borderRadius: radius.pill, borderWidth: 2, borderColor: withAlpha(colors.onSurfaceInverse, 0.85) },
  shutter: { alignSelf: "center", width: 72, height: 72, borderRadius: radius.pill, borderWidth: 3, borderColor: colors.onSurface, alignItems: "center", justifyContent: "center" },
  shutterPressed: { backgroundColor: colors.surfaceSecondary },
  disabledShutter: { opacity: 0.4 },
  shutterInner: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  previewStage: {
    width: 168,
    height: 168,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  previewRing: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderRadius: radius.pill,
    borderColor: withAlpha(colors.brandPrimary, 0.22),
    borderTopColor: colors.brandPrimary,
  },
  previewPhoto: {
    width: 140,
    height: 140,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
  previewSuccess: {
    position: "absolute",
    right: spacing.xs,
    bottom: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  finalSuccess: {
    alignItems: "center",
    gap: spacing.sm,
    width: "100%",
  },
  continueButton: { width: "100%" },
  fullWidth: { width: "100%" },
  successTitle: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.4, color: colors.success, textAlign: "center" },
  failureBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: withAlpha(colors.error, 0.4), borderRadius: radius.md, padding: spacing.md, backgroundColor: withAlpha(colors.error, 0.06) },
  bannerText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.onSurface },
  error: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.error, textAlign: "center" },
  actions: { gap: spacing.sm },
}));
