import type { Context } from 'hono';
import { HTTP_STATUS } from '@synapse/shared';

export async function errorHandler(err: Error, c: Context) {
    console.error('Error:', err);

    if (err.message.includes('not found') || err.message.includes('not configured')) {
        return c.json({
            error: 'Bad Request',
            message: err.message,
        }, HTTP_STATUS.BAD_REQUEST);
    }

    return c.json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
}
