/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Simple function to get model with configuration override or fall back to default
function getModel(configKey: string, fallback: string): string {
  try {
    const { modelConfig } = require('./modelConfig.js');
    return modelConfig.getModel(configKey) || fallback;
  } catch {
    return fallback;
  }
}

// Export configurable model constants
export const DEFAULT_GEMINI_MODEL = getModel('DEFAULT_GEMINI_MODEL', 'gemini-2.5-pro');
export const DEFAULT_GEMINI_FLASH_MODEL = getModel('DEFAULT_GEMINI_FLASH_MODEL', 'gemini-2.5-flash');
export const DEFAULT_GEMINI_FLASH_LITE_MODEL = getModel('DEFAULT_GEMINI_FLASH_LITE_MODEL', 'gemini-2.5-flash-lite');
export const DEFAULT_GEMINI_EMBEDDING_MODEL = getModel('DEFAULT_GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001');
