import dayjs from "dayjs";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition, ReduceMotion, StretchInY, useReducedMotion } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Kicker } from "@/src/components/Card";
import { statusMeta } from "@/src/components/status-meta";
import { fonts, makeStyles, spacing, useTheme, withAlpha } from "@/src/theme";
import type { ReportStatus, TimelineEvent } from "@/src/types";

type ProgressEvent = {
  label: string;
  at?: string;
  actor?: string | null;
  note?: string | null;
  completed: boolean;
};

export function ProgressTimeline({
  events,
  animated = false,
}: {
  events: ProgressEvent[];
  animated?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const completedCount = events.filter((event) => event.completed).length;
  const currentIndex = events.findIndex((event) => !event.completed);

  return (
    <View testID="report-progress-timeline">
      <View style={styles.progressHeader}>
        <Kicker icon="time">Report activity</Kicker>
        <Text style={styles.progressCount}>{completedCount}/{events.length} complete</Text>
      </View>
      <View style={styles.progressList} testID="report-timeline-details">
        {events.map((event, index) => {
          const current = index === currentIndex;
          const color = event.completed ? colors.success : current ? colors.brandPrimary : colors.muted;
          return (
            <Animated.View
              key={`${index}-${event.label}`}
              entering={animated
                ? FadeInDown.duration(reduceMotion ? 0 : 180)
                  .delay(reduceMotion ? 0 : Math.min(index, 4) * 35)
                  .reduceMotion(ReduceMotion.System)
                : undefined}
              layout={animated ? LinearTransition.duration(180).reduceMotion(ReduceMotion.System) : undefined}
              style={styles.progressRow}
            >
              <View style={styles.progressRail}>
                <View
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: event.completed ? color : colors.surface,
                      borderColor: color,
                    },
                  ]}
                >
                  {event.completed ? (
                    <Ionicons name="checkmark" size={13} color={colors.onSuccess} />
                  ) : current ? (
                    <View style={[styles.currentDot, { backgroundColor: colors.brandPrimary }]} />
                  ) : null}
                </View>
                {index < events.length - 1 ? (
                  <Animated.View
                    entering={animated
                      ? StretchInY.duration(reduceMotion ? 0 : 180)
                        .delay(reduceMotion ? 0 : Math.min(index, 4) * 35 + 50)
                        .reduceMotion(ReduceMotion.System)
                      : undefined}
                    style={[
                      styles.progressLine,
                      { backgroundColor: events[index + 1].completed ? colors.success : colors.divider },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.progressBody}>
                <Text style={[styles.progressLabel, current && styles.currentProgressLabel, !event.completed && !current && styles.incompleteLabel]}>
                  {event.label}
                </Text>
                {event.note ? <Text style={styles.progressNote}>{event.note}</Text> : null}
                {event.completed && event.at ? (
                  <Text style={styles.progressTime}>
                    {event.actor ? `${event.actor} · ` : ""}
                    {dayjs(event.at).format("DD MMM, h:mm A")}
                  </Text>
                ) : null}
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

export function Timeline({ events, testID, animated = false }: { events: TimelineEvent[]; testID?: string; animated?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  return (
    <View testID={testID ?? "report-timeline"} style={styles.wrap}>
      {events.map((event, i) => {
        const meta = statusMeta(event.status as ReportStatus, colors);
        return (
          <Animated.View
            key={`${i}-${event.label}`}
            entering={animated
              ? FadeIn.duration(reduceMotion ? 0 : 220)
                .delay(reduceMotion ? 0 : Math.min(i, 4) * 70)
                .reduceMotion(ReduceMotion.System)
              : undefined}
            layout={animated ? LinearTransition.duration(220).reduceMotion(ReduceMotion.System) : undefined}
            style={styles.row}
          >
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: withAlpha(meta.color, 0.14), borderColor: meta.color }]}>
                <Ionicons name="checkmark" size={12} color={meta.color} />
              </View>
              {i < events.length - 1 ? (
                <Animated.View
                  entering={animated
                    ? StretchInY.duration(reduceMotion ? 0 : 220)
                      .delay(reduceMotion ? 0 : Math.min(i, 4) * 70 + 80)
                      .reduceMotion(ReduceMotion.System)
                    : undefined}
                  style={styles.line}
                />
              ) : null}
            </View>
            <View style={styles.body}>
              <Text style={styles.label}>{event.label}</Text>
              {event.note ? <Text style={styles.note}>{event.note}</Text> : null}
              <Text style={styles.time}>
                {event.actor ? `${event.actor} · ` : ""}
                {dayjs(event.at).format("DD MMM, h:mm A")}
              </Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: 0 },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  progressCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.onSurfaceTertiary },
  progressList: { paddingTop: spacing.xs },
  progressRow: { flexDirection: "row", gap: spacing.sm },
  progressRail: { alignItems: "center", width: 24 },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  currentDot: { width: 7, height: 7, borderRadius: 4 },
  progressLine: { width: 2, flex: 1, marginVertical: 2 },
  progressBody: {
    flex: 1,
    paddingBottom: spacing.md,
    gap: 2,
  },
  progressLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurface,
  },
  currentProgressLabel: { color: colors.brandPrimary },
  progressNote: {
    fontFamily: fonts.text,
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceSecondary,
  },
  progressTime: {
    fontFamily: fonts.text,
    fontSize: 11,
    color: colors.muted,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  rail: {
    alignItems: "center",
    width: 26,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.divider,
    marginVertical: 2,
  },
  body: {
    flex: 1,
    paddingBottom: spacing.lg,
    gap: 2,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurface,
    paddingTop: 3,
  },
  incompleteLabel: {
    color: colors.muted,
  },
  note: {
    fontFamily: fonts.text,
    fontSize: 12.5,
    color: colors.onSurfaceTertiary,
    lineHeight: 17,
  },
  time: {
    fontFamily: fonts.text,
    fontSize: 11,
    color: colors.muted,
  },
}));
