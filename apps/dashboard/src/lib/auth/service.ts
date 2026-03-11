import { prisma } from '@synapse/dal';
import type {
    RegisterRequest,
    CreateStaffRequest,
    UserResponse,
} from '@synapse/shared';

import { signToken, type JWTPayload } from './jwt';
import { generateSalt, hashPassword, verifyPassword, generateRandomPassword } from './password';

const PASSWORD_PROVIDER = 'password';

interface PasswordProviderOptions {
    salt: string;
    [key: string]: string; // Index signature for JSON compatibility
}

/**
 * Check if registration is open (no admin users exist)
 */
export async function isRegistrationOpen(): Promise<boolean> {
    const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
    });
    return adminCount === 0;
}

/**
 * Convert a database user to a UserResponse
 */
function toUserResponse(user: {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'STAFF';
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING_PASSWORD_RESET';
    createdAt: Date;
    lastLoginAt: Date | null;
}): UserResponse {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
}

/**
 * Register the first admin user
 */
export async function registerAdmin(
    data: RegisterRequest,
): Promise<{ user: UserResponse; token: string }> {
    // Check if registration is still open
    const open = await isRegistrationOpen();
    if (!open) {
        throw new Error('Registration is closed');
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
    });
    if (existingUser) {
        throw new Error('Email already registered');
    }

    // Generate salt and hash password
    const salt = generateSalt();
    const hashedPassword = await hashPassword(data.password, salt);

    // Create user with password provider
    const user = await prisma.user.create({
        data: {
            email: data.email,
            name: data.name,
            role: 'ADMIN',
            status: 'ACTIVE',
            authProviders: {
                create: {
                    name: PASSWORD_PROVIDER,
                    providerId: hashedPassword,
                    providerOptions: { salt } as PasswordProviderOptions,
                },
            },
        },
    });

    // Sign token
    const payload: JWTPayload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
    };
    const token = await signToken(payload);

    return { user: toUserResponse(user), token };
}

/**
 * Login with email and password
 */
export async function login(
    email: string,
    password: string,
): Promise<{ user: UserResponse; token: string }> {
    // Find user with password provider
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            authProviders: {
                where: { name: PASSWORD_PROVIDER },
            },
        },
    });

    if (!user || user.authProviders.length === 0) {
        throw new Error('Invalid email or password');
    }

    if (user.status === 'INACTIVE') {
        throw new Error('Account is inactive');
    }

    const authProvider = user.authProviders[0]!;
    const providerOptions = authProvider.providerOptions as unknown as PasswordProviderOptions;

    // Verify password
    const isValid = await verifyPassword(
        password,
        authProvider.providerId,
        providerOptions.salt,
    );

    if (!isValid) {
        throw new Error('Invalid email or password');
    }

    // Update last login
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    // Sign token
    const payload: JWTPayload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
    };
    const token = await signToken(payload);

    return { user: toUserResponse(user), token };
}

/**
 * Create a staff account (admin only)
 */
export async function createStaffAccount(
    data: CreateStaffRequest,
    _adminId: string,
): Promise<{ user: UserResponse; temporaryPassword: string }> {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
    });
    if (existingUser) {
        throw new Error('Email already registered');
    }

    // Generate temporary password and salt
    const temporaryPassword = generateRandomPassword();
    const salt = generateSalt();
    const hashedPassword = await hashPassword(temporaryPassword, salt);

    // Create user with password provider and PENDING_PASSWORD_RESET status
    const user = await prisma.user.create({
        data: {
            email: data.email,
            name: data.name,
            role: 'STAFF',
            status: 'PENDING_PASSWORD_RESET',
            authProviders: {
                create: {
                    name: PASSWORD_PROVIDER,
                    providerId: hashedPassword,
                    providerOptions: { salt } as PasswordProviderOptions,
                },
            },
        },
    });

    return { user: toUserResponse(user), temporaryPassword };
}

/**
 * Reset password with current password verification
 */
export async function resetPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
): Promise<void> {
    // Find user with password provider
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            authProviders: {
                where: { name: PASSWORD_PROVIDER },
            },
        },
    });

    if (!user || user.authProviders.length === 0) {
        throw new Error('User not found');
    }

    const authProvider = user.authProviders[0]!;
    const providerOptions = authProvider.providerOptions as unknown as PasswordProviderOptions;

    // Verify current password
    const isValid = await verifyPassword(
        currentPassword,
        authProvider.providerId,
        providerOptions.salt,
    );

    if (!isValid) {
        throw new Error('Current password is incorrect');
    }

    // Generate new salt and hash new password
    const newSalt = generateSalt();
    const newHashedPassword = await hashPassword(newPassword, newSalt);

    // Update password and change status if needed
    await prisma.$transaction([
        prisma.authProvider.update({
            where: { id: authProvider.id },
            data: {
                providerId: newHashedPassword,
                providerOptions: { salt: newSalt } as PasswordProviderOptions,
            },
        }),
        prisma.user.update({
            where: { id: userId },
            data: {
                status: 'ACTIVE', // Clear PENDING_PASSWORD_RESET if set
            },
        }),
    ]);
}

/**
 * Force reset password (for PENDING_PASSWORD_RESET users)
 */
export async function forceResetPassword(
    userId: string,
    newPassword: string,
): Promise<void> {
    // Find user with password provider
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            authProviders: {
                where: { name: PASSWORD_PROVIDER },
            },
        },
    });

    if (!user || user.authProviders.length === 0) {
        throw new Error('User not found');
    }

    if (user.status !== 'PENDING_PASSWORD_RESET') {
        throw new Error('Password reset not required');
    }

    const authProvider = user.authProviders[0]!;

    // Generate new salt and hash new password
    const newSalt = generateSalt();
    const newHashedPassword = await hashPassword(newPassword, newSalt);

    // Update password and change status
    await prisma.$transaction([
        prisma.authProvider.update({
            where: { id: authProvider.id },
            data: {
                providerId: newHashedPassword,
                providerOptions: { salt: newSalt } as PasswordProviderOptions,
            },
        }),
        prisma.user.update({
            where: { id: userId },
            data: { status: 'ACTIVE' },
        }),
    ]);
}

/**
 * Get all users (admin only)
 */
export async function getUsers(): Promise<UserResponse[]> {
    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
    });
    return users.map(toUserResponse);
}

/**
 * Get a user by ID
 */
export async function getUserById(userId: string): Promise<UserResponse | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });
    return user ? toUserResponse(user) : null;
}
