/** Default mock response text used when MOCK_RESPONSE_TEXT env var is not set */
const DEFAULT_MOCK_RESPONSE_TEXT = 'this is a mock response from LLM';

/** Mock response text returned by all chat completion endpoints.
 *  Override via the `MOCK_RESPONSE_TEXT` environment variable. */
export const MOCK_RESPONSE_TEXT = process.env.MOCK_RESPONSE_TEXT || DEFAULT_MOCK_RESPONSE_TEXT;
