import { useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";
import type { Session } from "@/src/types";

const KEY = "ss_session_v2";

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

export async function clearSession(): Promise<boolean> {
  return storage.removeItem(KEY);
}

export function homeFor(session: Session): "/citizen/reports" | "/mayor/queue" | "/contractor/active" {
  return session.role === "citizen" ? "/citizen/reports" : session.role === "mayor" ? "/mayor/queue" : "/contractor/active";
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
