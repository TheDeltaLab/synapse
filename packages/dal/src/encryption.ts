import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
// Auth tag is 16 bytes by default for AES-256-GCM

/**
 * Get the encryption key from environment variable.
 * Must be 32 bytes, base64 encoded.
 */
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    const keyBuffer = Buffer.from(key, 'base64');
    if (keyBuffer.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be 32 bytes (256 bits) when base64 decoded');
    }
    return keyBuffer;
}

/**
 * Check if encryption is configured.
 */
export function isEncryptionConfigured(): boolean {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) return false;
    try {
        const keyBuffer = Buffer.from(key, 'base64');
        return keyBuffer.length === 32;
    } catch {
        return false;
    }
}

export interface EncryptedData {
    ciphertext: Uint8Array;
    iv: Uint8Array;
    tag: Uint8Array;
}

/**
 * Encrypt data using AES-256-GCM.
 */
export function encrypt(plaintext: string): EncryptedData {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return {
        ciphertext: new Uint8Array(encrypted),
        iv: new Uint8Array(iv),
        tag: new Uint8Array(tag),
    };
}

/**
 * Decrypt data using AES-256-GCM.
 */
export function decrypt(ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array): string {
    const key = getEncryptionKey();
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv));
    decipher.setAuthTag(Buffer.from(tag));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(ciphertext)),
        decipher.final(),
    ]);

    return decrypted.toString('utf8');
}

export interface ChatMessage {
    role: string;
    content: string;
}

export interface EncryptedContent {
    promptContent: Uint8Array | null;
    responseContent: Uint8Array | null;
    contentIv: Uint8Array | null;
    contentTag: Uint8Array | null;
}

/**
 * Encrypt chat content (prompt messages and response).
 * Uses a single IV and tag for both prompt and response.
 */
export function encryptContent(
    promptMessages?: ChatMessage[],
    responseText?: string,
): EncryptedContent {
    if (!isEncryptionConfigured()) {
        return {
            promptContent: null,
            responseContent: null,
            contentIv: null,
            contentTag: null,
        };
    }

    if (!promptMessages && !responseText) {
        return {
            promptContent: null,
            responseContent: null,
            contentIv: null,
            contentTag: null,
        };
    }

    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);

    // Combine prompt and response into a single JSON object for encryption
    const content = JSON.stringify({
        prompt: promptMessages || null,
        response: responseText || null,
    });

    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(content, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
        promptContent: new Uint8Array(encrypted),
        responseContent: null, // Combined into promptContent
        contentIv: new Uint8Array(iv),
        contentTag: new Uint8Array(tag),
    };
}

export interface DecryptedContent {
    promptMessages: ChatMessage[] | null;
    responseText: string | null;
}

/**
 * Decrypt chat content (prompt messages and response).
 */
export function decryptContent(
    promptContent: Uint8Array | null,
    _responseContent: Uint8Array | null,
    contentIv: Uint8Array | null,
    contentTag: Uint8Array | null,
): DecryptedContent {
    if (!promptContent || !contentIv || !contentTag) {
        return {
            promptMessages: null,
            responseText: null,
        };
    }

    try {
        const decrypted = decrypt(promptContent, contentIv, contentTag);
        const parsed = JSON.parse(decrypted);
        return {
            promptMessages: parsed.prompt || null,
            responseText: parsed.response || null,
        };
    } catch (error) {
        console.error('Failed to decrypt content:', error);
        return {
            promptMessages: null,
            responseText: null,
        };
    }
}

export interface EncryptedEmbeddingInputs {
    requestContent: Uint8Array | null;
    requestContentIv: Uint8Array | null;
    requestContentTag: Uint8Array | null;
}

/**
 * Encrypt embedding input texts. When encryption is not configured, returns
 * the plaintext JSON in `requestContent` and null IV/tag — readers detect this
 * by absence of IV/tag.
 */
export function encryptEmbeddingInputs(inputs: string[] | null): EncryptedEmbeddingInputs {
    if (!inputs) {
        return { requestContent: null, requestContentIv: null, requestContentTag: null };
    }
    const plaintext = JSON.stringify(inputs);
    if (!isEncryptionConfigured()) {
        return {
            requestContent: new Uint8Array(Buffer.from(plaintext, 'utf8')),
            requestContentIv: null,
            requestContentTag: null,
        };
    }
    const { ciphertext, iv, tag } = encrypt(plaintext);
    return {
        requestContent: ciphertext,
        requestContentIv: iv,
        requestContentTag: tag,
    };
}

/**
 * Decrypt embedding inputs back to a string array. Falls back to UTF-8 JSON
 * when IV/tag are absent (legacy or unencrypted rows).
 */
export function decryptEmbeddingInputs(
    requestContent: Uint8Array | null,
    requestContentIv: Uint8Array | null,
    requestContentTag: Uint8Array | null,
): string[] | null {
    if (!requestContent) return null;
    let raw: string;
    if (requestContentIv && requestContentTag) {
        try {
            raw = decrypt(requestContent, requestContentIv, requestContentTag);
        } catch (error) {
            console.error('Failed to decrypt embedding inputs:', error);
            return null;
        }
    } else {
        raw = Buffer.from(requestContent).toString('utf8');
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : null;
    } catch {
        return null;
    }
}
