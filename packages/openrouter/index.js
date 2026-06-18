// @lab/openrouter — OpenRouter as an eve model provider.
//
// eve's `defineAgent({ model })` accepts a provider-authored AI-SDK LanguageModel.
// eve pins ai@7.0.0-beta.178 (AI SDK v7 beta, provider spec v4). The OpenRouter-branded
// provider (@openrouter/ai-sdk-provider) targets older provider specs, so we use the
// version-matched @ai-sdk/openai-compatible pointed at OpenRouter's OpenAI-compatible API.
//
// See RESEARCH.md ("OpenRouter integration") for the compatibility analysis.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Cheap, reliable defaults. OpenRouter ":free" models are heavily rate-limited
 * upstream (observed HTTP 429), so we default to ultra-cheap *paid* models and
 * escalate only when a task demonstrably needs more.
 */
export const MODELS = {
  // ~ $0.02 / 1M input tokens — default workhorse
  cheap: "meta-llama/llama-3.1-8b-instruct",
  // small + cheap, good tool-calling
  small: "qwen/qwen-2.5-7b-instruct",
  // stronger reasoning / coding when cheap fails
  strong: "qwen/qwen3-next-80b-a3b-instruct",
  coder: "openai/gpt-oss-120b",
  // vision-capable
  vision: "qwen/qwen-2.5-vl-7b-instruct",
};

export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || MODELS.cheap;

/**
 * Build a configured OpenRouter provider instance.
 * Reads OPENROUTER_API_KEY (falls back to OPEN_ROUTER_KEY) from the environment.
 */
export function createLabOpenRouter(opts = {}) {
  const apiKey =
    opts.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY (or OPEN_ROUTER_KEY) is not set. Add it to .env.local.",
    );
  }
  return createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    headers: {
      "HTTP-Referer": "https://github.com/ravidsrk/eve-exploration",
      "X-Title": "eve-lab",
      ...(opts.headers || {}),
    },
  });
}

/**
 * Convenience: return a ready-to-use LanguageModel for `defineAgent({ model })`.
 * @param {string} [modelId] OpenRouter model id (defaults to DEFAULT_MODEL).
 */
export function orModel(modelId = DEFAULT_MODEL, opts = {}) {
  return createLabOpenRouter(opts)(modelId);
}

export default orModel;
