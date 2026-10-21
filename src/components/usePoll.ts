"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Polls a JSON endpoint while `isActive(latest data)` holds; returns the latest data, the last error and a manual refresh. */
export function usePoll<T>(
  url: string,
  ms: number,
  isActive: boolean | ((data: T) => boolean),
  initial: T,
): { data: T; error: string | null; refresh: () => Promise<void> } {
  const [data, setData] = useState<T>(initial);
  const active = typeof isActive === "function" ? isActive(data) : isActive;
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      if (alive.current) {
        setData(body as T);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    }
  }, [url]);
  useEffect(() => {
    alive.current = true;
    if (!active) return;
    const timer = setInterval(refresh, ms);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [active, ms, refresh]);
  return { data, error, refresh };
}

/** POST/PATCH JSON and throw the API's error message on failure. */
export async function sendJson<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.error?.message ?? `HTTP ${res.status}`);
  return out as T;
}
