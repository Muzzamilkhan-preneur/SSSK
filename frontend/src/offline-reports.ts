import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import { api } from "@/src/api";
import type { LocalFile } from "@/src/utils/upload";

const QUEUE_KEY = "ss_pending_reports_v1";
const PHOTO_DIR = "pending-reports/";

export type QueuedReport = {
  id: string;
  photo: LocalFile;
  lat: number;
  lng: number;
  citizenId: string;
  citizenName: string;
  description: string;
  createdAt: string;
};

async function readQueue(): Promise<QueuedReport[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedReport[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function extensionFor(file: LocalFile): string {
  const candidate = (file.name ?? "").split(".").pop()?.toLowerCase();
  return candidate && /^[a-z0-9]{1,5}$/.test(candidate) ? candidate : "jpg";
}

export async function getQueuedReports(): Promise<QueuedReport[]> {
  return readQueue();
}

export async function queueReport(input: Omit<QueuedReport, "id" | "photo" | "createdAt"> & { photo: LocalFile }): Promise<QueuedReport> {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) throw new Error("Offline storage is unavailable on this device.");

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const destination = `${documentDirectory}${PHOTO_DIR}${id}.${extensionFor(input.photo)}`;
  await FileSystem.makeDirectoryAsync(`${documentDirectory}${PHOTO_DIR}`, { intermediates: true });
  await FileSystem.copyAsync({ from: input.photo.uri, to: destination });

  const report: QueuedReport = {
    ...input,
    id,
    photo: { ...input.photo, uri: destination },
    createdAt: new Date().toISOString(),
  };
  await writeQueue([...(await readQueue()), report]);
  return report;
}

export function isRecoverableSyncError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /network|could not be reached|failed to fetch|load failed|AI verification is temporarily unavailable|AI check unavailable|Request failed \(503\)/i.test(message);
}

export async function syncQueuedReports(): Promise<{ synced: number; remaining: number }> {
  const queue = await readQueue();
  const remaining: QueuedReport[] = [];
  let synced = 0;

  for (const report of queue) {
    try {
      // The server runs the AI inspection after the photo reaches it, so queued
      // reports cannot reuse an analysis that may be stale or unavailable offline.
      await api.createReport({
        file: report.photo,
        lat: report.lat,
        lng: report.lng,
        citizenId: report.citizenId,
        citizenName: report.citizenName,
        description: report.description,
      });
      await FileSystem.deleteAsync(report.photo.uri, { idempotent: true });
      synced += 1;
    } catch {
      remaining.push(report);
    }
  }

  await writeQueue(remaining);
  return { synced, remaining: remaining.length };
}
