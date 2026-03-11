import crypto from 'crypto';

import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

/**
 * Generate a random salt for password hashing
 */
export function generateSalt(): string {
    return crypto.randomBytes(32).toString('base64');
}

/**
 * Hash a password with a salt
 * The salt is prepended to the password before hashing
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
    const saltedPassword = `${salt}:${password}`;
    return bcrypt.hash(saltedPassword, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
    password: string,
    hash: string,
    salt: string,
): Promise<boolean> {
    const saltedPassword = `${salt}:${password}`;
    return bcrypt.compare(saltedPassword, hash);
}

/**
 * Generate a random password for staff accounts
 */
export function generateRandomPassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + special;

    // Ensure at least one of each required type
    let password = '';
    password += uppercase[crypto.randomInt(uppercase.length)];
    password += lowercase[crypto.randomInt(lowercase.length)];
    password += numbers[crypto.randomInt(numbers.length)];

    // Fill the rest with random characters
    for (let i = password.length; i < length; i++) {
        password += allChars[crypto.randomInt(allChars.length)];
    }

    // Shuffle the password
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        const temp = passwordArray[i]!;
        passwordArray[i] = passwordArray[j]!;
        passwordArray[j] = temp;
    }

    return passwordArray.join('');
}
