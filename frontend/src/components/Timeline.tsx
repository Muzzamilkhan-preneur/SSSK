import dayjs from "dayjs";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition, ReduceMotion, StretchInY, useReducedMotion } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useState } from "react";

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
  const [expanded, setExpanded] = useState(false);
  const visibleEvents = expanded ? events : events.slice(0, 3);

  return (
    <View testID="report-progress-timeline">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.progressHeader}
        testID="report-timeline-toggle"
      >
        <Kicker icon="time">Report activity</Kicker>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.onSurfaceSecondary}
        />
      </Pressable>
      <View style={styles.progressList} testID="report-timeline-details">
        {visibleEvents.map((event, index) => {
          const color = event.completed ? colors.success : colors.muted;
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
                    <Ionicons name="checkmark" size={15} color={colors.onSuccess} />
                  ) : null}
                </View>
                {index < visibleEvents.length - 1 ? (
                  <Animated.View
                    entering={animated
                      ? StretchInY.duration(reduceMotion ? 0 : 180)
                        .delay(reduceMotion ? 0 : Math.min(index, 4) * 35 + 50)
                        .reduceMotion(ReduceMotion.System)
                      : undefined}
                    style={[
                      styles.progressLine,
                      { backgroundColor: visibleEvents[index + 1].completed ? colors.success : colors.divider },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.progressBody}>
                <Text style={[styles.progressLabel, !event.completed && styles.incompleteLabel]}>
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
  wrap: {
    gap: 0,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  progressList: {
    paddingTop: spacing.sm,
  },
  progressRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  progressRail: {
    alignItems: "center",
    width: 30,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  progressLine: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  progressBody: {
    flex: 1,
    paddingBottom: spacing.lg,
    gap: 3,
  },
  progressLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.onSurface,
  },
  progressNote: {
    fontFamily: fonts.text,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurfaceSecondary,
  },
  progressTime: {
    fontFamily: fonts.text,
    fontSize: 12,
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
