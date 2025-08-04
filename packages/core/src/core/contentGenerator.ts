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
  GoogleGenAI,
} from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_GEMINI_MODEL } from '../config/models.js';
import { Config } from '../config/config.js';
import { getEffectiveModel } from './modelCheck.js';
import { UserTierId } from '../code_assist/types.js';
import { 
  UniversalContentRequest, 
  UniversalResponse, 
  UniversalEmbeddingRequest, 
  UniversalEmbeddingResponse 
} from './universalTypes.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  // Existing Gemini-compatible methods (for backward compatibility)
  generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  // New provider-agnostic methods
  generateUniversalContent?(request: UniversalContentRequest): Promise<UniversalResponse>;
  generateUniversalEmbedding?(request: UniversalEmbeddingRequest): Promise<UniversalEmbeddingResponse>;

  userTier?: UserTierId;
  providerType?: ProviderType;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  OPENAI_API_KEY = 'openai-api-key',
  OPENAI_COMPATIBLE = 'openai-compatible',
}

export enum ProviderType {
  GEMINI = 'gemini',
  OPENAI = 'openai',
  OPENAI_COMPATIBLE = 'openai-compatible',
}

export type ContentGeneratorConfig = {
  provider?: ProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  proxy?: string | undefined;
  openaiConfig?: {
    organization?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  };
};

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): ContentGeneratorConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY || undefined;
  const googleApiKey = process.env.GOOGLE_API_KEY || undefined;
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT || undefined;
  const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION || undefined;
  const openaiApiKey = process.env.OPENAI_API_KEY || undefined;
  const openaiBaseUrl = process.env.OPENAI_BASE_URL || undefined;

  // Use runtime model from config if available; otherwise, fall back to parameter or default
  const effectiveModel = config.getModel() || DEFAULT_GEMINI_MODEL;

  const contentGeneratorConfig: ContentGeneratorConfig = {
    provider: ProviderType.GEMINI, // Default to Gemini for backward compatibility
    model: effectiveModel,
    authType,
    proxy: config?.getProxy(),
  };

  // If we are using Google auth or we are in Cloud Shell, there is nothing else to validate for now
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.CLOUD_SHELL
  ) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.vertexai = false;
    getEffectiveModel(
      contentGeneratorConfig.apiKey,
      contentGeneratorConfig.model,
      contentGeneratorConfig.proxy,
    );

    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;

    return contentGeneratorConfig;
  }

  // Handle OpenAI API key authentication
  if (authType === AuthType.OPENAI_API_KEY && openaiApiKey) {
    contentGeneratorConfig.provider = ProviderType.OPENAI;
    contentGeneratorConfig.apiKey = openaiApiKey;
    contentGeneratorConfig.baseUrl = openaiBaseUrl || 'https://api.openai.com/v1';
    return contentGeneratorConfig;
  }

  // Handle OpenAI-compatible endpoints
  if (authType === AuthType.OPENAI_COMPATIBLE && openaiApiKey && openaiBaseUrl) {
    contentGeneratorConfig.provider = ProviderType.OPENAI_COMPATIBLE;
    contentGeneratorConfig.apiKey = openaiApiKey;
    contentGeneratorConfig.baseUrl = openaiBaseUrl;
    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const version = process.env.CLI_VERSION || process.version;
  const httpOptions = {
    headers: {
      'User-Agent': `GeminiCLI/${version} (${process.platform}; ${process.arch})`,
    },
  };

  // Handle OpenAI and OpenAI-compatible providers
  if (
    config.provider === ProviderType.OPENAI ||
    config.provider === ProviderType.OPENAI_COMPATIBLE ||
    config.authType === AuthType.OPENAI_API_KEY ||
    config.authType === AuthType.OPENAI_COMPATIBLE
  ) {
    const { OpenAIContentGenerator } = await import('./openaiClient.js');
    return new OpenAIContentGenerator(config, httpOptions);
  }

  // Handle Google OAuth and Cloud Shell
  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL
  ) {
    return createCodeAssistContentGenerator(
      httpOptions,
      config.authType,
      gcConfig,
      sessionId,
    );
  }

  // Handle Gemini API key and Vertex AI
  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });

    return googleGenAI.models;
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported authType/provider: ${config.authType}/${config.provider}`,
  );
}
