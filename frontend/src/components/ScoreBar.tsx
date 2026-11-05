import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { makeStyles, radius } from "@/src/theme";

export function ScoreBar({ value, color, testID }: { value: number; color: string; testID?: string }) {
  const styles = useStyles();
  const progress = useSharedValue(0);
  const clamped = Math.min(Math.max(value, 0), 1);

  useEffect(() => {
    progress.value = withTiming(clamped, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [clamped, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${Math.max(progress.value * 100, 3)}%` }));

  return (
    <View testID={testID} style={styles.track}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
    flex: 1,
  },
  fill: {
    height: 6,
    borderRadius: radius.pill,
  },
}));
