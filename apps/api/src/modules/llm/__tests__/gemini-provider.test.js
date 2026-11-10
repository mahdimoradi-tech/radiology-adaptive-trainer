import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { GeminiProvider } from '../gemini.provider.js';
import { LlmError } from '../provider.js';

describe('GeminiProvider', () => {
  const dummySchema = z.object({
    status: z.string(),
    count: z.number(),
  });

  it('successfully generates and parses structured JSON', async () => {
    const mockClient = {
      interactions: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({ status: 'ok', count: 42 }),
          usage: {
            total_input_tokens: 120,
            total_output_tokens: 45,
            total_tokens: 165,
          },
        }),
      },
    };

    const provider = new GeminiProvider({
      apiKey: 'test-key',
      client: mockClient,
    });

    const res = await provider.generateJson({
      promptId: 'test',
      version: 'v1',
      system: 'system instruction',
      input: { query: 'test' },
      schema: dummySchema,
    });

    expect(res.data).toEqual({ status: 'ok', count: 42 });
    expect(res.usage.totalTokens).toBe(165);
    expect(mockClient.interactions.create).toHaveBeenCalledOnce();

    const callArgs = mockClient.interactions.create.mock.calls[0][0];
    expect(callArgs.model).toBe('gemini-3.8-flash');
    expect(callArgs.system_instruction).toBe('system instruction');
    expect(callArgs.response_format.type).toBe('text');
    expect(callArgs.response_format.mime_type).toBe('application/json');
  });

  it('formats multimodal images into input array parts', async () => {
    const mockClient = {
      interactions: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({ status: 'multimodal', count: 1 }),
          usage: { total_input_tokens: 200, total_output_tokens: 10, total_tokens: 210 },
        }),
      },
    };

    const provider = new GeminiProvider({
      apiKey: 'test-key',
      client: mockClient,
    });

    await provider.generateJson({
      promptId: 'test',
      version: 'v1',
      system: 'system instruction',
      input: { prompt: 'analyze this image' },
      schema: dummySchema,
      images: [{ type: 'image', data: 'base64imagedata', mime_type: 'image/jpeg' }],
    });

    const callArgs = mockClient.interactions.create.mock.calls[0][0];
    expect(Array.isArray(callArgs.input)).toBe(true);
    expect(callArgs.input[0].type).toBe('text');
    expect(callArgs.input[1].type).toBe('image');
    expect(callArgs.input[1].data).toBe('base64imagedata');
  });

  it('translates 429 rate limit errors to retryable LlmError with status 429', async () => {
    const rateLimitError = new Error('Quota exceeded for metric Requests per day');
    rateLimitError.status = 429;
    rateLimitError.code = 'RESOURCE_EXHAUSTED';

    const mockClient = {
      interactions: {
        create: vi.fn().mockRejectedValue(rateLimitError),
      },
    };

    const provider = new GeminiProvider({
      apiKey: 'test-key',
      client: mockClient,
    });

    await expect(
      provider.generateJson({
        promptId: 'test',
        version: 'v1',
        system: 'sys',
        input: {},
        schema: dummySchema,
      }),
    ).rejects.toThrow(LlmError);

    try {
      await provider.generateJson({
        promptId: 'test',
        version: 'v1',
        system: 'sys',
        input: {},
        schema: dummySchema,
      });
    } catch (err) {
      expect(err.code).toBe('LLM_RATE_LIMIT');
      expect(err.status).toBe(429);
      expect(err.retryable).toBe(true);
    }
  });

  it('translates invalid JSON output to LLM_INVALID_RESPONSE', async () => {
    const mockClient = {
      interactions: {
        create: vi.fn().mockResolvedValue({
          output_text: 'malformed json text {',
        }),
      },
    };

    const provider = new GeminiProvider({
      apiKey: 'test-key',
      client: mockClient,
    });

    await expect(
      provider.generateJson({
        promptId: 'test',
        version: 'v1',
        system: 'sys',
        input: {},
        schema: dummySchema,
      }),
    ).rejects.toThrow(LlmError);
  });

  it('enforces timeout with Promise.race when request hangs', async () => {
    const mockClient = {
      interactions: {
        create: vi.fn().mockImplementation(() => new Promise(() => {})), // never resolves
      },
    };

    const provider = new GeminiProvider({
      apiKey: 'test-key',
      client: mockClient,
      timeoutMs: 50,
    });

    await expect(
      provider.generateJson({
        promptId: 'test',
        version: 'v1',
        system: 'sys',
        input: {},
        schema: dummySchema,
      }),
    ).rejects.toThrow('Gemini interaction timed out after 50ms');
  });
});
