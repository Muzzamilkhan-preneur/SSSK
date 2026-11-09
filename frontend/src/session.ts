import { useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";
import type { Session } from "@/src/types";

const KEY = "ss_session_v2";
const CITIZEN_PROFILE_KEY = "ss_citizen_profile_v1";

export async function getSession(): Promise<Session | null> {
  const raw = await storage.getItem<string | null>(KEY, null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<boolean> {
  // Storage accepts primitives only, so the session object is stored as one string.
  return storage.setItem(KEY, JSON.stringify(session));
}

export async function getSavedCitizenProfile(): Promise<Session | null> {
  const raw = await storage.getItem<string | null>(CITIZEN_PROFILE_KEY, null);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    return session.role === "citizen" && session.citizen_id ? session : null;
  } catch {
    return null;
  }
}

export async function saveCitizenProfile(session: Session): Promise<boolean> {
  if (session.role !== "citizen" || !session.citizen_id) return false;
  return storage.setItem(CITIZEN_PROFILE_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<boolean> {
  return storage.removeItem(KEY);
}

export function homeFor(session: Session): "/citizen/tabs/reports" | "/mayor/tabs/queue" | "/contractor/tabs/active" {
  return session.role === "citizen"
    ? "/citizen/tabs/reports"
    : session.role === "mayor"
      ? "/mayor/tabs/queue"
      : "/contractor/tabs/active";
}

export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let alive = true;
    getSession().then((s) => {
      if (alive) setSession(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return session;
}
