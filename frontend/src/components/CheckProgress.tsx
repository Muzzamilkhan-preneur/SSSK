import { ActivityIndicator, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, LinearTransition, ReduceMotion, ZoomIn } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";

export type CheckStep = { key: string; label: string; doneLabel?: string; advisory?: boolean };

type Props = {
  title?: string;
  steps: CheckStep[];
  pending: boolean;
  pendingLabel?: string;
  pendingSteps?: boolean;
  centerPending?: boolean;
  results?: Record<string, boolean> | null;
  revealedCount?: number;
  singleStep?: boolean;
  progressivelyReveal?: boolean;
  variant?: "default" | "kinetic";
  testID?: string;
};

export function CheckProgress({
  title,
  steps,
  pending,
  pendingLabel,
  pendingSteps = true,
  centerPending = false,
  results,
  revealedCount = steps.length,
  singleStep = false,
  progressivelyReveal = false,
  variant = "default",
  testID = "check-progress",
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const allRows = pending && !pendingSteps
    ? [{ step: { key: "pending", label: pendingLabel ?? "Processing…" }, index: -1 }]
    : steps.map((step, index) => ({ step, index }));
  const rows =
    singleStep && !pending
      ? allRows.filter(({ index }) => index === Math.min(revealedCount - 1, steps.length - 1))
      : progressivelyReveal && !pending
        ? allRows.filter(({ index }) => index < revealedCount)
        : allRows;

  return (
    <Animated.View
      entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
      layout={singleStep || progressivelyReveal ? LinearTransition.duration(260).reduceMotion(ReduceMotion.System) : undefined}
      style={[styles.card, variant === "kinetic" && styles.kineticCard]}
      testID={testID}
    >
      {title ? <Text style={[styles.title, variant === "kinetic" && styles.kineticTitle]}>{title}</Text> : null}
      {pendingLabel && pendingSteps ? <Text style={styles.pendingLabel}>{pendingLabel}</Text> : null}
      {rows.map(({ step, index }) => {
        const revealed = index < revealedCount;
        const result = revealed && results ? results[step.key] : undefined;
        const state: "active" | "waiting" | "pass" | "fail" =
          pending ? "active" : result === true ? "pass" : result === false ? "fail" : "waiting";
        const advisoryFailure = step.advisory && state === "fail";
        const color = advisoryFailure
          ? colors.warning
          : state === "fail"
            ? colors.error
            : state === "pass"
              ? colors.success
              : colors.muted;
        return (
          <Animated.View
            key={`${step.key}-${state}`}
            entering={variant === "kinetic"
              ? FadeIn.duration(progressivelyReveal ? 260 : 180).reduceMotion(ReduceMotion.System)
              : singleStep
                ? FadeInUp.duration(280).reduceMotion(ReduceMotion.System)
                : FadeInDown.duration(180).reduceMotion(ReduceMotion.System)}
            exiting={singleStep ? FadeOut.duration(220).reduceMotion(ReduceMotion.System) : undefined}
            layout={singleStep || progressivelyReveal ? LinearTransition.duration(240).reduceMotion(ReduceMotion.System) : undefined}
            style={[
              styles.row,
              variant === "kinetic" && styles.kineticRow,
              index === -1 && centerPending && styles.centerPendingRow,
            ]}
            testID={`${testID}-step-${step.key}`}
          >
            <View
              style={[
                styles.icon,
                variant === "kinetic" && styles.kineticIcon,
                { backgroundColor: variant === "kinetic" ? "transparent" : withAlpha(color, state === "waiting" ? 0.08 : 0.12) },
              ]}
            >
              {state === "active" ? (
                <ActivityIndicator size="small" color={colors.brandPrimary} />
              ) : (
                <Animated.View entering={variant === "kinetic" || progressivelyReveal
                  ? FadeIn.duration(160).reduceMotion(ReduceMotion.System)
                  : ZoomIn.duration(260).reduceMotion(ReduceMotion.System)}>
                  <Ionicons
                    name={advisoryFailure ? "alert-circle-outline" : state === "fail" ? "close" : state === "waiting" ? "ellipse-outline" : "checkmark"}
                    size={variant === "kinetic" ? 16 : 14}
                    color={color}
                  />
                </Animated.View>
              )}
            </View>
            <Text style={[
              styles.label,
              variant === "kinetic" && styles.kineticLabel,
              index === -1 && centerPending && styles.centerPendingLabel,
              state === "waiting" && styles.labelWaiting,
              state === "fail" && !step.advisory && { color: colors.error },
              advisoryFailure && { color: colors.warning },
            ]}>
              {state === "pass" && step.doneLabel ? step.doneLabel : step.label}
            </Text>
            {step.advisory && variant !== "kinetic" ? <Text style={[styles.advisoryLabel, advisoryFailure && { color: colors.warning }]}>Advisory</Text> : null}
          </Animated.View>
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
  kineticCard: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
  },
  pendingLabel: {
    fontFamily: fonts.text,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceTertiary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  kineticRow: {
    minHeight: 44,
    gap: spacing.md,
  },
  centerPendingRow: {
    alignSelf: "center",
    justifyContent: "center",
  },
  icon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  kineticIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  kineticTitle: {
    fontSize: 12,
    letterSpacing: 0.7,
  },
  label: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.onSurface,
  },
  kineticLabel: {
    fontSize: 14,
  },
  centerPendingLabel: {
    flex: 0,
    fontSize: 15,
  },
  labelWaiting: {
    color: colors.muted,
  },
  advisoryLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
}));
