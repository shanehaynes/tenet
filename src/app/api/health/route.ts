import "server-only";
import { settings } from "@/core/config";
import { loadEnv, NO_KEY_MESSAGE, resolveProvider } from "@/core/env";
import { readCapabilitiesFile } from "@/core/model/capabilities";
import { capabilitiesKey } from "@/core/schemas/capabilities";
import { keySpend } from "@/core/store/usage";
import { handleError, json } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const envFile = loadEnv();
    const s = settings();
    let provider: string | null = null;
    let problem: string | null = null;
    try {
      provider = resolveProvider();
    } catch {
      problem = NO_KEY_MESSAGE;
    }
    const caps = provider ? (await readCapabilitiesFile())[capabilitiesKey(provider, s.targetModel)] : undefined;
    const spend = await keySpend();
    return json({
      ok: provider !== null,
      provider,
      model: s.targetModel,
      envFile: envFile ? (envFile.includes(`${process.cwd()}`) ? ".env (repo folder)" : "../.env (one folder up)") : null,
      capabilitiesProbed: provider === "mock" ? true : Boolean(caps),
      keySpend: { usd: spend.usd, calls: spend.calls, budgetUsd: s.keyBudgetUsd },
      problem,
    });
  } catch (err) {
    return handleError(err);
  }
}
