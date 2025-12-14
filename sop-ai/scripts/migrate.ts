// Migration script to ensure all tables exist
import { initDatabase } from '../lib/init-db';

async function migrate() {
  try {
    console.log('Running database migration...');
    await initDatabase();
    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();

