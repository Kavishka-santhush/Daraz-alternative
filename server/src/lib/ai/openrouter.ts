import OpenAI from 'openai';
import { env } from '../../config/env';
import logger from '../../config/logger';

/**
 * OpenRouter exposes an OpenAI-compatible chat completions API. We reuse the
 * official `openai` SDK pointed at the OpenRouter base URL.
 */
let client: OpenAI | undefined;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: env.openrouter.apiKey || 'sk-or-placeholder',
      baseURL: env.openrouter.baseUrl,
      defaultHeaders: {
        'HTTP-Referer': env.apiUrl,
        'X-Title': 'Marketplace AI',
      },
    });
  }
  return client;
}

export interface ChatOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}

export async function chat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[], opts: ChatOptions = {}): Promise<string> {
  if (!env.openrouter.apiKey) {
    logger.warn('OpenRouter API key not configured — returning empty AI result');
    return '';
  }
  try {
    const completion = await getClient().chat.completions.create({
      model: env.openrouter.model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1024,
      ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
    });
    return completion.choices[0]?.message?.content ?? '';
  } catch (err) {
    logger.error('OpenRouter chat failed', (err as Error).message);
    return '';
  }
}

export async function chatJson<T>(prompt: string, system: string): Promise<T | null> {
  const raw = await chat(
    [
      { role: 'system', content: `${system}\nRespond ONLY with valid JSON.` },
      { role: 'user', content: prompt },
    ],
    { json: true }
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.error('OpenRouter returned non-JSON', raw.slice(0, 200));
    return null;
  }
}
