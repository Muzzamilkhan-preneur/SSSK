import { Image } from "expo-image";
import { Linking, Text, View } from "react-native";
import type { ReactNode } from "react";

import { fileUrl } from "@/src/api";
import { Card, Kicker } from "@/src/components/Card";
import { SeverityChip } from "@/src/components/SeverityChip";
import { StatusBadge } from "@/src/components/StatusBadge";
import { fonts, makeStyles, spacing, useTheme } from "@/src/theme";
import type { Report } from "@/src/types";

type Props = {
  report: Report;
  children?: ReactNode;
};

export function ReportBody({ report, children }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.wrap}>
      <Image source={{ uri: fileUrl(report.image_path) }} style={styles.hero} contentFit="cover" />
      {report.after_image_path ? <Image source={{ uri: fileUrl(report.after_image_path) }} style={styles.hero} contentFit="cover" /> : null}
      <View style={styles.meta}>
        {report.severity ? <SeverityChip severity={report.severity} /> : null}
        <StatusBadge status={report.status} />
      </View>
      <Card>
        <Kicker icon="location">Pinned location</Kicker>
        <Text style={styles.address}>{report.address || "Karachi"}</Text>
        <Text style={styles.coordinates} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${report.lat},${report.lng}`)}>
          {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
        </Text>
      </Card>
      {report.description ? (
        <Card>
          <Kicker icon="chatbubble-ellipses">Citizen note</Kicker>
          <Text style={styles.body}>{report.description}</Text>
        </Card>
      ) : null}
      <Card>
        <Kicker icon="time">Timeline</Kicker>
        <View style={styles.timeline}>
          {report.timeline.map((event, index) => (
            <View key={`${event.at}-${index}`} style={styles.event}>
              <View style={[styles.dot, { backgroundColor: colors.brandPrimary }]} />
              <View style={styles.eventBody}>
                <Text style={styles.eventLabel}>{event.label}</Text>
                {event.note ? <Text style={styles.eventNote}>{event.note}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      </Card>
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { gap: spacing.lg },
  hero: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: colors.surfaceTertiary },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  address: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  coordinates: { marginTop: spacing.xs, fontFamily: fonts.text, fontSize: 12, color: colors.brandPrimary },
  body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.onSurfaceSecondary },
  timeline: { gap: spacing.md },
  event: { flexDirection: "row", gap: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  eventBody: { flex: 1, gap: 2 },
  eventLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurface },
  eventNote: { fontFamily: fonts.text, fontSize: 12.5, lineHeight: 18, color: colors.onSurfaceTertiary },
}));
