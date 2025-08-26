/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelConfigManager } from './modelConfig.js';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ModelConfigManager', () => {
  let testDir: string;
  let manager: ModelConfigManager;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `gemini-cli-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    manager = new ModelConfigManager();
  });

  afterEach(() => {
    // Clean up test files
    const envFile = join(testDir, '.env');
    const jsonFile = join(testDir, 'models.json');

    if (existsSync(envFile)) unlinkSync(envFile);
    if (existsSync(jsonFile)) unlinkSync(jsonFile);

    try {
      unlinkSync(testDir);
    } catch {
      // Directory might not be empty, ignore
    }
  });

  describe('default values', () => {
    it('should return default Gemini models', () => {
      manager.initialize(testDir);

      expect(manager.getModel('DEFAULT_GEMINI_MODEL')).toBe('gemini-2.5-pro');
      expect(manager.getModel('DEFAULT_GEMINI_FLASH_MODEL')).toBe(
        'gemini-2.5-flash',
      );
      expect(manager.getModel('DEFAULT_GEMINI_FLASH_LITE_MODEL')).toBe(
        'gemini-2.5-flash-lite',
      );
      expect(manager.getModel('DEFAULT_GEMINI_EMBEDDING_MODEL')).toBe(
        'gemini-embedding-001',
      );
    });

    it('should return default token limits', () => {
      manager.initialize(testDir);

      expect(manager.getTokenLimit('gemini-2.5-pro')).toBe(1_048_576);
      expect(manager.getTokenLimit('gpt-4')).toBe(128_000);
      expect(manager.getTokenLimit('gpt-3.5-turbo')).toBe(16_384);
      expect(manager.getTokenLimit('unknown-model')).toBe(1_048_576);
    });
  });

  describe('JSON configuration', () => {
    it('should load model overrides from models.json', () => {
      const config = {
        models: {
          DEFAULT_GEMINI_MODEL: 'gpt-4.1',
          DEFAULT_GEMINI_FLASH_MODEL: 'gpt-4.1-mini',
        },
        tokenLimits: {
          'gpt-4.1': 150_000,
          'custom-model': 50_000,
        },
      };

      writeFileSync(join(testDir, 'models.json'), JSON.stringify(config));
      manager.initialize(testDir);

      expect(manager.getModel('DEFAULT_GEMINI_MODEL')).toBe('gpt-4.1');
      expect(manager.getModel('DEFAULT_GEMINI_FLASH_MODEL')).toBe(
        'gpt-4.1-mini',
      );
      expect(manager.getTokenLimit('gpt-4.1')).toBe(150_000);
      expect(manager.getTokenLimit('custom-model')).toBe(50_000);
    });

    it('should handle invalid JSON gracefully', () => {
      writeFileSync(join(testDir, 'models.json'), 'invalid json');

      // Should not throw and should use defaults
      expect(() => manager.initialize(testDir)).not.toThrow();
      expect(manager.getModel('DEFAULT_GEMINI_MODEL')).toBe('gemini-2.5-pro');
    });
  });

  describe('environment variable configuration', () => {
    it('should load model overrides from process.env', () => {
      const originalEnv = { ...process.env };

      process.env.DEFAULT_GEMINI_MODEL = 'gpt-4.1';
      process.env.DEFAULT_GEMINI_FLASH_LITE_MODEL = 'gpt-4.1-mini';
      process.env.MODEL_TOKEN_LIMIT_GPT_4_1 = '200000';
      process.env.MODEL_TOKEN_LIMIT_CUSTOM_MODEL = '64000';

      manager.initialize(testDir);

      expect(manager.getModel('DEFAULT_GEMINI_MODEL')).toBe('gpt-4.1');
      expect(manager.getModel('DEFAULT_GEMINI_FLASH_LITE_MODEL')).toBe(
        'gpt-4.1-mini',
      );
      expect(manager.getTokenLimit('gpt-4.1')).toBe(200_000);
      expect(manager.getTokenLimit('custom-model')).toBe(64_000);

      // Restore original environment
      process.env = originalEnv;
    });
  });

  describe('pattern matching for unknown models', () => {
    it('should apply appropriate token limits based on model name patterns', () => {
      manager.initialize(testDir);

      // GPT-4 variants
      expect(manager.getTokenLimit('gpt-4-custom')).toBe(128_000);
      expect(manager.getTokenLimit('custom-gpt-4-model')).toBe(128_000);

      // Claude variants
      expect(manager.getTokenLimit('claude-3-custom')).toBe(128_000);

      // Mini/lite variants
      expect(manager.getTokenLimit('gpt-3.5-turbo-custom')).toBe(16_384);
      expect(manager.getTokenLimit('custom-mini-model')).toBe(16_384);
      expect(manager.getTokenLimit('custom-lite-model')).toBe(16_384);

      // Unknown models
      expect(manager.getTokenLimit('completely-unknown-model')).toBe(1_048_576);
    });
  });

  describe('configuration priority', () => {
    it('should prioritize environment variables over JSON config', () => {
      const originalEnv = { ...process.env };

      // Set up JSON config
      const config = {
        models: {
          DEFAULT_GEMINI_MODEL: 'from-json',
        },
      };
      writeFileSync(join(testDir, 'models.json'), JSON.stringify(config));

      // Set environment variable (higher priority)
      process.env.DEFAULT_GEMINI_MODEL = 'from-env';

      manager.initialize(testDir);

      expect(manager.getModel('DEFAULT_GEMINI_MODEL')).toBe('from-env');

      // Restore original environment
      process.env = originalEnv;
    });
  });

  describe('refresh functionality', () => {
    it('should reload configuration when refresh is called', () => {
      manager.initialize(testDir);
      expect(manager.getModel('DEFAULT_GEMINI_MODEL')).toBe('gemini-2.5-pro');

      // Create new config file
      const config = {
        models: {
          DEFAULT_GEMINI_MODEL: 'gpt-4.1',
        },
      };
      writeFileSync(join(testDir, 'models.json'), JSON.stringify(config));

      // Refresh and check new value is loaded
      manager.refresh(testDir);
      expect(manager.getModel('DEFAULT_GEMINI_MODEL')).toBe('gpt-4.1');
    });
  });
});
