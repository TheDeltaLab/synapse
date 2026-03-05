import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@synapse/dal/prisma/client';

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };