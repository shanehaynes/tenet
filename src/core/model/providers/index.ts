import type { EnvTarget, ProviderName } from "../../env";
import { NoKeyError } from "../../env";
import type { Provider } from "../types";
import { mockProvider } from "./mock";
import { createOpenAICompatProvider, PORTKEY_BASE_URL } from "./openaiCompat";

const cache = new Map<string, Provider>();

/** Builds (once per key) the provider for a resolved name. */
export function providerByName(name: ProviderName, env: EnvTarget = process.env): Provider {
  if (name === "mock") return mockProvider;
  const key = name === "portkey" ? env.PORTKEY_API_KEY?.trim() : env.OPENAI_API_KEY?.trim();
  if (!key) throw new NoKeyError(`${name === "portkey" ? "PORTKEY_API_KEY" : "OPENAI_API_KEY"} is not set.`);
  const cacheKey = `${name}:${key}`;
  let provider = cache.get(cacheKey);
  if (!provider) {
    provider =
      name === "portkey"
        ? createOpenAICompatProvider("portkey", {
            apiKey: key,
            baseURL: PORTKEY_BASE_URL,
            defaultHeaders: { "x-portkey-api-key": key },
          })
        : createOpenAICompatProvider("openai", { apiKey: key });
    cache.set(cacheKey, provider);
  }
  return provider;
}
