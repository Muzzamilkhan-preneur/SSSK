import { uploadForm, type LocalFile } from "@/src/utils/upload";
import type { AiAnalysis, Contractor, Report, SelfieResult, Stats } from "@/src/types";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BASE_URL) {
  throw new Error("EXPO_PUBLIC_BACKEND_URL is not set");
}

export const fileUrl = (path: string) => `${BASE_URL}/api/files/${path}`;

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body);
    } catch {
      // plain-text error body
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  return handle<T>(await fetch(`${BASE_URL}${path}`));
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle<T>(res);
}

export const api = {
  register: (name: string, file: LocalFile) =>
    uploadForm(`${BASE_URL}/api/citizens/register`, { files: { image: file }, fields: { name } }).then((r) => handle<SelfieResult>(r)),

  analyzePothole: (file: LocalFile) =>
    uploadForm(`${BASE_URL}/api/ai/analyze-pothole`, { files: { image: file } }).then((r) => handle<AiAnalysis>(r)),

  geocode: (lat: number, lng: number) => get<{ address: string }>(`/api/geocode?lat=${lat}&lng=${lng}`),

  createReport: (input: { file: LocalFile; lat: number; lng: number; citizenId: string; citizenName: string; description: string }) =>
    uploadForm(`${BASE_URL}/api/reports`, {
      files: { image: input.file },
      fields: {
        lat: String(input.lat),
        lng: String(input.lng),
        citizen_id: input.citizenId,
        citizen_name: input.citizenName,
        description: input.description,
      },
    }).then((r) => handle<{ merged: boolean; report: Report }>(r)),

  reports: (filters: { citizenId?: string; contractorId?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.citizenId) params.set("citizen_id", filters.citizenId);
    if (filters.contractorId) params.set("contractor_id", filters.contractorId);
    if (filters.status) params.set("status", filters.status);
    const qs = params.toString();
    return get<Report[]>(`/api/reports${qs ? `?${qs}` : ""}`);
  },

  report: (id: string) => get<Report>(`/api/reports/${id}`),

  review: (id: string, verdict: "genuine" | "fake", contractorId?: string, note?: string) =>
    post<Report>(`/api/reports/${id}/review`, { verdict, contractor_id: contractorId, note }),

  startRepair: (id: string) => post<Report>(`/api/reports/${id}/start`),

  completeRepair: (id: string, file: LocalFile) =>
    uploadForm(`${BASE_URL}/api/reports/${id}/complete`, { files: { image: file } }).then((r) => handle<Report>(r)),

  contractors: () => get<Contractor[]>("/api/contractors"),

  stats: () => get<Stats>("/api/stats"),
};

export const qk = {
  reports: (scope: string) => ["reports", scope] as const,
  report: (id: string) => ["report", id] as const,
  contractors: ["contractors"] as const,
  stats: ["stats"] as const,
};
