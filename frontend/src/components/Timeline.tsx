import dayjs from "dayjs";
import { Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { statusMeta } from "@/src/components/status-meta";
import { fonts, makeStyles, spacing, useTheme, withAlpha } from "@/src/theme";
import type { ReportStatus, TimelineEvent } from "@/src/types";

export function Timeline({ events, testID }: { events: TimelineEvent[]; testID?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View testID={testID ?? "report-timeline"} style={styles.wrap}>
      {events.map((event, i) => {
        const meta = statusMeta(event.status as ReportStatus, colors);
        return (
          <View key={`${i}-${event.label}`} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: withAlpha(meta.color, 0.14), borderColor: meta.color }]}>
                <Ionicons name="checkmark" size={12} color={meta.color} />
              </View>
              {i < events.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.body}>
              <Text style={styles.label}>{event.label}</Text>
              {event.note ? <Text style={styles.note}>{event.note}</Text> : null}
              <Text style={styles.time}>
                {event.actor ? `${event.actor} · ` : ""}
                {dayjs(event.at).format("DD MMM, h:mm A")}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    gap: 0,
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
