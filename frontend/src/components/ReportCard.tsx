import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Ionicons from "@react-native-vector-icons/ionicons";

import { fileUrl } from "@/src/api";
import { SeverityChip } from "@/src/components/SeverityChip";
import { StatusBadge } from "@/src/components/StatusBadge";
import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import type { Report } from "@/src/types";

dayjs.extend(relativeTime);

type Props = {
  report: Report;
  onPress: () => void;
  selected?: boolean;
  testID?: string;
  citizenId?: string;
};

export function ReportCard({ report, onPress, selected = false, testID, citizenId }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const myContribution = citizenId
    ? report.reporters.find((reporter) => reporter.citizen_id === citizenId)
    : undefined;
  const isContributor = !!citizenId && report.citizen_id !== citizenId && !!myContribution;
  const thumbnailPath = myContribution?.image_path || report.image_path;

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Pressable
        testID={testID ?? `report-card-${report.id}`}
        onPress={onPress}
        style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}
      >
        <Image source={{ uri: fileUrl(thumbnailPath) }} style={styles.thumb} contentFit="cover" transition={200} recyclingKey={report.id} />
        <View style={styles.mid}>
          <Text numberOfLines={1} style={styles.title}>
            {report.address || "Karachi"}
          </Text>
          <Text numberOfLines={1} style={styles.sub}>
            {isContributor && myContribution
              ? "Your contribution · " + dayjs(myContribution.at).fromNow()
              : `${dayjs(report.created_at).fromNow()} · ${report.description || "Pothole report"}`}
          </Text>
          <View style={styles.meta}>
            {report.severity ? <SeverityChip severity={report.severity} /> : null}
            <StatusBadge status={report.status} />
          </View>
        </View>
        <View style={styles.right}>
          {report.reporter_count > 1 ? (
            <View style={styles.reporters} testID={`reporter-count-${report.id}`}>
              <Ionicons name="people" size={12} color={colors.onSurfaceTertiary} />
              <Text style={styles.reportersText}>{report.reporter_count}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  cardSelected: {
    borderColor: colors.borderStrong,
  },
  cardPressed: {
    backgroundColor: colors.surfaceSecondary,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
  },
  mid: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurface,
  },
  sub: {
    fontFamily: fonts.text,
    fontSize: 12.5,
    color: colors.muted,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: 2,
  },
  right: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  reporters: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    height: 22,
  },
  reportersText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
}));
