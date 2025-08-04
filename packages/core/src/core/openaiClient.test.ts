/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIContentGenerator, FormatMapper } from './openaiClient.js';
import { ProviderType, ContentGeneratorConfig } from './contentGenerator.js';
import { Content, Part } from '@google/genai';

// Mock fetch globally
global.fetch = vi.fn();

describe('FormatMapper', () => {
  describe('geminiToOpenAI', () => {
    it('should convert Gemini Content[] to OpenAI messages', () => {
      const geminiContents: Content[] = [
        {
          role: 'user',
          parts: [{ text: 'Hello, how are you?' }] as Part[],
        },
        {
          role: 'model',
          parts: [{ text: 'I am doing well, thank you!' }] as Part[],
        },
      ];

      const result = FormatMapper.geminiToOpenAI(geminiContents);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Hello, how are you?',
        },
        {
          role: 'assistant',
          content: 'I am doing well, thank you!',
        },
      ]);
    });

    it('should handle empty parts array', () => {
      const geminiContents: Content[] = [
        {
          role: 'user',
          parts: [] as Part[],
        },
      ];

      const result = FormatMapper.geminiToOpenAI(geminiContents);

      expect(result).toEqual([
        {
          role: 'user',
          content: '',
        },
      ]);
    });

    it('should concatenate multiple text parts', () => {
      const geminiContents: Content[] = [
        {
          role: 'user',
          parts: [
            { text: 'Hello, ' },
            { text: 'how are you?' },
          ] as Part[],
        },
      ];

      const result = FormatMapper.geminiToOpenAI(geminiContents);

      expect(result).toEqual([
        {
          role: 'user',
          content: 'Hello, how are you?',
        },
      ]);
    });
  });

  describe('openAIToGemini', () => {
    it('should convert OpenAI messages to Gemini Content[]', () => {
      const openAIMessages = [
        {
          role: 'user' as const,
          content: 'Hello, how are you?',
        },
        {
          role: 'assistant' as const,
          content: 'I am doing well, thank you!',
        },
      ];

      const result = FormatMapper.openAIToGemini(openAIMessages);

      expect(result).toEqual([
        {
          role: 'user',
          parts: [{ text: 'Hello, how are you?' }],
        },
        {
          role: 'model',
          parts: [{ text: 'I am doing well, thank you!' }],
        },
      ]);
    });
  });

  describe('openAIToUniversal', () => {
    it('should convert OpenAI response to Universal format', () => {
      const openAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1686676106,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Hello! How can I help you?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
        },
      };

      const result = FormatMapper.openAIToUniversal(openAIResponse);

      expect(result).toEqual({
        content: 'Hello! How can I help you?',
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25,
        },
        functionCalls: undefined,
      });
    });

    it('should handle missing usage metadata', () => {
      const openAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1686676106,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant' as const,
              content: 'Hello!',
            },
            finish_reason: 'stop',
          },
        ],
        usage: undefined as any,
      };

      const result = FormatMapper.openAIToUniversal(openAIResponse);

      expect(result).toEqual({
        content: 'Hello!',
        finishReason: 'stop',
        usage: undefined,
        functionCalls: undefined,
      });
    });
  });
});

describe('OpenAIContentGenerator', () => {
  let config: ContentGeneratorConfig;
  let generator: OpenAIContentGenerator;

  beforeEach(() => {
    config = {
      provider: ProviderType.OPENAI,
      model: 'gpt-4',
      apiKey: 'test-api-key',
      baseUrl: 'https://api.openai.com/v1',
    };
    generator = new OpenAIContentGenerator(config);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if no API key provided', () => {
      const configNoKey = { ...config, apiKey: undefined };
      expect(() => new OpenAIContentGenerator(configNoKey)).toThrow(
        'OpenAI API key is required',
      );
    });

    it('should set default base URL if not provided', () => {
      const configNoUrl = { ...config, baseUrl: undefined };
      const gen = new OpenAIContentGenerator(configNoUrl);
      expect(gen['config'].baseUrl).toBe('https://api.openai.com/v1');
    });

    it('should set provider type to OPENAI', () => {
      expect(generator.providerType).toBe(ProviderType.OPENAI);
    });
  });

  describe('generateContent', () => {
    it('should make correct API call and return formatted response', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1686676106,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request = {
        model: 'gpt-4',
        contents: [
          {
            role: 'user' as const,
            parts: [{ text: 'Hello' }] as Part[],
          },
        ],
      };

      const result = await generator.generateContent(request);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key',
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              {
                role: 'user',
                content: 'Hello',
              },
            ],
            max_tokens: undefined,
            temperature: undefined,
            top_p: undefined,
          }),
        },
      );

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates?.[0]?.content?.parts?.[0]?.text).toBe(
        'Hello! How can I help you?',
      );
    });

    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: { message: 'Invalid request' },
        }),
      });

      const request = {
        model: 'gpt-4',
        contents: [
          {
            role: 'user' as const,
            parts: [{ text: 'Hello' }] as Part[],
          },
        ],
      };

      await expect(generator.generateContent(request)).rejects.toThrow(
        'OpenAI API error: 400 Bad Request. Invalid request',
      );
    });
  });

  describe('countTokens', () => {
    it('should approximate token count', async () => {
      const request = {
        model: 'gpt-4',
        contents: [
          {
            role: 'user' as const,
            parts: [{ text: 'This is a test message' }] as Part[],
          },
        ],
      };

      const result = await generator.countTokens(request);

      // "This is a test message" is 23 characters, so ~6 tokens
      expect(result.totalTokens).toBe(Math.ceil(23 / 4));
    });
  });

  describe('content conversion', () => {
    it('should handle array of Content objects in generateContent', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1686676106,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 5,
          total_tokens: 10,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const request = {
        model: 'gpt-4',
        contents: [
          {
            role: 'user' as const,
            parts: [{ text: 'Hello' }] as Part[],
          },
        ],
      };

      const result = await generator.generateContent(request);
      expect(result.candidates).toHaveLength(1);
    });
  });
});