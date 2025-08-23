#!/usr/bin/env tsx

/**
 * Provider Expansion Validation Script
 *
 * This script validates that the Stagehand provider expansion is working correctly.
 * It tests the core functionality without requiring actual browser automation.
 */

import { getStagehandApiKey } from '../../../src/commands/browser/stagehand/config';
import { isValidStagehandModel } from '../../../src/commands/browser/stagehand/config';
import { loadStagehandConfig } from '../../../src/commands/browser/stagehand/config';
import { validateStagehandConfig } from '../../../src/commands/browser/stagehand/config';
import { getStagehandModel } from '../../../src/commands/browser/stagehand/config';

async function testProviderExpansion() {
  console.log('🧪 Testing Stagehand Provider Expansion...\n');

  const testResults: { test: string; passed: boolean; error?: string }[] = [];

  // Test 1: Valid model formats
  try {
    const validModels = [
      'xai/grok-4-latest',
      'groq-llama-3.3-70b-versatile',
      'cerebras/llama-3.3-70b',
      'anthropic/claude-sonnet-4-20250514',
      'grok-4-latest',
      'claude-sonnet-4-20250514'
    ];

    for (const model of validModels) {
      if (!isValidStagehandModel(model)) {
        throw new Error(`Model ${model} should be valid`);
      }
    }
    testResults.push({ test: 'Valid model formats', passed: true });
    console.log('✅ Valid model formats test passed');
  } catch (error) {
    testResults.push({ test: 'Valid model formats', passed: false, error: error.message });
    console.log('❌ Valid model formats test failed:', error.message);
  }

  // Test 2: Invalid model formats
  try {
    const invalidModels = ['', 'invalid/model with spaces', 'provider/'];

    for (const model of invalidModels) {
      if (isValidStagehandModel(model)) {
        throw new Error(`Model ${model} should be invalid`);
      }
    }
    testResults.push({ test: 'Invalid model formats', passed: true });
    console.log('✅ Invalid model formats test passed');
  } catch (error) {
    testResults.push({ test: 'Invalid model formats', passed: false, error: error.message });
    console.log('❌ Invalid model formats test failed:', error.message);
  }

  // Test 3: API key mapping
  try {
    const testProviders = ['xai', 'groq', 'cerebras', 'anthropic', 'openai', 'gemini', 'openrouter', 'perplexity', 'modelbox'];

    for (const provider of testProviders) {
      try {
        // This should throw an error since we don't have API keys set
        getStagehandApiKey({ provider: provider as any });
        throw new Error(`Should have thrown error for missing API key for ${provider}`);
      } catch (error) {
        let expectedKeyName = provider.toUpperCase() + '_API_KEY';
        // Special cases for providers with different naming conventions
        if (provider === 'azure') {
          expectedKeyName = 'AZURE_OPENAI_API_KEY';
        } else if (provider === 'togetherai') {
          expectedKeyName = 'TOGETHERAI_API_KEY';
        }

        if (!error.message.includes(expectedKeyName)) {
          throw new Error(`Expected API key error message for ${provider} to include ${expectedKeyName}, got: ${error.message}`);
        }
      }
    }
    testResults.push({ test: 'API key mapping', passed: true });
    console.log('✅ API key mapping test passed');
  } catch (error) {
    testResults.push({ test: 'API key mapping', passed: false, error: error.message });
    console.log('❌ API key mapping test failed:', error.message);
  }

  // Test 4: Default models
  try {
    const testConfigs = [
      { provider: 'xai' as const, expectedModel: 'xai/grok-4-latest' },
      { provider: 'groq' as const, expectedModel: 'groq-llama-3.3-70b-versatile' },
      { provider: 'cerebras' as const, expectedModel: 'cerebras/llama-3.3-70b' },
      { provider: 'anthropic' as const, expectedModel: 'anthropic/claude-sonnet-4-20250514' }
    ];

    for (const { provider, expectedModel } of testConfigs) {
      const mockConfig = { provider, headless: true, verbose: false, debugDom: false, enableCaching: false };
      const model = getStagehandModel(mockConfig);
      if (model !== expectedModel) {
        throw new Error(`Expected ${expectedModel} for ${provider}, got ${model}`);
      }
    }
    testResults.push({ test: 'Default models', passed: true });
    console.log('✅ Default models test passed');
  } catch (error) {
    testResults.push({ test: 'Default models', passed: false, error: error.message });
    console.log('❌ Default models test failed:', error.message);
  }

  // Test 5: Provider validation
  try {
    const supportedProviders = ['anthropic', 'openai', 'gemini', 'openrouter', 'xai', 'groq', 'cerebras', 'togetherai', 'mistral', 'deepseek', 'perplexity', 'azure', 'ollama'];
    const unsupportedProviders = ['unsupported', 'invalid', 'fake'];

    for (const provider of supportedProviders) {
      const mockConfig = { provider: provider as any, headless: true, verbose: false, debugDom: false, enableCaching: false };
      try {
        validateStagehandConfig(mockConfig);
      } catch (error) {
        // Should only fail on API key validation, not provider validation
        if (!error.message.includes('API key') && !error.message.includes('is required for Stagehand')) {
          throw new Error(`Unexpected error for supported provider ${provider}: ${error.message}`);
        }
      }
    }

    for (const provider of unsupportedProviders) {
      const mockConfig = { provider: provider as any, headless: true, verbose: false, debugDom: false, enableCaching: false };
      try {
        validateStagehandConfig(mockConfig);
        throw new Error(`Should have thrown error for unsupported provider ${provider}`);
      } catch (error) {
        if (!error.message.includes('Invalid Stagehand provider')) {
          throw new Error(`Expected provider validation error for ${provider}, got: ${error.message}`);
        }
      }
    }
    testResults.push({ test: 'Provider validation', passed: true });
    console.log('✅ Provider validation test passed');
  } catch (error) {
    testResults.push({ test: 'Provider validation', passed: false, error: error.message });
    console.log('❌ Provider validation test failed:', error.message);
  }

  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');

  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / testResults.length) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.filter(r => !r.passed).forEach(result => {
      console.log(`  - ${result.test}: ${result.error}`);
    });
  }

  console.log('\n🎉 Provider expansion validation completed!');
  console.log('Note: This script validates the core functionality. Full integration testing requires actual API keys.');

  return failed === 0;
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testProviderExpansion().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

export { testProviderExpansion };
