import { z } from "zod";

// What the gateway and model accept, probed once per provider:model (architecture §4.3, amended 2026-10-21).

export const ResponseMode = z.enum(["strict", "json_object", "prompt"]);
export type ResponseMode = z.infer<typeof ResponseMode>;

export const Capabilities = z.object({
  provider: z.enum(["portkey", "openai", "mock"]),
  modelString: z.string(),
  headers: z.record(z.string(), z.string()),
  responseMode: ResponseMode,
  temperature: z.boolean(),
  reasoningEffort: z.union([z.array(z.string()), z.literal(false)]),
  promptCacheKey: z.boolean(),
  cachedTokensReported: z.boolean().nullable(),
  cachedOnRepeat: z.boolean().nullable(),
  reasoningTokensReported: z.boolean().nullable(),
  suggestedConcurrency: z.number().nullable(),
  medianLatencyMs: z.number().nullable(),
  probedAt: z.string(),
  source: z.enum(["smoke", "lazy", "static"]),
});
export type Capabilities = z.infer<typeof Capabilities>;

export const CapabilitiesFile = z.record(z.string(), Capabilities);
export type CapabilitiesFile = z.infer<typeof CapabilitiesFile>;

export function capabilitiesKey(provider: string, model: string): string {
  return `${provider}:${model}`;
}

export const MOCK_CAPABILITIES: Capabilities = {
  provider: "mock",
  modelString: "mock",
  headers: {},
  responseMode: "strict",
  temperature: true,
  reasoningEffort: ["low", "minimal"],
  promptCacheKey: false,
  cachedTokensReported: false,
  cachedOnRepeat: false,
  reasoningTokensReported: false,
  suggestedConcurrency: 8,
  medianLatencyMs: 0,
  probedAt: "1970-01-01T00:00:00.000Z",
  source: "static",
};
