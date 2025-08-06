/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  Content,
  Part,
  FinishReason,
  ContentListUnion,
} from '@google/genai';
import {
  ContentGenerator,
  ProviderType,
  ContentGeneratorConfig,
} from './contentGenerator.js';
import {
  UniversalContentRequest,
  UniversalResponse,
  UniversalMessage,
  UniversalEmbeddingRequest,
  UniversalEmbeddingResponse,
} from './universalTypes.js';
import { UserTierId } from '../code_assist/types.js';

/**
 * OpenAI API response types
 */
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  functions?: OpenAIFunction[];
  function_call?: 'auto' | 'none' | { name: string };
}

interface OpenAIFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<OpenAIMessage>;
    finish_reason?: string;
  }>;
}

/**
 * Format mapper for converting between Gemini and OpenAI formats
 */
export class FormatMapper {
  /**
   * Convert Gemini Content[] to OpenAI messages
   */
  static geminiToOpenAI(contents: Content[]): OpenAIMessage[] {
    return contents.map(content => {
      const role = content.role === 'model' ? 'assistant' : content.role as 'user' | 'system';
      const textParts = content.parts?.filter(part => part.text) || [];
      const content_text = textParts.map(part => part.text).join('') || '';
      
      return {
        role,
        content: content_text,
      };
    });
  }

  /**
   * Convert OpenAI messages to Gemini Content[]
   */
  static openAIToGemini(messages: OpenAIMessage[]): Content[] {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }] as Part[],
    }));
  }

  /**
   * Convert Universal messages to OpenAI format
   */
  static universalToOpenAI(messages: UniversalMessage[]): OpenAIMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
      function_call: msg.functionCall ? {
        name: msg.functionCall.name,
        arguments: msg.functionCall.arguments,
      } : undefined,
    }));
  }

  /**
   * Convert OpenAI response to Universal format
   */
  static openAIToUniversal(response: OpenAIResponse): UniversalResponse {
    const choice = response.choices[0];
    return {
      content: choice?.message?.content || '',
      finishReason: choice?.finish_reason,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
      functionCalls: choice?.message?.function_call ? [{
        name: choice.message.function_call.name,
        arguments: choice.message.function_call.arguments,
      }] : undefined,
    };
  }

  /**
   * Convert OpenAI response to Gemini format
   */
  static openAIResponseToGemini(response: OpenAIResponse | any): GenerateContentResponse {
    let choice: any;
    let content = '';

    // Handle standard OpenAI format: response.choices[0].message.content
    if (response.choices && response.choices[0]) {
      choice = response.choices[0];
      content = choice?.message?.content || '';
    }
    // Handle custom format: response.message[0].content (array of messages)
    else if (response.message && Array.isArray(response.message) && response.message[0]) {
      const message = response.message[0];
      content = message.content || '';
      choice = {
        message: message,
        finish_reason: 'stop',
        index: 0
      };
    }
    // Handle other possible formats: response.message.content (single message object)
    else if (response.message && !Array.isArray(response.message)) {
      content = response.message.content || '';
      choice = {
        message: response.message,
        finish_reason: 'stop', 
        index: 0
      };
    }
    
    // Create a proper GenerateContentResponse class instance
    const result = new (GenerateContentResponse as any)();
    result.candidates = [{
      content: {
        role: 'model',
        parts: [{ text: content }] as Part[],
      },
      finishReason: choice?.finish_reason as FinishReason || 'STOP',
      index: choice?.index || 0,
    }];
    
    if (response.usage) {
      result.usageMetadata = {
        promptTokenCount: response.usage.prompt_tokens,
        candidatesTokenCount: response.usage.completion_tokens,
        totalTokenCount: response.usage.total_tokens,
      };
    }
    
    return result;
  }
}

/**
 * OpenAI-compatible content generator implementation
 */
export class OpenAIContentGenerator implements ContentGenerator {
  public providerType = ProviderType.OPENAI;
  public userTier?: UserTierId;

  constructor(
    private config: ContentGeneratorConfig,
    private httpOptions: { headers: Record<string, string> } = { headers: {} },
  ) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    // Set default base URL if not provided
    if (!config.baseUrl) {
      config.baseUrl = 'https://api.openai.com/v1';
    }
  }

  /**
   * Convert ContentListUnion to Content[]
   */
  private convertToContentArray(input: ContentListUnion): Content[] {
    if (Array.isArray(input)) {
      // It's already Content[]
      return input as Content[];
    }
    // It's a single Content object
    return [input as Content];
  }

  /**
   * Make HTTP request to OpenAI API
   */
  private async makeRequest(endpoint: string, body: any): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...this.httpOptions.headers,
    };

    if (this.config.openaiConfig?.organization) {
      headers['OpenAI-Organization'] = this.config.openaiConfig.organization;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
    }

    return response.json();
  }

  /**
   * Make streaming request to OpenAI API
   */
  private async *makeStreamRequest(endpoint: string, body: any): AsyncGenerator<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Accept': 'text/event-stream',
      ...this.httpOptions.headers,
    };

    if (this.config.openaiConfig?.organization) {
      headers['OpenAI-Organization'] = this.config.openaiConfig.organization;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get stream reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '' || !trimmed.startsWith('data: ')) continue;
          
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            yield parsed;
          } catch (e) {
            // Skip malformed JSON
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Generate content using Gemini-compatible interface
   */
  async generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse> {
    // Convert ContentListUnion to Content[]
    const contents = this.convertToContentArray(request.contents);
    const messages = FormatMapper.geminiToOpenAI(contents);
    
    const openAIRequest: OpenAIRequest = {
      model: request.model,
      messages,
      max_tokens: this.config.openaiConfig?.maxTokens,
      temperature: request.config?.temperature || this.config.openaiConfig?.temperature,
      top_p: request.config?.topP || this.config.openaiConfig?.topP,
    };

    const response = await this.makeRequest('/chat/completions', openAIRequest);
    return FormatMapper.openAIResponseToGemini(response);
  }

  /**
   * Generate streaming content using Gemini-compatible interface
   */
  async generateContentStream(request: GenerateContentParameters): Promise<AsyncGenerator<GenerateContentResponse>> {
    // Convert ContentListUnion to Content[]
    const contents = this.convertToContentArray(request.contents);
    const messages = FormatMapper.geminiToOpenAI(contents);
    
    const openAIRequest: OpenAIRequest = {
      model: request.model,
      messages,
      max_tokens: this.config.openaiConfig?.maxTokens,
      temperature: request.config?.temperature || this.config.openaiConfig?.temperature,
      top_p: request.config?.topP || this.config.openaiConfig?.topP,
    };

    const streamGenerator = this.makeStreamRequest('/chat/completions', openAIRequest);
    
    return this.convertStreamToGeminiFormat(streamGenerator);
  }

  /**
   * Convert OpenAI stream chunks to Gemini format
   */
  private async *convertStreamToGeminiFormat(stream: AsyncGenerator<OpenAIStreamChunk>): AsyncGenerator<GenerateContentResponse> {
    let accumulatedContent = '';
    
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const deltaContent = choice.delta?.content || '';
      accumulatedContent += deltaContent;

      // Create a proper GenerateContentResponse instance
      const result = new (GenerateContentResponse as any)();
      result.candidates = [{
        content: {
          role: 'model',
          parts: [{ text: deltaContent }] as Part[],
        },
        finishReason: choice.finish_reason as FinishReason,
        index: choice.index || 0,
      }];
      
      yield result;
    }
  }

  /**
   * Count tokens (approximation for OpenAI)
   */
  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // OpenAI doesn't have a direct token counting API
    // This is an approximation based on common tokenization rules
    const contents = this.convertToContentArray(request.contents);
    const text = contents.map((content: Content) => 
      content.parts?.map((part: Part) => part.text).join('') || ''
    ).join(' ');
    
    // Rough approximation: 1 token ≈ 4 characters for English text
    const approximateTokens = Math.ceil(text.length / 4);
    
    return {
      totalTokens: approximateTokens,
    };
  }

  /**
   * Generate embeddings
   */
  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    const embeddingRequest = {
      model: request.model,
      input: request.contents,
    };

    const response = await this.makeRequest('/embeddings', embeddingRequest);
    
    return {
      embeddings: response.data.map((item: any) => ({
        values: item.embedding,
      })),
    };
  }

  /**
   * Generate content using Universal format
   */
  async generateUniversalContent(request: UniversalContentRequest): Promise<UniversalResponse> {
    const messages = FormatMapper.universalToOpenAI(request.messages);
    
    const openAIRequest: OpenAIRequest = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      top_p: request.topP,
    };

    const response = await this.makeRequest('/chat/completions', openAIRequest);
    return FormatMapper.openAIToUniversal(response);
  }

  /**
   * Generate embeddings using Universal format
   */
  async generateUniversalEmbedding(request: UniversalEmbeddingRequest): Promise<UniversalEmbeddingResponse> {
    const embeddingRequest = {
      model: request.model,
      input: request.input,
    };

    const response = await this.makeRequest('/embeddings', embeddingRequest);
    
    return {
      embeddings: response.data.map((item: any) => item.embedding),
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: 0, // Embeddings don't have completion tokens
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }
}