#!/bin/bash

# --- Default Variables (Override these via export or command line) ---

# The URL of your Synapse Gateway
ENDPOINT="${SYNAPSE_URL:-"http://localhost:3000"}"

# Your Synapse API Key (created via the dashboard or admin API)
API_KEY="${SYNAPSE_API_KEY:-"your_synapse_api_key_here"}"

# The Provider to use (openai, anthropic, google, deepseek, openrouter)
TARGET_PROVIDER="${PROVIDER:-"openai"}"

# The Model name
TARGET_MODEL="${MODEL:-"gpt-4o"}"

# Splitter for output formatting
SPLITTER="------------------------------------------------"

# --- Execution ---

echo "$SPLITTER"
echo "🚀 Testing Synapse Gateway"
echo "Endpoint:  $ENDPOINT"
echo "Provider:  $TARGET_PROVIDER"
echo "Model:     $TARGET_MODEL"
echo "$SPLITTER"

RAW_RESPONSE=$(curl -s -D - -w "\n%{http_code}" --request POST "$ENDPOINT/v1/chat/completions" \
  --header "Authorization: Bearer $API_KEY" \
  --header "Content-Type: application/json" \
  --header "x-synapse-provider: $TARGET_PROVIDER" \
  --data "{
    \"model\": \"$TARGET_MODEL\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Ping\"}]
  }")

# Separate headers, body, and status code from the single in-memory response
HTTP_STATUS=$(printf "%s" "$RAW_RESPONSE" | tail -n1)
HEADERS_AND_BODY=$(printf "%s" "$RAW_RESPONSE" | sed '$d')
HEADERS=$(printf "%s" "$HEADERS_AND_BODY" | sed -n '1,/^\r\{0,1\}$/p' | tr -d '\r')
BODY=$(printf "%s" "$HEADERS_AND_BODY" | sed '1,/^\r\{0,1\}$/d')

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "✅ Success (200 OK)"
    echo "Response: $(echo "$BODY" | grep -o '"content":"[^"]*"' | cut -d'"' -f4)"
    echo "$SPLITTER"
    echo "Check the Synapse Dashboard to see the request log!"
else
    echo "❌ Failed with Status: $HTTP_STATUS"
    echo "Error Headers:"
    echo "$HEADERS"
    echo "Error Body: $BODY"
fi
echo "$SPLITTER"
