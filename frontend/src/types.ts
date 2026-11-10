export type Role = "citizen" | "mayor" | "contractor";

export type Session = {
  role: Role;
  name: string;
  citizen_id?: string;
  selfie_path?: string | null;
  citizen_verified?: boolean;
  contractor_id?: string;
};

export type Severity = "minor" | "moderate" | "severe" | "dangerous";

export type ReportStatus = "pending_review" | "assigned" | "in_progress" | "rework" | "verified" | "rejected";

export type TimelineEvent = {
  status: ReportStatus;
  label: string;
  note?: string | null;
  actor?: string | null;
  at: string;
};

export type Finding = {
  key: string;
  label: string;
  probability: number;
  passed?: boolean;
};

export type Verification = {
  verified: boolean;
  confidence: number;
  reason: string;
  checks: Finding[];
};

export type Reporter = {
  citizen_id: string;
  name: string;
  at: string;
  image_path?: string | null;
  image_hash?: string | null;
};

export type Report = {
  id: string;
  citizen_id: string;
  citizen_name: string;
  reporters: Reporter[];
  reporter_count: number;
  image_path: string;
  extra_image_paths?: string[];
  after_image_path?: string | null;
  lat: number;
  lng: number;
  address?: string | null;
  description?: string | null;
  severity?: Severity | null;
  severity_score?: number | null;
  severity_confidence?: number | null;
  damage_type?: string | null;
  findings: Finding[];
  needs_review: boolean;
  status: ReportStatus;
  verdict?: "genuine" | "fake" | null;
  contractor_id?: string | null;
  contractor_name?: string | null;
  verification?: Verification | null;
  timeline: TimelineEvent[];
  created_at: string;
  updated_at: string;
};

export type Contractor = {
  id: string;
  name: string;
  company: string;
  phone: string;
  specialty: string;
  rating: number;
  completed_jobs: number;
  is_verified: boolean;
};

export type AiAnalysis = {
  is_road_damage: boolean;
  road_probability?: number;
  severity?: Severity;
  severity_score?: number;
  severity_confidence?: number;
  damage_type?: string;
  findings?: Finding[];
  needs_review?: boolean;
};

export type NearbyReportMatch = {
  id: string;
  address?: string | null;
  distance_m: number;
  reporter_count: number;
  already_reported: boolean;
};

export type CreateReportResult =
  | { match_required: true; candidate: NearbyReportMatch }
  | { merged: boolean; already_reported?: boolean; report: Report };

export type SelfieResult = {
  passed: boolean;
  reason: string | null;
  checks: Finding[];
  citizen: { id: string; name: string; selfie_path: string | null; selfie_verified: boolean } | null;
};

export type CitizenProfile = {
  id: string;
  name: string;
  selfie_path: string | null;
  selfie_verified: boolean;
};

export type Stats = {
  total: number;
  by_status: Record<ReportStatus, number>;
  by_severity: Record<Severity, number>;
  fixed: number;
  fixed_rate: number;
};

export type DispatchDemoReport = {
  id: string;
  lat: number;
  lng: number;
  address: string;
  description: string;
  damage_type: string;
  severity: Severity;
  severity_score: number;
  reporter_count: number;
  status: string;
  created_at: string;
};

export type DispatchDemoGroup = {
  id: string;
  report_ids: string[];
  category: "road_damage" | "garbage_dump" | "drainage" | "other";
  priority: "critical" | "high" | "medium" | "low";
  summary: string;
  recommended_action: string;
  demo_crew: { id: string; name: string; specialty: string } | null;
  assignment_status: "suggested" | "manual_review";
  reports: DispatchDemoReport[];
};

export type DispatchDemoResult = {
  mode: "synthetic_only";
  cached: boolean;
  model: string;
  report_count: number;
  inference_ms: number;
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  } | null;
  metrics: {
    expected_incidents: number;
    predicted_incidents: number;
    exact_incident_accuracy: number;
    pairwise_precision: number;
    pairwise_recall: number;
    pairwise_f1: number;
  };
  crew_workload: {
    id: string;
    name: string;
    specialty: string;
    assigned_groups: number;
    capacity: number;
  }[];
  groups: DispatchDemoGroup[];
};
