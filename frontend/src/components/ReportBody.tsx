import { Image } from "expo-image";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import Animated, { FadeIn, ReduceMotion, useReducedMotion } from "react-native-reanimated";
import { useState } from "react";

import { fileUrl } from "@/src/api";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Kicker } from "@/src/components/Card";
import { ReportFindingsCard } from "@/src/components/ReportFindingsCard";
import { SeverityChip } from "@/src/components/SeverityChip";
import { StatusBadge } from "@/src/components/StatusBadge";
import { ProgressTimeline, Timeline } from "@/src/components/Timeline";
import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";
import type { Report } from "@/src/types";

type Props = {
  report: Report;
  children?: ReactNode;
  communityCount?: number;
  communityNotice?: string;
  imagePath?: string | null;
  compactTimeline?: boolean;
  animated?: boolean;
};

export function ReportBody({
  report,
  children,
  communityCount,
  communityNotice,
  imagePath,
  compactTimeline = false,
  animated = false,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const [showPhoto, setShowPhoto] = useState(false);
  const primaryImagePath = imagePath ?? report.image_path;
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
      note: report.address || "Karachi",
      at: submittedEvent?.at ?? report.created_at,
      actor: submittedEvent?.actor ?? report.citizen_name,
      completed: true,
    },
    {
      label: "AI inspection completed",
      at: inspectionEvent?.at ?? report.created_at,
      completed: true,
    },
    ...(report.reporter_count > 1
      ? [{
          label: "Citizens contributed",
          note: `${report.reporter_count} contributors`,
          at: latestReporter?.at ?? submittedEvent?.at ?? report.created_at,
          completed: true,
        }]
      : []),
    {
      label: report.status === "pending_review"
        ? "Awaiting Mayor review"
        : report.status === "rejected"
          ? "Report rejected"
          : "Mayor assigns a contractor",
      note: assignmentComplete && report.contractor_name
        ? `Assigned to ${report.contractor_name}`
        : report.status === "pending_review"
          ? "Pending administrative review"
          : report.status === "rejected"
            ? "Closed after review"
          : undefined,
      at: assignmentEvent?.at,
      actor: assignmentEvent?.actor,
      completed: assignmentComplete || report.status === "rejected",
    },
    ...(report.status === "rejected" ? [] : [{
      label: "Contractor fixes the pothole",
      note: report.status === "rework" ? "More repair work is needed" : undefined,
      at: repairEvent?.at,
      actor: repairEvent?.actor,
      completed: repairComplete,
    }]),
  ];
  const entering = (delay = 0) => animated
    ? FadeIn.duration(reduceMotion ? 0 : 240)
      .delay(reduceMotion ? 0 : delay)
      .reduceMotion(ReduceMotion.System)
    : undefined;

  return (
    <View style={styles.wrap} testID="report-body">
      <Animated.View entering={entering()}>
        {compactTimeline ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Expand report photo"
            onPress={() => setShowPhoto(true)}
            style={styles.photoButton}
            testID="report-photo-expand"
          >
            <Image
              source={{ uri: fileUrl(primaryImagePath) }}
              style={[styles.hero, styles.citizenHero]}
              contentFit="cover"
              transition={240}
            />
            <View style={styles.photoButtonLabel}>
              <Ionicons name="expand-outline" size={15} color={colors.onSurfaceInverse} />
              <Text style={styles.photoButtonText}>View photo</Text>
            </View>
          </Pressable>
        ) : (
          <Image
            source={{ uri: fileUrl(primaryImagePath) }}
            style={styles.hero}
            contentFit="cover"
            transition={240}
          />
        )}
      </Animated.View>
      {compactTimeline ? (
        <Modal
          animationType="fade"
          onRequestClose={() => setShowPhoto(false)}
          statusBarTranslucent
          transparent
          visible={showPhoto}
        >
          <View style={styles.photoViewer} testID="report-photo-viewer">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close photo"
              onPress={() => setShowPhoto(false)}
              style={styles.photoClose}
              testID="report-photo-close"
            >
              <Ionicons name="close" size={24} color={colors.onSurfaceInverse} />
            </Pressable>
            <Image
              source={{ uri: fileUrl(primaryImagePath) }}
              style={styles.photoViewerImage}
              contentFit="contain"
            />
          </View>
        </Modal>
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
        <Kicker icon="location">{compactTimeline ? "Location" : "Pinned location"}</Kicker>
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${report.lat},${report.lng}`)}
          style={styles.locationLink}
        >
          <View style={styles.locationText}>
            <Text style={styles.address}>{report.address || "Karachi"}</Text>
            <View style={styles.mapLink}>
              <Text style={styles.coordinates}>{report.lat.toFixed(5)}, {report.lng.toFixed(5)}</Text>
              <Text style={styles.mapSeparator}>·</Text>
              <Ionicons name="map-outline" size={15} color={colors.brandPrimary} />
              <Text style={styles.mapLinkText}>Open in Maps</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
        </Pressable>
      </Animated.View>
      {communityCount !== undefined ? (
        <Animated.View
          entering={entering(140)}
          style={[styles.section, compactTimeline && styles.dividedSection]}
          testID="community-report-count"
        >
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
              {communityCount === 1
                ? "citizen profile has reported this issue"
                : "citizen profiles have reported this issue"}
            </Text>
          </View>
          {communityNotice ? <Text style={styles.notice}>{communityNotice}</Text> : null}
        </Animated.View>
      ) : null}
      {report.findings.length ? (
        <ReportFindingsCard findings={report.findings} severity={report.severity} />
      ) : null}
      {report.description ? (
        <Animated.View entering={entering(180)} style={styles.section}>
          <Kicker icon="chatbubble-ellipses">Citizen note</Kicker>
          <Text style={styles.body}>{report.description}</Text>
        </Animated.View>
      ) : null}
      <Animated.View entering={entering(220)} style={styles.section}>
        {compactTimeline
          ? <ProgressTimeline events={progressEvents} animated={animated} />
          : (
            <>
              <Kicker icon="time">Timeline</Kicker>
              <Timeline events={report.timeline} animated={animated} />
            </>
          )}
      </Animated.View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: spacing.lg },
  hero: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: colors.surfaceTertiary },
  citizenHero: { aspectRatio: 1.9 },
  photoButton: { position: "relative" },
  photoButtonLabel: {
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
  photoButtonText: { fontFamily: fonts.medium, fontSize: 12, color: colors.onSurfaceInverse },
  photoViewer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: colors.surfaceInverse,
    padding: spacing.md,
  },
  photoViewerImage: { width: "100%", height: "82%" },
  photoClose: {
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
  meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  section: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dividedSection: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.md,
  },
  address: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  coordinates: { marginTop: spacing.xs, fontFamily: fonts.text, fontSize: 12, color: colors.brandPrimary },
  body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.onSurfaceSecondary },
  countRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  count: { fontFamily: fonts.bold, fontSize: 22, color: colors.onSurface },
  communityText: { flex: 1, fontFamily: fonts.text, fontSize: 15, lineHeight: 21, color: colors.onSurface },
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
  locationLink: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  locationText: { flex: 1, gap: spacing.xs },
  mapLink: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  mapSeparator: { color: colors.muted, fontFamily: fonts.text, fontSize: 12 },
  mapLinkText: { color: colors.brandPrimary, fontFamily: fonts.medium, fontSize: 13 },
}));
