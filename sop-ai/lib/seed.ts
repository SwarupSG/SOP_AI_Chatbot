import { db, users } from './db';
import { hashPassword } from './auth';
import { initDatabase } from './init-db';

export async function seedDatabase() {
  // Initialize database tables first
  await initDatabase();

  // Check if users already exist
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log('Database already seeded');
    return;
  }

  // Seed 1 admin
  const adminPassword = await hashPassword('admin123');
  await db.insert(users).values({
    email: 'admin@sop-ai.local',
    password: adminPassword,
    name: 'Admin User',
    role: 'admin',
  });

  // Seed 6 regular users
  const userEmails = [
    'alice@sop-ai.local',
    'bob@sop-ai.local',
    'charlie@sop-ai.local',
    'diana@sop-ai.local',
    'eve@sop-ai.local',
    'frank@sop-ai.local',
  ];

  const userNames = [
    'Alice',
    'Bob',
    'Charlie',
    'Diana',
    'Eve',
    'Frank',
  ];

  for (let i = 0; i < userEmails.length; i++) {
    const password = await hashPassword('user123');
    await db.insert(users).values({
      email: userEmails[i],
      password,
      name: userNames[i],
      role: 'user',
    });
  }

  console.log('Database seeded successfully');
}

