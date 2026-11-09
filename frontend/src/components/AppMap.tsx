import { useEffect, useRef } from "react";
import MapView, { Marker, type MapPressEvent } from "react-native-maps";

import { statusMeta } from "@/src/components/status-meta";
import { useTheme } from "@/src/theme";
import type { ReportStatus } from "@/src/types";

export type AppMapMarker = { id: string; lat: number; lng: number; status?: ReportStatus };

export type AppMapProps = {
  lat: number;
  lng: number;
  selectedPoint?: { lat: number; lng: number } | null;
  markers?: AppMapMarker[];
  selectedId?: string | null;
  pickable?: boolean; // tap / drag to place the single pin
  markerVisible?: boolean;
  followCenter?: boolean;
  pannable?: boolean; // drag & zoom
  onSelect?: (lat: number, lng: number) => void;
  onMarkerPress?: (id: string) => void;
  height?: number;
  style?: object;
  testID?: string;
};

export function AppMap({ lat, lng, selectedPoint, markers = [], selectedId, pickable = false, markerVisible = true, followCenter = true, pannable = false, onSelect, onMarkerPress, height = 220, style, testID }: AppMapProps) {
  const { colors } = useTheme();
  const ref = useRef<MapView>(null);
  const movable = pickable || pannable;

  // Follow the focus point smoothly (e.g. when a report is tapped in the list).
  useEffect(() => {
    if (!followCenter) return;
    ref.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 250);
  }, [followCenter, lat, lng]);

  return (
    <MapView
      ref={ref}
      testID={testID}
      style={[{ height }, style]}
      initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: markers.length > 1 ? 0.18 : 0.01, longitudeDelta: markers.length > 1 ? 0.18 : 0.01 }}
      onPress={pickable && onSelect ? (e: MapPressEvent) => onSelect(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude) : undefined}
      scrollEnabled={movable}
      zoomEnabled={movable}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
    >
      {markers.length === 0 ? markerVisible ? (
        <Marker
          coordinate={{ latitude: selectedPoint?.lat ?? lat, longitude: selectedPoint?.lng ?? lng }}
          draggable={pickable}
          pinColor={pickable ? colors.success : colors.brandPrimary}
          onDragEnd={(e) => onSelect?.(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
        />
      ) : null : (
        markers.map((m) => (
          <Marker
            key={`${m.id}-${m.id === selectedId ? "sel" : "n"}`}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            pinColor={m.status ? statusMeta(m.status, colors).color : colors.brandPrimary}
            opacity={selectedId && m.id !== selectedId ? 0.55 : 1}
            onPress={() => onMarkerPress?.(m.id)}
          />
        ))
      )}
    </MapView>
  );
}
