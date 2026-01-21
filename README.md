# AIGateway

## Repository Structure
synapse/
├── .github/workflows/    # CI/CD (Auto-sync configs to Portkey Cloud)
├── configs/              # Portkey JSON Gateway configurations
│   ├── default.json      # Main routing logic (OpenRouter/DeepSeek)
│   └── experiments.json  # Testing new models or lower timeouts
├── src/                  # Custom TypeScript logic
│   ├── registry.ts       # Central AI-SDK Provider Registry
│   ├── gateway.ts        # Hono-based custom proxy logic (if needed)
│   └── utils/            # Token counting, metadata helpers
├── infrastructure/       # Deployment manifests
│   └── docker-compose.yml
├── .env.example          # Template for keys
├── package.json          # TS dependencies (ai, @ai-sdk/openai, hono)
└── README.md             # Chinese/English setup guide