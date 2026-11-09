import { Image } from "expo-image";
import { Modal, Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useState } from "react";

import Ionicons from "@react-native-vector-icons/ionicons";
import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";

export function BeforeAfterSlider({ beforeUri, afterUri }: { beforeUri: string; afterUri: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const position = useSharedValue(0.5);
  const [accessiblePosition, setAccessiblePosition] = useState(50);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const widthValue = useSharedValue(0);
  const beforeClipStyle = useAnimatedStyle(() => ({
    width: widthValue.value * position.value,
  }));
  const dividerStyle = useAnimatedStyle(() => ({
    left: widthValue.value * position.value,
  }));
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      "worklet";
      if (widthValue.value <= 0) return;
      position.value = Math.max(0.03, Math.min(0.97, event.x / widthValue.value));
    })
    .onEnd((event) => {
      "worklet";
      if (widthValue.value > 0) {
        runOnJS(setAccessiblePosition)(Math.round(Math.max(0.03, Math.min(0.97, event.x / widthValue.value)) * 100));
      }
    });

  const comparison = (testID: string) => (
    <GestureDetector gesture={pan}>
      <Animated.View
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      accessibilityLabel="Before and after photo comparison"
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: 100, now: accessiblePosition }}
      onAccessibilityAction={(event) => {
        const next = Math.max(3, Math.min(97, accessiblePosition + (event.nativeEvent.actionName === "increment" ? 5 : -5)));
        setAccessiblePosition(next);
        position.value = next / 100;
      }}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        setWidth(nextWidth);
        widthValue.value = nextWidth;
      }}
      style={styles.comparison}
      testID={testID}
    >
      <Image source={{ uri: afterUri }} style={styles.comparisonImage} contentFit="cover" />
      <Animated.View style={[styles.beforeClip, beforeClipStyle]}>
        <Image
          source={{ uri: beforeUri }}
          style={[styles.comparisonImage, width ? { width } : null]}
          contentFit="cover"
        />
      </Animated.View>
      <Animated.View style={[styles.divider, dividerStyle]} pointerEvents="none">
        <View style={styles.dividerLine} />
        <View style={styles.handle}>
          <Ionicons name="chevron-back" size={12} color={colors.onSurfaceInverse} />
          <Ionicons name="chevron-forward" size={12} color={colors.onSurfaceInverse} />
        </View>
      </Animated.View>
      <View style={[styles.imageTag, styles.beforeTag]} pointerEvents="none">
        <Text style={styles.tagText}>Before</Text>
      </View>
      <View style={[styles.imageTag, styles.afterTag]} pointerEvents="none">
        <Text style={styles.tagText}>After</Text>
      </View>
      {!visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Expand before and after photos"
          onPress={() => setVisible(true)}
          style={styles.expandButton}
          testID="before-after-expand"
        >
          <Ionicons name="expand-outline" size={15} color={colors.onSurfaceInverse} />
          <Text style={styles.tagText}>View comparison</Text>
        </Pressable>
      ) : null}
      </Animated.View>
    </GestureDetector>
  );

  return (
    <>
      {comparison("before-after-slider")}
      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <View style={styles.viewer} testID="before-after-viewer">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close comparison"
            onPress={() => setVisible(false)}
            style={styles.close}
            testID="before-after-close"
          >
            <Ionicons name="close" size={24} color={colors.onSurfaceInverse} />
          </Pressable>
          {comparison("before-after-slider-expanded")}
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  comparison: {
    width: "100%",
    aspectRatio: 4 / 3,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
  },
  comparisonImage: { width: "100%", height: "100%" },
  beforeClip: { position: "absolute", left: 0, top: 0, bottom: 0, overflow: "hidden" },
  divider: { position: "absolute", top: 0, bottom: 0, alignItems: "center", transform: [{ translateX: -1 }] },
  dividerLine: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: colors.onSurfaceInverse },
  handle: {
    position: "absolute",
    top: "50%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    marginTop: -19,
    marginLeft: -18,
    borderRadius: 19,
    backgroundColor: colors.brandPrimary,
    borderWidth: 2,
    borderColor: colors.onSurfaceInverse,
  },
  imageTag: {
    position: "absolute",
    top: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.surfaceInverse, 0.76),
  },
  beforeTag: { left: spacing.sm },
  afterTag: { right: spacing.sm },
  tagText: { color: colors.onSurfaceInverse, fontFamily: fonts.semibold, fontSize: 12 },
  expandButton: {
    position: "absolute",
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.surfaceInverse, 0.76),
  },
  viewer: { flex: 1, justifyContent: "center", backgroundColor: colors.surfaceInverse, padding: spacing.md },
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
