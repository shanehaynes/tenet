"use client";

import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  provider: string | null;
  model: string;
  envFile: string | null;
  keySpend: { usd: number; budgetUsd: number };
  problem: string | null;
};

/** Footer badge: which provider and model are live, the key's cumulative spend, or the no-key guidance. */
export function HealthBadge() {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then(setH)
      .catch(() => setH(null));
  }, []);
  if (!h) return <span className="text-zinc-400">Checking model access…</span>;
  if (!h.ok) {
    return (
      <span className="text-amber-700">
        No API key found. Put PORTKEY_API_KEY in a .env file in the repo folder or one folder above it, then restart; or start with TENET_PROVIDER=mock to explore with synthetic results.
      </span>
    );
  }
  return (
    <span>
      <span className="font-medium text-zinc-700">{h.provider === "mock" ? "Mock provider (synthetic results)" : `${h.model} via ${h.provider}`}</span>
      {h.provider !== "mock" && (
        <span className="ml-3">
          key spend ${h.keySpend.usd.toFixed(3)} of ${h.keySpend.budgetUsd}
        </span>
      )}
    </span>
  );
}
