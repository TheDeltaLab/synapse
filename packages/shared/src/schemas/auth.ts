import { z } from 'zod';

// Password validation: min 8 chars, 1 uppercase, 1 lowercase, 1 number
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

export const emailSchema = z.string().email('Invalid email address');

export const userRoleSchema = z.enum(['ADMIN', 'STAFF']);

export const userStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'PENDING_PASSWORD_RESET']);

// Login request
export const loginRequestSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});

// Register request (first admin)
export const registerRequestSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
});

// Create staff account request (admin only)
export const createStaffRequestSchema = z.object({
    email: emailSchema,
    name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
});

// Reset password request
export const resetPasswordRequestSchema = z.object({
    currentPassword: z.string().optional(), // Optional for forced reset
    newPassword: passwordSchema,
});

// User response (safe to return to client)
export const userResponseSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    role: userRoleSchema,
    status: userStatusSchema,
    createdAt: z.string().datetime(),
    lastLoginAt: z.string().datetime().nullable(),
});

// User list response
export const userListResponseSchema = z.object({
    users: z.array(userResponseSchema),
});

// Auth response (includes token for client-side storage if needed)
export const authResponseSchema = z.object({
    user: userResponseSchema,
    message: z.string().optional(),
});

// Registration status response
export const registrationStatusResponseSchema = z.object({
    isOpen: z.boolean(),
});

// Staff created response (includes temporary password)
export const staffCreatedResponseSchema = z.object({
    user: userResponseSchema,
    temporaryPassword: z.string(),
});

// Types
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type CreateStaffRequest = z.infer<typeof createStaffRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type UserListResponse = z.infer<typeof userListResponseSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RegistrationStatusResponse = z.infer<typeof registrationStatusResponseSchema>;
export type StaffCreatedResponse = z.infer<typeof staffCreatedResponseSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
