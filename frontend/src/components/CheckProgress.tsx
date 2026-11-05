import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";

export type CheckStep = { key: string; label: string; doneLabel?: string };

type Props = {
  title: string;
  steps: CheckStep[];
  // While pending, steps advance one by one (calm, ~700ms each) and wait on the last.
  pending: boolean;
  // When results arrive, each step shows pass/fail.
  results?: Record<string, boolean> | null;
  testID?: string;
};

export function CheckProgress({ title, steps, pending, results, testID = "check-progress" }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!pending) return;
    setActive(0);
    const id = setInterval(() => setActive((i) => Math.min(i + 1, steps.length - 1)), 700);
    return () => clearInterval(id);
  }, [pending, steps.length]);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.card} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      {steps.map((step, i) => {
        const result = results ? results[step.key] : undefined;
        const state: "done" | "active" | "waiting" | "pass" | "fail" =
          result === true ? "pass" : result === false ? "fail" : pending ? (i < active ? "done" : i === active ? "active" : "waiting") : "waiting";
        const color = state === "fail" ? colors.error : state === "pass" || state === "done" ? colors.success : colors.muted;
        return (
          <View key={step.key} style={styles.row} testID={`${testID}-step-${step.key}`}>
            <View style={[styles.icon, { backgroundColor: withAlpha(color, state === "waiting" ? 0.08 : 0.12) }]}>
              {state === "active" ? (
                <ActivityIndicator size="small" color={colors.onSurfaceTertiary} />
              ) : (
                <Ionicons name={state === "fail" ? "close" : state === "waiting" ? "ellipse-outline" : "checkmark"} size={14} color={color} />
              )}
            </View>
            <Text style={[styles.label, state === "waiting" && styles.labelWaiting, state === "fail" && { color: colors.error }]}>{state === "pass" && step.doneLabel ? step.doneLabel : step.label}</Text>
          </View>
        );
      })}
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.onSurface,
  },
  labelWaiting: {
    color: colors.muted,
  },
}));
