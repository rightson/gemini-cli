/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type Model = string;
type TokenCount = number;

export const DEFAULT_TOKEN_LIMIT = 1_048_576;


export function tokenLimit(model: Model): TokenCount {
  // Add other models as they become relevant or if specified by config
  // Pulled from https://ai.google.dev/gemini-api/docs/models
  switch (model) {
    case 'gemini-1.5-pro':
      return 2_097_152;
    case 'gemini-1.5-flash':
    case 'gemini-2.5-pro-preview-05-06':
    case 'gemini-2.5-pro-preview-06-05':
    case 'gemini-2.5-pro':
    case 'gemini-2.5-flash-preview-05-20':
    case 'gemini-2.5-flash':
    case 'gemini-2.5-flash-lite':
    case 'gemini-2.0-flash':
      return 1_048_576;
    case 'gemini-2.0-flash-preview-image-generation':
      return 32_000;

      default:
      // Try to use models.json configuration for non-Gemini models
      try {
        const { modelConfig } = require('../config/modelConfig.js');
        const configuredLimit = modelConfig.getTokenLimit(model);
        if (configuredLimit !== undefined) {
          return configuredLimit;
        }
      } catch {
        // If modelConfig is not available, fall through to pattern matching
      }

      // For custom/unknown models, check if it follows common naming patterns

      // Modern OpenAI GPT-4x/4o family: all context 128k
      if (/gpt-4(\.1|-turbo|-o)?/i.test(model)) {
        return 128_000;
      }
      // Modern Claude 3.x/4.x: all context 200k
      if (/claude-(3|4)/i.test(model)) {
        return 200_000;
      }
      // Modern Llama 3.x: all context 128k
      if (/llama-3/i.test(model)) {
        return 128_000;
      }
      // Efficiency/minified models (mini/lite): 16k
      if (/mini|lite/i.test(model)) {
        return 16_384;
      }
      // Everything else
      return DEFAULT_TOKEN_LIMIT;
  }
}
