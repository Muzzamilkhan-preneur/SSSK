import { Image } from "expo-image";
import { Modal, Pressable, Text, View } from "react-native";
import type { ImageStyle, StyleProp } from "react-native";
import { useState } from "react";

import Ionicons from "@react-native-vector-icons/ionicons";
import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";

export function ExpandableImage({
  uri,
  style,
  testID = "expandable-image",
  showLabel = true,
}: {
  uri: string;
  style: StyleProp<ImageStyle>;
  testID?: string;
  showLabel?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Expand photo"
        onPress={(event) => {
          event.stopPropagation();
          setVisible(true);
        }}
        style={styles.preview}
        testID={testID}
      >
        <Image source={{ uri }} style={style} contentFit="cover" transition={200} />
        <View style={styles.previewLabel} pointerEvents="none">
          <Ionicons name="expand-outline" size={14} color={colors.onSurfaceInverse} />
          {showLabel ? <Text style={styles.previewText}>View photo</Text> : null}
        </View>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <View style={styles.viewer} testID={`${testID}-viewer`}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={() => setVisible(false)}
            style={styles.close}
            testID={`${testID}-close`}
          >
            <Ionicons name="close" size={24} color={colors.onSurfaceInverse} />
          </Pressable>
          <Image source={{ uri }} style={styles.viewerImage} contentFit="contain" />
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  preview: { position: "relative" },
  previewLabel: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.surfaceInverse, 0.78),
  },
  previewText: { fontFamily: fonts.medium, fontSize: 12, color: colors.onSurfaceInverse },
  viewer: { flex: 1, justifyContent: "center", backgroundColor: colors.surfaceInverse, padding: spacing.md },
  viewerImage: { width: "100%", height: "82%" },
  close: {
    position: "absolute",
    zIndex: 1,
    top: spacing.xl,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.surface, 0.18),
  },
}));
