#!/bin/bash

# --- Default Variables (Override these via export or command line) ---

# The URL of your Azure Container App or Local Gateway
ENDPOINT="${SYNAPSE_URL:-"http://localhost:8787"}"

# Your Portkey ORG Key (Required for the Control Plane/Dashboard)
PORTKEY_KEY="${PORTKEY_API_KEY:-"your_portkey_org_key_here"}"

# The Provider (openai, anthropic, deepseek, openrouter, etc.)
TARGET_PROVIDER="${PROVIDER:-"openai"}"

# The actual API Key for that provider
TARGET_KEY="${PROVIDER_API_KEY:-"your_actual_provider_key_here"}"

# The Model name
TARGET_MODEL="${MODEL:-"gpt-4o"}"

# Splitter for command line arguments
SPLITTER="------------------------------------------------"

# --- Execution ---

echo "$SPLITTER"
echo "🚀 Testing Synapse Gateway"
echo "Endpoint:  $ENDPOINT"
echo "Provider:  $TARGET_PROVIDER"
echo "Model:     $TARGET_MODEL"
echo "$SPLITTER"

RAW_RESPONSE=$(curl -s -D - -w "\n%{http_code}" --request POST "$ENDPOINT/v1/chat/completions" \
  --header "x-portkey-api-key: $PORTKEY_KEY" \
  --header "x-portkey-provider: $TARGET_PROVIDER" \
  --header "Authorization: Bearer $TARGET_KEY" \
  --header "Content-Type: application/json" \
  --header "x-portkey-config: {\"cache\":{\"mode\":\"simple\"}}" \
  --data "{
    \"model\": \"$TARGET_MODEL\",\
    \"messages\": [{\"role\": \"user\", \"content\": \"Ping\"}]
  }")

# Separate headers, body, and status code from the single in-memory response
HTTP_STATUS=$(printf "%s" "$RAW_RESPONSE" | tail -n1)
HEADERS_AND_BODY=$(printf "%s" "$RAW_RESPONSE" | sed '$d')
HEADERS=$(printf "%s" "$HEADERS_AND_BODY" | sed -n '1,/^\r\{0,1\}$/p' | tr -d '\r')
BODY=$(printf "%s" "$HEADERS_AND_BODY" | sed '1,/^\r\{0,1\}$/d')
CACHE_HEADER=$(printf "%s" "$HEADERS" | grep -i '^x-portkey-cache:' || true)

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "✅ Success (200 OK)"
    echo "Response: $(echo "$BODY" | grep -o '"content":"[^"]*"' | cut -d'"' -f4)"
    if [ -n "$CACHE_HEADER" ]; then
        echo "Cache Header: $CACHE_HEADER"
    else
        echo "$SPLITTER"
        echo "Cache Header: (not returned)"
        echo "Raw Headers:"
        echo "$HEADERS"
        echo "$SPLITTER"
    fi
    echo "Check your Portkey Dashboard (app.portkey.ai) to see the log!"
else
    echo "❌ Failed with Status: $HTTP_STATUS"
    echo "Error Headers:"
    echo "$HEADERS"
    echo "Error Body: $BODY"
fi
echo "$SPLITTER"