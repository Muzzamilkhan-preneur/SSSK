import { uploadForm, type LocalFile } from "@/src/utils/upload";
import type { AiAnalysis, Contractor, CreateReportResult, Report, SelfieResult, Stats } from "@/src/types";

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

async function upload<T>(path: string, options: Parameters<typeof uploadForm>[1]): Promise<T> {
  const request = () => uploadForm(`${BASE_URL}${path}`, options).then(handle<T>);
  try {
    return await request();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api upload]", { path, message, baseUrl: BASE_URL });
    const transient = /failed to fetch|network request failed|network error|load failed|Request failed \(503\)|AI check unavailable/i.test(message);
    if (!transient) throw error;
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      return await request();
    } catch {
      if (/Request failed \(503\)|AI check unavailable/i.test(message)) {
        throw new Error("AI verification is temporarily unavailable. Please try again in a moment.");
      }
      throw new Error("The service could not be reached from this phone. Check Wi-Fi/mobile data and try again.");
    }
  }
}

export const api = {
  register: (name: string, file: LocalFile) =>
    upload<SelfieResult>("/api/citizens/register", { files: { image: file }, fields: { name } }),

  analyzePothole: (file: LocalFile) =>
    upload<AiAnalysis>("/api/ai/analyze-pothole", {
      files: { image: file },
    }),

  geocode: (lat: number, lng: number) => get<{ address: string }>(`/api/geocode?lat=${lat}&lng=${lng}`),

  createReport: (input: {
    file: LocalFile;
    lat: number;
    lng: number;
    citizenId: string;
    citizenName: string;
    description: string;
    analysis?: AiAnalysis | null;
    confirmedMatchId?: string;
    separateMatchId?: string;
  }) =>
    upload<CreateReportResult>("/api/reports", {
      files: { image: input.file },
      fields: {
        lat: String(input.lat),
        lng: String(input.lng),
        citizen_id: input.citizenId,
        citizen_name: input.citizenName,
        description: input.description,
        analysis: input.analysis ? JSON.stringify(input.analysis) : "",
        confirmed_match_id: input.confirmedMatchId ?? "",
        separate_match_id: input.separateMatchId ?? "",
      },
    }),

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
    upload<Report>(`/api/reports/${id}/complete`, { files: { image: file } }),

  contractors: () => get<Contractor[]>("/api/contractors"),

  stats: () => get<Stats>("/api/stats"),

};

export const qk = {
  reports: (scope: string) => ["reports", scope] as const,
  report: (id: string) => ["report", id] as const,
  contractors: ["contractors"] as const,
  stats: ["stats"] as const,
};
