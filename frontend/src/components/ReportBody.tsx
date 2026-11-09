import { Image } from "expo-image";
import { Linking, Text, View } from "react-native";
import type { ReactNode } from "react";
import Animated, { FadeIn, ReduceMotion, useReducedMotion } from "react-native-reanimated";

import { fileUrl } from "@/src/api";
import { Kicker } from "@/src/components/Card";
import { InspectionCard } from "@/src/components/AICards";
import { SeverityChip } from "@/src/components/SeverityChip";
import { StatusBadge } from "@/src/components/StatusBadge";
import { ProgressTimeline, Timeline } from "@/src/components/Timeline";
import { fonts, makeStyles, spacing, withAlpha } from "@/src/theme";
import type { Report } from "@/src/types";

type Props = {
  report: Report;
  children?: ReactNode;
  communityCount?: number;
  communityNotice?: string;
  compactTimeline?: boolean;
  animated?: boolean;
};

export function ReportBody({
  report,
  children,
  communityCount,
  communityNotice,
  compactTimeline = false,
  animated = false,
}: Props) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const submittedEvent = report.timeline.find((event) => event.label === "Report Submitted");
  const inspectionEvent = report.timeline.find((event) => event.label === "AI Inspection Complete");
  const assignmentEvent = report.timeline.find((event) => event.status === "assigned");
  const repairEvent = report.timeline.find((event) => event.status === "verified");
  const latestReporter = report.reporters[report.reporters.length - 1];
  const assignmentComplete = !!report.contractor_id || !!assignmentEvent;
  const repairComplete = report.status === "verified" || !!repairEvent;
  const progressEvents = [
    {
      label: "Report submitted",
      at: submittedEvent?.at ?? report.created_at,
      actor: submittedEvent?.actor ?? report.citizen_name,
      completed: true,
    },
    {
      label: "AI inspection completed",
      at: inspectionEvent?.at ?? report.created_at,
      completed: true,
    },
    {
      label: "Citizens contributed",
      note: `${report.reporter_count} ${report.reporter_count === 1 ? "contributor" : "contributors"}`,
      at: latestReporter?.at ?? submittedEvent?.at ?? report.created_at,
      completed: true,
    },
    {
      label: "Mayor assigns a contractor",
      note: assignmentComplete && report.contractor_name
        ? `Assigned to ${report.contractor_name}`
        : undefined,
      at: assignmentEvent?.at,
      actor: assignmentEvent?.actor,
      completed: assignmentComplete,
    },
    {
      label: "Contractor fixes the pothole",
      note: report.status === "rework" ? "More repair work is needed" : undefined,
      at: repairEvent?.at,
      actor: repairEvent?.actor,
      completed: repairComplete,
    },
  ];
  const entering = (delay = 0) => animated
    ? FadeIn.duration(reduceMotion ? 0 : 240)
      .delay(reduceMotion ? 0 : delay)
      .reduceMotion(ReduceMotion.System)
    : undefined;

  return (
    <View style={styles.wrap} testID="report-body">
      <Animated.View entering={entering()}>
        <Image source={{ uri: fileUrl(report.image_path) }} style={styles.hero} contentFit="cover" transition={240} />
      </Animated.View>
      {report.extra_image_paths?.length ? (
        <Animated.View entering={entering(30)} style={styles.section} testID="report-additional-evidence">
          <Kicker icon="images">Additional evidence</Kicker>
          {report.extra_image_paths.map((path) => (
            <Image key={path} source={{ uri: fileUrl(path) }} style={styles.hero} contentFit="cover" transition={240} />
          ))}
        </Animated.View>
      ) : null}
      {report.after_image_path ? (
        <Animated.View entering={entering(50)}>
          <Image source={{ uri: fileUrl(report.after_image_path) }} style={styles.hero} contentFit="cover" />
        </Animated.View>
      ) : null}
      <Animated.View key={`${report.severity ?? "none"}-${report.status}`} entering={entering(70)} style={styles.meta}>
        {report.severity ? <SeverityChip severity={report.severity} /> : null}
        <StatusBadge status={report.status} />
      </Animated.View>
      <Animated.View entering={entering(110)} style={styles.section}>
        <Kicker icon="location">Pinned location</Kicker>
        <Text style={styles.address}>{report.address || "Karachi"}</Text>
        <Text style={styles.coordinates} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${report.lat},${report.lng}`)}>
          {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
        </Text>
      </Animated.View>
      {communityCount !== undefined ? (
        <Animated.View entering={entering(140)} style={styles.section} testID="community-report-count">
          <Kicker icon="people">Community support</Kicker>
          <View style={styles.countRow}>
            <Animated.Text
              key={communityCount}
              entering={entering()}
              style={styles.count}
              testID="community-support-count"
            >
              {communityCount}
            </Animated.Text>
            <Text style={styles.communityText}>
              {communityCount === 1 ? "contributor" : "contributors"} on this report
            </Text>
          </View>
          {communityNotice ? <Text style={styles.notice}>{communityNotice}</Text> : null}
        </Animated.View>
      ) : null}
      {report.findings.length ? (
        <InspectionCard findings={report.findings} animated={animated} testID="report-ai-findings" />
      ) : null}
      {report.description ? (
        <Animated.View entering={entering(180)} style={styles.section}>
          <Kicker icon="chatbubble-ellipses">Citizen note</Kicker>
          <Text style={styles.body}>{report.description}</Text>
        </Animated.View>
      ) : null}
      <Animated.View entering={entering(220)} style={styles.section}>
        <Kicker icon="time">{compactTimeline ? "Report progress" : "Timeline"}</Kicker>
        {compactTimeline
          ? <ProgressTimeline events={progressEvents} animated={animated} />
          : <Timeline events={report.timeline} animated={animated} />}
      </Animated.View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: spacing.lg },
  hero: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: colors.surfaceTertiary },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  section: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  address: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  coordinates: { marginTop: spacing.xs, fontFamily: fonts.text, fontSize: 12, color: colors.brandPrimary },
  body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.onSurfaceSecondary },
  countRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  count: { fontFamily: fonts.bold, fontSize: 22, color: colors.onSurface },
  communityText: { flex: 1, fontFamily: fonts.text, fontSize: 13, lineHeight: 19, color: colors.onSurfaceSecondary },
  notice: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.success,
    backgroundColor: withAlpha(colors.success, 0.07),
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
}));
