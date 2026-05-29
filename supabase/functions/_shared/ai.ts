// Shared AI client for the edge functions.
//
// Targets any OpenAI-compatible /chat/completions endpoint. By default it talks
// to the OpenAI API; point it elsewhere (Azure OpenAI, a proxy, a local model,
// another provider's compatible gateway) by setting OPENAI_BASE_URL.
//
// Required secret:  OPENAI_API_KEY
// Optional secrets: OPENAI_BASE_URL, OPENAI_MODEL_FAST, OPENAI_MODEL_SMART

const BASE_URL = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const CHAT_URL = `${BASE_URL}/chat/completions`;

// FAST: cheap/quick model for text and structured tool calls.
// SMART: stronger model for vision and harder reasoning.
export const AI_MODEL_FAST = Deno.env.get("OPENAI_MODEL_FAST") ?? "gpt-4o-mini";
export const AI_MODEL_SMART = Deno.env.get("OPENAI_MODEL_SMART") ?? "gpt-4o";

export class AIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AIError";
    this.status = status;
  }
}

export type AIMessage = { role: string; content: unknown };

function apiKey(): string {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new AIError("OPENAI_API_KEY is not configured", 500);
  return key;
}

async function chat(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`AI error (${res.status}):`, txt);
    if (res.status === 429) throw new AIError("Rate limit exceeded. Please try again shortly.", 429);
    if (res.status === 402) throw new AIError("AI credits exhausted. Please check your provider account.", 402);
    throw new AIError(`AI provider returned ${res.status}`, 502);
  }

  return res.json();
}

// Force a specific tool/function call and return its parsed arguments object.
export async function callAITool(
  model: string,
  messages: AIMessage[],
  tools: unknown[],
  toolName: string,
): Promise<any> {
  const data = await chat({
    model,
    messages,
    tools,
    tool_choice: { type: "function", function: { name: toolName } },
  });

  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new AIError("AI did not return a tool call", 502);
  return JSON.parse(args);
}

// Plain text completion. Returns the assistant message content, trimmed.
export async function callAIText(
  model: string,
  messages: AIMessage[],
  options: { maxTokens?: number } = {},
): Promise<string> {
  const data = await chat({
    model,
    messages,
    ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
  });

  return (data.choices?.[0]?.message?.content ?? "").trim();
}
