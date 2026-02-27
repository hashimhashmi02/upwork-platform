import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma v7 requires a driver adapter for all databases
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
