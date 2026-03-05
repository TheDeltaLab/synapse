#!/bin/bash

# Quick verification script for Synapse Gateway

ENDPOINT="${SYNAPSE_URL:-"http://localhost:3000"}"
API_KEY="${SYNAPSE_API_KEY:-""}"

echo "Testing Synapse Gateway at $ENDPOINT"
echo ""

# Health check
echo "1. Health Check:"
curl -s "$ENDPOINT/health" | head -c 200
echo ""
echo ""

# Chat completion (if API key is set)
if [ -n "$API_KEY" ]; then
  echo "2. Chat Completion:"
  curl -s --request POST "$ENDPOINT/v1/chat/completions" \
    --header "Authorization: Bearer $API_KEY" \
    --header "Content-Type: application/json" \
    --header "x-synapse-provider: openai" \
    --data '{
      "model": "gpt-4o",
      "messages": [{"role": "user", "content": "Ping"}]
    }' | head -c 500
  echo ""
else
  echo "2. Skipping chat completion (set SYNAPSE_API_KEY to test)"
fi
