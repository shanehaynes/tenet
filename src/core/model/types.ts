import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import type { Capabilities } from "../schemas/capabilities";
import type { Stage } from "../schemas/records";

export type ResponseFormat = NonNullable<ChatCompletionCreateParams["response_format"]>;

/** What callModel hands a provider: one system message, one user message, already gated on capabilities. */
export type ProviderRequest = {
  stage: Stage;
  model: string;
  system: string;
  user: string;
  maxCompletionTokens: number;
  temperature?: number;
  reasoningEffort?: string;
  responseFormat?: ResponseFormat;
  promptCacheKey?: string;
  headers?: Record<string, string>;
  timeoutMs: number;
  signal?: AbortSignal;
  schemaName?: string;
  /** Deterministic output for the mock provider; real providers ignore it. */
  mock?: () => unknown;
};

export type ProviderUsage = {
  input: number;
  cached: number | null;
  reasoning: number | null;
  output: number;
  estimated: boolean;
};

export type ProviderResponse = {
  text: string;
  refusal: string | null;
  finishReason: string | null;
  model: string;
  usage: ProviderUsage | null;
  /** The gateway's response-cache status (Portkey's x-portkey-cache-status: hit, miss, refresh), when reported. */
  gatewayCache?: string | null;
};

export interface Provider {
  readonly name: string;
  /** True when calls are billed to a real key (counts toward the key budget). */
  readonly billed: boolean;
  /** Fixed capabilities for providers that are never probed (mock, test fakes). */
  readonly staticCapabilities?: Capabilities;
  complete(req: ProviderRequest): Promise<ProviderResponse>;
}

export type ProviderErrorKind = "rate_limit" | "transient" | "fatal" | "aborted";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class NoMockHandler extends Error {
  constructor(stage: Stage, schemaName?: string) {
    super(`The mock provider has no handler for stage "${stage}"${schemaName ? ` (${schemaName})` : ""}; pass args.mock.`);
    this.name = "NoMockHandler";
  }
}

export class SchemaInvalid extends Error {
  constructor(
    readonly stage: Stage,
    message: string,
    readonly lastText: string,
  ) {
    super(message);
    this.name = "SchemaInvalid";
  }
}

export class ModelCallFailed extends Error {
  constructor(
    readonly stage: Stage,
    readonly providerError: ProviderError,
  ) {
    super(`${stage} call failed: ${providerError.message}`);
    this.name = "ModelCallFailed";
  }
}
