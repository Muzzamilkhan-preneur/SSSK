import { useEffect, useMemo, useRef, useState } from "react";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import type { AppMapProps } from "@/src/components/AppMap";
import { statusMeta } from "@/src/components/status-meta";
import { useTheme } from "@/src/theme";

const EMPTY_MARKERS: NonNullable<AppMapProps["markers"]> = [];

/**
 * Native fallback map backed by OpenStreetMap tiles. This avoids the Google
 * Maps API key requirement of react-native-maps in standalone Android builds.
 */
export function AppMap({ lat, lng, selectedPoint, markers = EMPTY_MARKERS, selectedId, pickable = false, markerVisible = true, followCenter = true, pannable = false, onSelect, onMarkerPress, height = 220, style, testID }: AppMapProps) {
  const { colors } = useTheme();
  const mapRef = useRef<WebView<object> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const html = useMemo(() => {
    const markerData = JSON.stringify(markers.map((m) => ({
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      color: m.status ? statusMeta(m.status, colors).color : colors.brandPrimary,
      selected: m.id === selectedId,
    })));
    const centerLat = Number.isFinite(lat) ? lat : 24.8607;
    const centerLng = Number.isFinite(lng) ? lng : 67.0011;
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>*{box-sizing:border-box}html,body,#map{height:100%;width:100%;margin:0;background:${colors.surfaceTertiary}}.leaflet-control-attribution{font-size:9px}.picked-pin{background:transparent;border:0}.picked-pin div{width:24px;height:24px;background:${colors.success};border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px #0005;animation:pin-drop .2s ease-out}@keyframes pin-drop{from{opacity:0;transform:translateY(-8px) rotate(-45deg)}to{opacity:1;transform:translateY(0) rotate(-45deg)}}@media(prefers-reduced-motion:reduce){.picked-pin div{animation:none}}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
      const map=L.map('map',{zoomControl:true,scrollWheelZoom:false,dragging:${pickable || pannable},tap:true}).setView([${centerLat},${centerLng}],${markers.length > 1 ? 12 : 15});
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
      const items=${markerData};
      if(items.length){items.forEach(m=>{const marker=L.circleMarker([m.lat,m.lng],{radius:m.selected?9:7,color:m.color,fillColor:m.color,fillOpacity:m.selected?1:.6,weight:2}).addTo(map);marker.on('click',()=>window.ReactNativeWebView.postMessage(JSON.stringify({type:'marker',id:m.id})));});}
      let pickedPin=null;
      window.setPickedLocation=(latitude,longitude)=>{if(!pickedPin){pickedPin=L.marker([latitude,longitude],{draggable:${pickable},icon:L.divIcon({className:'picked-pin',html:'<div></div>',iconSize:[24,24],iconAnchor:[12,24]})}).addTo(map);pickedPin.on('dragend',()=>{const p=pickedPin.getLatLng();window.ReactNativeWebView.postMessage(JSON.stringify({type:'select',lat:p.lat,lng:p.lng}));});}else{pickedPin.setLatLng([latitude,longitude]);}};
      window.clearPickedLocation=()=>{if(pickedPin){map.removeLayer(pickedPin);pickedPin=null;}};
      ${pickable ? "map.on('click',e=>{window.setPickedLocation(e.latlng.lat,e.latlng.lng);window.ReactNativeWebView.postMessage(JSON.stringify({type:'select',lat:e.latlng.lat,lng:e.latlng.lng}));});" : ""}
      window.setCenter=(latitude,longitude)=>map.setView([latitude,longitude],map.getZoom(),{animate:true,duration:.25});
    </script></body></html>`;
  }, [lat, lng, markers, selectedId, pickable, pannable, colors]);

  useEffect(() => {
    if (!mapReady || !followCenter) return;
    mapRef.current?.injectJavaScript(`window.setCenter(${lat},${lng}); true;`);
  }, [followCenter, lat, lng, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    const point = markerVisible ? selectedPoint ?? { lat, lng } : null;
    const script = point
      ? `window.setPickedLocation(${point.lat},${point.lng});`
      : "window.clearPickedLocation();";
    mapRef.current?.injectJavaScript(`${script} true;`);
  }, [lat, lng, mapReady, markerVisible, selectedPoint]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type: string; lat?: number; lng?: number; id?: string };
      if (message.type === "select" && typeof message.lat === "number" && typeof message.lng === "number") onSelect?.(message.lat, message.lng);
      if (message.type === "marker" && message.id) onMarkerPress?.(message.id);
    } catch {
      // Ignore malformed messages from the embedded map.
    }
  };

  return (
    <WebView<object>
      ref={mapRef}
      testID={testID}
      source={{ html }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      onLoadStart={() => setMapReady(false)}
      onLoadEnd={() => setMapReady(true)}
      onMessage={handleMessage}
      style={[{ height, backgroundColor: colors.surfaceTertiary }, style]}
    />
  );
}
