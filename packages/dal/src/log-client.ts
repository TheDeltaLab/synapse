import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@synapse/dal/prisma/client';

// Dedicated PrismaClient for write-heavy log persistence.
// Separate connection pool keeps batched log writes from competing
// with admin/auth queries that share the main `prisma` client.
const connectionString = `${process.env.DATABASE_URL}`;
const max = parseInt(process.env.LOG_DB_POOL_SIZE || '5', 10);

const adapter = new PrismaPg({ connectionString, max });
const prismaLog = new PrismaClient({ adapter });

export { prismaLog };
