/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config as dotenvConfig } from 'dotenv';

interface ModelOverrides {
  DEFAULT_GEMINI_MODEL?: string;
  DEFAULT_GEMINI_FLASH_MODEL?: string;
  DEFAULT_GEMINI_FLASH_LITE_MODEL?: string;
  DEFAULT_GEMINI_EMBEDDING_MODEL?: string;
}

interface ModelTokenLimits {
  [modelName: string]: number;
}

interface ModelConfiguration {
  models: ModelOverrides;
  tokenLimits: ModelTokenLimits;
}

// Default values (fallback when no overrides are provided)
const DEFAULT_MODEL_VALUES: Required<ModelOverrides> = {
  DEFAULT_GEMINI_MODEL: 'gemini-2.5-pro',
  DEFAULT_GEMINI_FLASH_MODEL: 'gemini-2.5-flash',
  DEFAULT_GEMINI_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
  DEFAULT_GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
};

const DEFAULT_TOKEN_LIMITS: ModelTokenLimits = {
  // Gemini models
  'gemini-1.5-pro': 2_097_152,
  'gemini-1.5-flash': 1_048_576,
  'gemini-2.5-pro-preview-05-06': 1_048_576,
  'gemini-2.5-pro-preview-06-05': 1_048_576,
  'gemini-2.5-pro': 1_048_576,
  'gemini-2.5-flash-preview-05-20': 1_048_576,
  'gemini-2.5-flash': 1_048_576,
  'gemini-2.5-flash-lite': 1_048_576,
  'gemini-2.0-flash': 1_048_576,
  'gemini-2.0-flash-preview-image-generation': 32_000,

  // OpenAI models
  'gpt-4': 128_000,
  'gpt-4-turbo': 128_000,
  'gpt-4-turbo-preview': 128_000,
  'gpt-4.1': 128_000, // Custom model to replace gemini-2.5-pro
  'gpt-3.5-turbo': 16_384,
  'gpt-3.5-turbo-16k': 16_384,
  'gpt-4.1-mini': 16_384, // Custom model to replace gemini-2.5-flash-lite
  'gpt-4-32k': 32_768,
  'gpt-4o': 128_000, // Added GPT-4o, known for 128K context window

  // Claude models
  'claude-3-opus': 200_000,
  'claude-3-sonnet': 200_000,
  'claude-3-haiku': 200_000,
  'claude-3.5-sonnet': 200_000, // Added Claude 3.5 Sonnet, 200K context window
  'claude-4-sonnet': 200_000, // Added Claude Sonnet 4, assumes same 200K context window as Claude 3.5 Sonnet

  // Llama models
  'llama-3.1-8b': 128_000, // Added Llama 3.1 8B, 128K context window
  'llama-3.1-70b': 128_000, // Added Llama 3.1 70B, 128K context window
  'llama-3.1-405b': 128_000, // Added Llama 3.1 405B, 128K context window
  'llama-3.2-1b': 128_000, // Added Llama 3.2 1B, assumes 128K context window
  'llama-3.2-3b': 128_000, // Added Llama 3.2 3B, assumes 128K context window
  'llama-3.3-8b': 128_000, // Added Llama 3.3 8B, assumes 128K context window
  'llama-3.3-70b': 128_000, // Added Llama 3.3 70B, assumes 128K context window
};

class ModelConfigManager {
  private modelOverrides: Required<ModelOverrides>;
  private tokenLimits: ModelTokenLimits;
  private isInitialized = false;

  constructor() {
    this.modelOverrides = { ...DEFAULT_MODEL_VALUES };
    this.tokenLimits = { ...DEFAULT_TOKEN_LIMITS };
  }

  /**
   * Initialize the model configuration by loading from various sources
   */
  initialize(workingDirectory?: string): void {
    if (this.isInitialized) return;

    const cwd = workingDirectory || process.cwd();

    // Load from .env file
    this.loadFromEnv(cwd);

    // Load from models.json file
    this.loadFromJson(cwd);

    // Load from environment variables
    this.loadFromProcessEnv();

    this.isInitialized = true;
  }

  /**
   * Load configuration from .env file
   */
  private loadFromEnv(cwd: string): void {
    const envPath = join(cwd, '.env');
    if (existsSync(envPath)) {
      dotenvConfig({ path: envPath });
    }
  }

  /**
   * Load configuration from models.json file
   */
  private loadFromJson(cwd: string): void {
    const jsonPath = join(cwd, 'models.json');
    if (existsSync(jsonPath)) {
      try {
        const jsonContent = readFileSync(jsonPath, 'utf-8');
        const config: Partial<ModelConfiguration> = JSON.parse(jsonContent);

        if (config.models) {
          this.modelOverrides = { ...this.modelOverrides, ...config.models };
        }

        if (config.tokenLimits) {
          this.tokenLimits = { ...this.tokenLimits, ...config.tokenLimits };
        }
      } catch (error) {
        console.warn(`Warning: Failed to parse models.json: ${error}`);
      }
    }
  }

  /**
   * Load configuration from process environment variables
   */
  private loadFromProcessEnv(): void {
    const envKeys: (keyof ModelOverrides)[] = [
      'DEFAULT_GEMINI_MODEL',
      'DEFAULT_GEMINI_FLASH_MODEL',
      'DEFAULT_GEMINI_FLASH_LITE_MODEL',
      'DEFAULT_GEMINI_EMBEDDING_MODEL',
    ];

    for (const key of envKeys) {
      const envValue = process.env[key];
      if (envValue) {
        this.modelOverrides[key] = envValue;
      }
    }

    // Load custom token limits from environment
    // Format: MODEL_TOKEN_LIMIT_<model_name_uppercase>=<limit>
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('MODEL_TOKEN_LIMIT_') && value) {
        const modelName = key
          .replace('MODEL_TOKEN_LIMIT_', '')
          .toLowerCase()
          .replace(/_/g, '-');
        const tokenLimit = parseInt(value, 10);
        if (!isNaN(tokenLimit)) {
          this.tokenLimits[modelName] = tokenLimit;
        }
      }
    }
  }

  /**
   * Get a model name with potential override
   */
  getModel(modelKey: keyof ModelOverrides): string {
    if (!this.isInitialized) {
      this.initialize();
    }
    return this.modelOverrides[modelKey];
  }

  /**
   * Get token limit for a specific model
   */
  getTokenLimit(modelName: string): number {
    if (!this.isInitialized) {
      this.initialize();
    }

    // Check if we have a specific limit for this model
    if (this.tokenLimits[modelName]) {
      return this.tokenLimits[modelName];
    }

    // Fallback to pattern matching for unknown models
    if (modelName.includes('gpt-4') || modelName.includes('claude-3')) {
      return 128_000;
    }
    if (
      modelName.includes('gpt-3.5') ||
      modelName.includes('mini') ||
      modelName.includes('lite')
    ) {
      return 16_384;
    }

    // Default fallback
    return 1_048_576;
  }

  /**
   * Get all current model overrides
   */
  getAllModels(): Required<ModelOverrides> {
    if (!this.isInitialized) {
      this.initialize();
    }
    return { ...this.modelOverrides };
  }

  /**
   * Get all token limits
   */
  getAllTokenLimits(): ModelTokenLimits {
    if (!this.isInitialized) {
      this.initialize();
    }
    return { ...this.tokenLimits };
  }

  /**
   * Force refresh configuration (useful for testing)
   */
  refresh(workingDirectory?: string): void {
    this.isInitialized = false;
    this.modelOverrides = { ...DEFAULT_MODEL_VALUES };
    this.tokenLimits = { ...DEFAULT_TOKEN_LIMITS };
    this.initialize(workingDirectory);
  }
}

// Singleton instance - created lazily
let _modelConfig: ModelConfigManager | null = null;

// Lazy initialization getter
function getModelConfig(): ModelConfigManager {
  if (!_modelConfig) {
    _modelConfig = new ModelConfigManager();
  }
  return _modelConfig;
}

// Export the lazy-loaded singleton
export const modelConfig = {
  getModel: (key: keyof ModelOverrides) => getModelConfig().getModel(key),
  getTokenLimit: (model: string) => getModelConfig().getTokenLimit(model),
  getAllModels: () => getModelConfig().getAllModels(),
  getAllTokenLimits: () => getModelConfig().getAllTokenLimits(),
  refresh: (workingDirectory?: string) =>
    getModelConfig().refresh(workingDirectory),
  initialize: (workingDirectory?: string) =>
    getModelConfig().initialize(workingDirectory),
};

export { ModelConfigManager };
export type { ModelOverrides, ModelTokenLimits, ModelConfiguration };
