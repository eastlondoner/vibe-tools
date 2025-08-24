# Ollama Integration Manual QA Guide

This guide provides comprehensive testing scenarios for the Ollama provider integration in vibe-tools.

## Prerequisites

- macOS system (for automatic installation testing)
- Network connection (for model downloads)
- Terminal access

## Test Scenarios

### Scenario 1: Fresh System Installation

**Objective**: Test the full installation flow on a system without Ollama.

**Steps**:
1. Ensure Ollama is not installed:
   ```bash
   which ollama  # Should return nothing
   ```

2. Check initial status:
   ```bash
   pnpm dev ollama status
   ```
   **Expected**: Should detect Ollama not installed and suggest `vibe-tools ollama install`

3. Install Ollama via CLI:
   ```bash
   pnpm dev ollama install
   ```
   **Expected**: 
   - Checks system requirements (macOS, Homebrew)
   - Installs via `brew install ollama`
   - Provides post-installation guidance
   - Attempts to check daemon status

4. Verify installation:
   ```bash
   which ollama  # Should show path
   pnpm dev ollama status
   ```
   **Expected**: Should show daemon status and provide next steps

### Scenario 2: Status Command Validation

**Objective**: Test status command under various conditions.

**Steps**:
1. **Daemon not running**:
   ```bash
   # Stop daemon if running
   pkill ollama
   pnpm dev ollama status
   ```
   **Expected**: Detects daemon not running, provides start instructions

2. **Daemon running, no models**:
   ```bash
   ollama serve &  # Start daemon
   pnpm dev ollama status
   ```
   **Expected**: Shows daemon running, notes no models installed

3. **Daemon running with models** (after pulling a model):
   ```bash
   pnpm dev ollama status
   ```
   **Expected**: Shows daemon running and lists available models

### Scenario 3: Model Management

**Objective**: Test model pulling, listing, and validation.

**Steps**:
1. **List models (empty)**:
   ```bash
   pnpm dev ollama list
   ```
   **Expected**: Shows no models, suggests pulling one

2. **Pull with invalid model name**:
   ```bash
   pnpm dev ollama pull gpt-oss-20b  # Hyphen instead of colon
   ```
   **Expected**: Rejects with suggestion to use `gpt-oss:20b`

3. **Pull with valid model name**:
   ```bash
   pnpm dev ollama pull gpt-oss:20b
   ```
   **Expected**: Downloads with progress display, success confirmation

4. **List models (with models)**:
   ```bash
   pnpm dev ollama list
   ```
   **Expected**: Shows installed model with size and date

5. **Pull existing model**:
   ```bash
   pnpm dev ollama pull gpt-oss:20b  # Same model again
   ```
   **Expected**: Should handle gracefully (may update or skip)

### Scenario 4: Provider Integration

**Objective**: Test Ollama provider with vibe-tools commands.

**Steps**:
1. **Ask command with default model**:
   ```bash
   pnpm dev ask "Hello, how are you?" --provider=ollama
   ```
   **Expected**: Uses default model `gpt-oss:20b`, returns response

2. **Ask command with specific model**:
   ```bash
   pnpm dev ask "What is 2+2?" --provider=ollama --model=gpt-oss:20b
   ```
   **Expected**: Uses specified model, returns correct answer

3. **Ask command with missing model** (if you have multiple models):
   ```bash
   pnpm dev ask "Hello" --provider=ollama --model=nonexistent:model
   ```
   **Expected**: Should trigger auto-download or provide clear error

4. **Repo command with Ollama**:
   ```bash
   pnpm dev repo "Explain the main components" --provider=ollama
   ```
   **Expected**: Analyzes repository using Ollama, returns analysis

### Scenario 5: Configuration Override Testing

**Objective**: Test environment variable and config file overrides.

**Steps**:
1. **Test OLLAMA_HOST override**:
   ```bash
   OLLAMA_HOST=http://127.0.0.1:11434 pnpm dev ollama status
   ```
   **Expected**: Uses custom host, shows in status output

2. **Test config file override**: 
   Create temporary `vibe-tools.config.json`:
   ```json
   {
     "ollama": {
       "model": "llama3.3:8b",
       "host": "http://localhost:11434"
     }
   }
   ```
   ```bash
   pnpm dev ask "Hello" --provider=ollama
   ```
   **Expected**: Uses config model instead of default

3. **Test CLI model override**:
   ```bash
   pnpm dev ask "Hello" --provider=ollama --model=gpt-oss:20b
   ```
   **Expected**: CLI model takes precedence over config

### Scenario 6: Error Handling

**Objective**: Test various failure scenarios.

**Steps**:
1. **Daemon not running**:
   ```bash
   pkill ollama  # Stop daemon
   pnpm dev ask "Hello" --provider=ollama
   ```
   **Expected**: Clear error message, guidance to start daemon

2. **Network failure during pull**:
   ```bash
   # Disconnect network or use invalid host
   OLLAMA_HOST=http://invalid:11434 pnpm dev ollama pull gpt-oss:20b
   ```
   **Expected**: Connection error, helpful troubleshooting info

3. **Invalid model format**:
   ```bash
   pnpm dev ollama pull invalid-format-no-colon
   ```
   **Expected**: Validation error with format guidance

4. **Insufficient disk space** (simulate if possible):
   **Expected**: Clear error message about disk space

### Scenario 7: Auto-Download Flow

**Objective**: Test automatic model downloading on first use.

**Steps**:
1. **Remove all models**:
   ```bash
   # List and remove all models
   ollama list
   ollama rm <model-name>  # For each model
   ```

2. **Use ask command with missing default model**:
   ```bash
   pnpm dev ask "Hello world" --provider=ollama
   ```
   **Expected**: Auto-downloads `gpt-oss:20b`, then provides response

3. **Verify model was downloaded**:
   ```bash
   pnpm dev ollama list
   ```
   **Expected**: Shows auto-downloaded model

### Scenario 8: Performance and Token Limits

**Objective**: Test model performance and token handling.

**Steps**:
1. **Large context test**:
   ```bash
   pnpm dev ask "$(cat large-file.txt)" --provider=ollama
   ```
   **Expected**: Handles within token limits or provides clear error

2. **Token limit override**:
   ```bash
   pnpm dev ask "Generate a list of 100 items" --provider=ollama --max-tokens=1000
   ```
   **Expected**: Respects token limit, truncates appropriately

## Expected Results Summary

### Success Criteria
- ✅ Installation works on macOS via Homebrew
- ✅ Status command accurately reports daemon and model states
- ✅ Model validation prevents common naming mistakes
- ✅ All subcommands (list, pull, status, install) exit cleanly
- ✅ Provider integration works with ask, repo commands
- ✅ Configuration overrides (env, config, CLI) work correctly
- ✅ Auto-download triggers when models are missing
- ✅ Error messages are helpful and actionable

### Common Issues and Solutions

**Issue**: `brew install ollama` fails
**Solution**: Check Homebrew installation, update Homebrew

**Issue**: Daemon won't start
**Solution**: Check port 11434 availability, try manual `ollama serve`

**Issue**: Model download stalls
**Solution**: Check network connection, try different model

**Issue**: "Model not found" errors
**Solution**: Verify model name format (use colon, not hyphen)

## Test Environment Notes

- Test on clean macOS system when possible
- Ensure sufficient disk space (models can be several GB)
- Test with both fast and slow network connections
- Verify with multiple model types and sizes

## Reporting

For each test scenario, record:
- ✅/❌ Pass/Fail status
- Command output (especially errors)
- System environment details
- Any unexpected behavior
- Performance observations (download speed, response time)

## Follow-up Actions

After completing manual testing:
1. Update this guide with any new findings
2. Create bug reports for any failures
3. Update documentation based on user experience insights
4. Consider automation for critical test paths