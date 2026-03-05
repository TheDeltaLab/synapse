ENDPOINT="https://synapse-test.yellowbeach-5ce401f6.koreacentral.azurecontainerapps.io"
PORTKEY_ORG_KEY=""
OPENROUTER_KEY=""
curl --request POST '<ENDPOINT>/v1/chat/completions' \
  --header 'x-portkey-api-key: <PORTKEY_ORG_KEY>' \
  --header 'x-portkey-provider: openai' \
  --header 'Authorization: Bearer <OPENROUTER_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Ping"}]
  }'