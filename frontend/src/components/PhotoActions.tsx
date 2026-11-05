import { Linking, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { PrimaryButton } from "@/src/components/PrimaryButton";
import { ensureMediaPermission } from "@/src/utils/permissions";
import { fonts, makeStyles, radius, spacing, withAlpha } from "@/src/theme";
import type { LocalFile } from "@/src/utils/upload";
import { useState } from "react";

type Props = {
  onPicked: (file: LocalFile) => void;
  cameraTitle?: string;
  galleryTitle?: string;
  disabled?: boolean;
};

// Camera + gallery buttons with the full permission contract handled in one place:
// check → contextual request → "Open Settings" when permanently blocked.
export function PhotoActions({ onPicked, cameraTitle = "Take Photo", galleryTitle = "Choose from Gallery", disabled = false }: Props) {
  const styles = useStyles();
  const [blocked, setBlocked] = useState<null | "camera" | "gallery">(null);

  const pick = async (kind: "camera" | "gallery") => {
    setBlocked(null);
    const perm = await ensureMediaPermission(kind);
    if (perm === "blocked") {
      setBlocked(kind);
      return;
    }
    if (perm !== "granted") return;
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6, allowsEditing: false };
    const result = kind === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    onPicked({
      uri: asset.uri,
      name: asset.fileName ?? `photo.${(asset.mimeType ?? "image/jpeg").split("/")[1] ?? "jpg"}`,
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <PrimaryButton title={cameraTitle} icon="camera" testID="camera-btn" onPress={() => pick("camera")} disabled={disabled} style={{ flex: 1 }} />
        <PrimaryButton title={galleryTitle} icon="images" variant="secondary" testID="gallery-btn" onPress={() => pick("gallery")} disabled={disabled} style={{ flex: 1 }} />
      </View>
      {blocked ? (
        <View style={styles.blocked} testID="permission-blocked-banner">
          <Text style={styles.blockedText}>
            {blocked === "camera" ? "Camera" : "Photo library"} access was turned off. Open Settings to allow it, then try again.
          </Text>
          <PrimaryButton title="Open Settings" icon="settings" small testID="open-settings-btn" onPress={() => Linking.openSettings()} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  blocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: withAlpha(colors.warning, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(colors.warning, 0.35),
    borderRadius: radius.md,
    padding: spacing.md,
  },
  blockedText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.onSurfaceSecondary,
  },
}));
