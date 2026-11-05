import type { ThemeColors } from "@/src/theme";
import type { ReportStatus, Severity } from "@/src/types";

export function statusMeta(status: ReportStatus, c: ThemeColors): { label: string; color: string } {
  switch (status) {
    case "pending_review":
      return { label: "In Review", color: c.info };
    case "assigned":
      return { label: "Assigned", color: c.warning };
    case "in_progress":
      return { label: "In Progress", color: c.brand };
    case "rework":
      return { label: "Rework Needed", color: c.onBrandTertiary };
    case "verified":
      return { label: "Fixed & Verified", color: c.success };
    case "rejected":
      return { label: "Marked Fake", color: c.muted };
  }
}

export const SEVERITY_RANK: Record<Severity, number> = { minor: 0, moderate: 1, severe: 2, dangerous: 3 };

export function severityMeta(severity: Severity, c: ThemeColors): { label: string; color: string } {
  switch (severity) {
    case "minor":
      return { label: "Minor", color: c.success };
    case "moderate":
      return { label: "Moderate", color: c.warning };
    case "severe":
      return { label: "Severe", color: c.error };
    case "dangerous":
      return { label: "Dangerous", color: c.onBrandTertiary };
  }
}

// Map/list filter groups shared by the City Map and queues.
export const STATUS_FILTERS: { key: string; label: string; statuses: ReportStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "review", label: "In Review", statuses: ["pending_review"] },
  { key: "assigned", label: "Assigned", statuses: ["assigned"] },
  { key: "progress", label: "In Progress", statuses: ["in_progress", "rework"] },
  { key: "fixed", label: "Fixed", statuses: ["verified"] },
];

export const KARACHI_CENTER = { lat: 24.8607, lng: 67.0011 };
