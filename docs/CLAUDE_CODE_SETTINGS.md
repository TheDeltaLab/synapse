# deepseek

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "0",
    "ANTHROPIC_BASE_URL": "<gateway url>",
    "ANTHROPIC_AUTH_TOKEN": "<your synapse token>",
    "ANTHROPIC_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_SMALL_FAST_MODEL": "deepseek-v4-flash",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash",
    "DISABLE_NON_ESSENTIAL_MODEL_CALLS": "1",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "ANTHROPIC_CUSTOM_HEADERS": "x-synapse-provider:deepseek\nx-synapse-response-style:anthropic"
  },
  "permissions": {
    "allow": [
      "Bash(find:*)",
      "Bash(ls:*)",
      "Bash(grep:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(sed:*)"
    ]
  },
  "effortLevel": "max"
}
```