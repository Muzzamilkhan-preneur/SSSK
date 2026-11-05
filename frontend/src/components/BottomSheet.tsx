import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  testID?: string;
};

export function BottomSheet({ visible, onClose, title, children, testID }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const drag = useSharedValue(1); // 1 = hidden, 0 = open

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      drag.value = withTiming(1, { duration: 200 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = Gesture.Pan()
    .onChange((e) => {
      drag.value = Math.max(0, Math.min(1, drag.value + e.changeY / 460));
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) {
        drag.value = withTiming(1, { duration: 200 }, (done) => {
          if (done) runOnJS(onClose)();
        });
      } else {
        drag.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      }
    });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value * 640 }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: 1 - drag.value }));

  if (!mounted) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View style={[styles.backdropWrap, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID="sheet-backdrop" accessibilityLabel="Close sheet" />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID={testID}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <Text style={styles.title}>{title}</Text>
              <Pressable testID={testID ? `${testID}-close` : "sheet-close-btn"} onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  fill: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha("#141414", 0.5),
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.onSurface,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
}));
