import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { makeStyles, radius, spacing } from "@/src/theme";

function SkeletonRow({ index }: { index: number }) {
  const styles = useStyles();
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 + index * 90 }), withTiming(0.55, { duration: 700 + index * 90 })),
      -1,
      false,
    );
    return () => {
      opacity.value = 0.55;
    };
  }, [opacity, index]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.row, pulse]} />;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.wrap} testID="skeleton-list">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  row: {
    height: 100,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
  },
}));
