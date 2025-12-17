---
allowed-tools: Bash(curl:*), Bash(ollama:*)
argument-hint: [claude|openai|ollama]
description: Test AI provider connections and configurations
---

# AI Provider Test

Test AI provider connections for the quiz application.

## Test Ollama (Local)
!`curl -s http://localhost:11434/api/tags 2>&1 | head -10`

## Provider Configuration

### Claude (Anthropic)
- API endpoint: https://api.anthropic.com/v1/messages
- Required header: `x-api-key`, `anthropic-version`
- Model: claude-3-sonnet or claude-3-haiku

### OpenAI
- API endpoint: https://api.openai.com/v1/chat/completions
- Required header: `Authorization: Bearer $OPENAI_API_KEY`
- Model: gpt-4 or gpt-3.5-turbo

### Ollama (Local)
- API endpoint: http://localhost:11434/api/generate
- No API key required
- Models: llama2, mistral, codellama, etc.

## Test Commands

### Test Claude
```bash
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}'
```

### Test OpenAI
```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}],"max_tokens":100}'
```

### Test Ollama
```bash
curl -X POST http://localhost:11434/api/generate \
  -d '{"model":"llama2","prompt":"Hello","stream":false}'
```

## Troubleshooting

1. **API key invalid**: Check .env file or user settings
2. **Rate limited**: Wait and retry, or check usage limits
3. **Ollama not running**: Start with `docker compose --profile local-llm up -d`
4. **Model not found**: Pull model with `ollama pull <model-name>`
5. **Timeout**: Check network connectivity and API status
