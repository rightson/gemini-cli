/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Universal types for provider-agnostic AI interactions
 */

export interface UniversalMessage {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  name?: string; // For function calls
  functionCall?: UniversalFunctionCall;
}

export interface UniversalFunctionCall {
  name: string;
  arguments: string; // JSON string
}

export interface UniversalResponse {
  content: string;
  finishReason?: string;
  usage?: UniversalTokenUsage;
  functionCalls?: UniversalFunctionCall[];
}

export interface UniversalTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface UniversalContentRequest {
  model: string;
  messages: UniversalMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  functions?: UniversalFunction[];
}

export interface UniversalFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
}

export interface UniversalEmbeddingRequest {
  model: string;
  input: string | string[];
}

export interface UniversalEmbeddingResponse {
  embeddings: number[][];
  usage?: UniversalTokenUsage;
}
