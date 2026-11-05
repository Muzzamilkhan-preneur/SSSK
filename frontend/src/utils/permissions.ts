import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

export type PermResult = "granted" | "denied" | "blocked";

// Returns "blocked" when the user can no longer be asked (deny-again / don't-ask-again).
// The screen should then show an "Open Settings" button.
export async function ensureMediaPermission(kind: "camera" | "gallery"): Promise<PermResult> {
  const check = kind === "camera" ? ImagePicker.getCameraPermissionsAsync : ImagePicker.getMediaLibraryPermissionsAsync;
  const current = await check();
  if (current.granted) return "granted";
  if (!current.canAskAgain) return "blocked";
  const asked = kind === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  return asked.granted ? "granted" : "denied";
}

export async function ensureLocationPermission(): Promise<PermResult> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return "granted";
  if (!current.canAskAgain) return "blocked";
  const asked = await Location.requestForegroundPermissionsAsync();
  return asked.granted ? "granted" : "denied";
}
