# OpenAI-Compatible Endpoints Integration

The Gemini CLI now supports OpenAI and OpenAI-compatible endpoints alongside Google's Gemini models, allowing you to use a wide variety of AI providers while maintaining the same familiar interface.

## Overview

This integration enables you to:
- **Use OpenAI models** like GPT-4, GPT-3.5-turbo directly
- **Connect to local LLMs** running OpenAI-compatible APIs (Ollama, LocalAI, etc.)
- **Switch between providers** seamlessly through the authentication system
- **Maintain conversation history** when switching between different AI providers

## Quick Start

### 1. Set Up Environment Variables

#### For OpenAI API
```bash
export OPENAI_API_KEY="your-openai-api-key-here"
```

#### For OpenAI-Compatible Endpoints (e.g., Ollama)
```bash
export OPENAI_API_KEY="your-api-key-or-dummy-key"
export OPENAI_BASE_URL="http://localhost:11434/v1"
```

### 2. Configure Authentication

1. Launch Gemini CLI: `gemini`
2. Run the auth command: `/auth`
3. Select your preferred option:
   - **"OpenAI API Key"** - For official OpenAI API
   - **"OpenAI-Compatible Endpoint"** - For local/custom endpoints

### 3. Start Using

That's it! You can now chat with OpenAI models using all the same features you're familiar with from Gemini CLI.

## Supported Providers

### OpenAI Official API
- **Models**: gpt-4, gpt-4-turbo, gpt-3.5-turbo, and all current OpenAI models
- **Features**: Text generation, streaming responses, embeddings
- **Requirements**: Valid OpenAI API key

### OpenAI-Compatible Endpoints

Popular options include:

#### Ollama (Local LLM Runtime)
```bash
# Install and run Ollama
ollama serve

# Pull a model
ollama pull llama2

# Configure Gemini CLI
export OPENAI_API_KEY="dummy-key"
export OPENAI_BASE_URL="http://localhost:11434/v1"
```

#### LocalAI
```bash
export OPENAI_API_KEY="your-localai-key"
export OPENAI_BASE_URL="http://localhost:8080/v1"
```

#### Anthropic Claude (via proxy)
```bash
export OPENAI_API_KEY="your-anthropic-key"
export OPENAI_BASE_URL="https://api.anthropic.com/v1"
```

#### Azure OpenAI
```bash
export OPENAI_API_KEY="your-azure-key"
export OPENAI_BASE_URL="https://your-resource.openai.azure.com/openai/deployments/your-deployment"
```

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `OPENAI_API_KEY` | ✅ | API key for authentication | `sk-proj-abc123...` |
| `OPENAI_BASE_URL` | For compatible endpoints | Base URL for API calls | `http://localhost:11434/v1` |
| `GEMINI_DEFAULT_AUTH_TYPE` | ❌ | Set default auth method | `openai-api-key` |

## Authentication Methods

### OpenAI API Key
- **Use case**: Official OpenAI API
- **Requirements**: `OPENAI_API_KEY` environment variable
- **Models**: All OpenAI models (gpt-4, gpt-3.5-turbo, etc.)

### OpenAI-Compatible Endpoint  
- **Use case**: Local LLMs, custom endpoints, alternative providers
- **Requirements**: Both `OPENAI_API_KEY` and `OPENAI_BASE_URL`
- **Models**: Depends on your endpoint (llama2, mistral, etc.)

## Model Selection

When using OpenAI integration, you can specify models using the `--model` flag:

```bash
# Use GPT-4
gemini --model gpt-4

# Use GPT-3.5 Turbo
gemini --model gpt-3.5-turbo

# Use local Ollama model
gemini --model llama2
```

## Features & Compatibility

### ✅ Supported Features
- **Text Generation**: Full conversational AI capabilities
- **Streaming Responses**: Real-time response streaming
- **Tool Integration**: All Gemini CLI tools work with OpenAI models
- **Memory System**: Conversation memory and context preservation
- **Authentication Switching**: Change providers without losing conversation
- **Error Handling**: Robust error handling and validation
- **Embeddings**: Text embedding generation (where supported)

### ⚠️ Limitations
- **Function Calling**: Limited to OpenAI's function calling format
- **Token Counting**: Approximated for OpenAI (no direct API)
- **Model-Specific Features**: Some features may vary by provider

## Troubleshooting

### Common Issues

#### "OpenAI API key not found"
```bash
# Ensure the environment variable is set
echo $OPENAI_API_KEY

# Set it if missing
export OPENAI_API_KEY="your-key-here"
```

#### "OpenAI Base URL not found" 
```bash
# Required for compatible endpoints
export OPENAI_BASE_URL="http://localhost:11434/v1"
```

#### Connection Errors
```bash
# Test your endpoint directly
curl -X POST "$OPENAI_BASE_URL/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}'
```

#### Model Not Found
- Ensure the model name matches what your endpoint supports
- For Ollama: Use `ollama list` to see available models
- For OpenAI: Check the [official model list](https://platform.openai.com/docs/models)

### Debug Mode

Enable debug mode for detailed logging:
```bash
gemini --debug
```

## Examples

### Basic Chat with GPT-4
```bash
export OPENAI_API_KEY="sk-proj-your-key-here"
gemini --model gpt-4
# Then use /auth to select "OpenAI API Key"
```

### Local Ollama Setup
```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Pull a model
ollama pull mistral

# Terminal 3: Configure and run Gemini CLI
export OPENAI_API_KEY="dummy"
export OPENAI_BASE_URL="http://localhost:11434/v1"
gemini --model mistral
# Use /auth to select "OpenAI-Compatible Endpoint"
```

### Switching Between Providers
```bash
# Start with Gemini
gemini

# Switch to OpenAI mid-conversation
/auth
# Select "OpenAI API Key"

# Switch back to Gemini
/auth  
# Select "Login with Google"
```

## Advanced Configuration

### Custom Headers (for compatible endpoints)
Some endpoints may require additional headers. You can extend the integration by modifying the OpenAI client configuration.

### Proxy Support
The OpenAI integration respects the same proxy settings as Gemini:
```bash
export HTTPS_PROXY="http://your-proxy:8080"
gemini
```

### Model Aliases
You can create shell aliases for commonly used models:
```bash
alias gemini-gpt4="OPENAI_API_KEY=$OPENAI_KEY gemini --model gpt-4"
alias gemini-local="OPENAI_BASE_URL=http://localhost:11434/v1 gemini --model llama2"
```

## Migration from Other Tools

### From OpenAI CLI
Replace direct OpenAI CLI usage:
```bash
# Instead of: openai api chat.completions.create -m gpt-4 -g user "Hello"
# Use: gemini --model gpt-4 --prompt "Hello"
```

### From curl/API calls
Replace direct API calls with Gemini CLI for better UX:
```bash
# Instead of complex curl commands
# Use the interactive Gemini CLI interface
```

## Security Considerations

- **API Keys**: Store API keys securely, consider using `.env` files
- **Local Endpoints**: Ensure local LLM endpoints are not exposed publicly
- **Network**: Use HTTPS for remote endpoints when possible
- **Logging**: Be aware that debug mode may log request/response data

## Contributing

The OpenAI integration is built with extensibility in mind. To add support for new providers:

1. Extend the `ProviderType` enum
2. Add authentication validation
3. Implement format mapping if needed
4. Add tests for the new provider

See the implementation in:
- `packages/core/src/core/openaiClient.ts`
- `packages/core/src/core/contentGenerator.ts`
- `packages/cli/src/config/auth.ts`

## Support

For issues specific to OpenAI integration:
1. Check the [troubleshooting section](#troubleshooting)
2. Verify your environment variables
3. Test your endpoint independently
4. Open an issue on the [Gemini CLI repository](https://github.com/google-gemini/gemini-cli/issues)

---

**Next Steps**: Try the [tutorials](cli/tutorials.md) with your preferred AI provider, or explore [advanced configuration](cli/configuration.md) options.