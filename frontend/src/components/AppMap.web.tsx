import { Text, View } from "react-native";

import type { AppMapProps } from "@/src/components/AppMap";
import { fonts, makeStyles, radius, spacing, useTheme, withAlpha } from "@/src/theme";

// Web preview: OpenStreetMap embed centred on the focus point (no API key).
// Tap-to-pin and multi-pin colours are phone-only; use "Use My Location" here.
export function AppMap({ lat, lng, selectedPoint, pickable = false, markerVisible = true, height = 220, style, testID }: AppMapProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const d = 0.006;
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
  const markerLat = selectedPoint?.lat ?? lat;
  const markerLng = selectedPoint?.lng ?? lng;
  const marker = markerVisible ? `&marker=${markerLat}%2C${markerLng}` : "";
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${marker}`;
  return (
    <View testID={testID} style={[{ height, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary }, style]}>
      <iframe key={src} src={src} title="map" style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
      {pickable ? (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>Tap-to-pin works in the phone app. Use “Use My Location” here.</Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  hint: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    top: spacing.md,
    backgroundColor: withAlpha(colors.surfaceInverse, 0.85),
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  hintText: {
    color: colors.onSurfaceInverse,
    fontFamily: fonts.medium,
    fontSize: 11,
    textAlign: "center",
  },
}));
