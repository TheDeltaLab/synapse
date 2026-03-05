export { prisma } from './client.js';
export type { ApiKey, RequestLog } from '@synapse/dal/prisma/index.js';
export {
    encrypt,
    decrypt,
    encryptContent,
    decryptContent,
    isEncryptionConfigured,
    type EncryptedData,
    type EncryptedContent,
    type DecryptedContent,
    type ChatMessage,
} from './encryption.js';
