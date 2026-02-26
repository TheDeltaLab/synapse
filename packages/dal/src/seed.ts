import prisma from './client.js';
import * as bcrypt from 'bcrypt';

async function seed() {
    console.log('🌱 Seeding database...');

    // Create a test API key
    const testKeyPlain = 'test_key_' + Math.random().toString(36).substring(2, 15);
    const testKeyHash = await bcrypt.hash(testKeyPlain, 10);

    const apiKey = await prisma.apiKey.create({
        data: {
            key: testKeyHash,
            name: 'Test API Key',
            rateLimit: 100,
            enabled: true,
        },
    });

    console.log('✅ Created test API key:');
    console.log(`   ID: ${apiKey.id}`);
    console.log(`   Name: ${apiKey.name}`);
    console.log(`   Plain key (save this!): ${testKeyPlain}`);
    console.log(`   Rate limit: ${apiKey.rateLimit} req/hour`);

    console.log('✅ Database seeded successfully!');
}

seed()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
