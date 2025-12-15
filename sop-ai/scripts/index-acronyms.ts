/**
 * Script to index acronyms from CSV into ChromaDB
 * Run with: npm run index-acronyms or npx tsx scripts/index-acronyms.ts
 */

import { indexAcronyms } from '../lib/chroma';

async function main() {
  console.log('='.repeat(50));
  console.log('ACRONYM INDEXING');
  console.log('='.repeat(50));
  
  try {
    const count = await indexAcronyms();
    console.log('\n' + '='.repeat(50));
    console.log(`SUCCESS: Indexed ${count} acronyms`);
    console.log('='.repeat(50));
    process.exit(0);
  } catch (error: any) {
    console.error('\n' + '='.repeat(50));
    console.error('FAILED:', error.message);
    console.error('='.repeat(50));
    process.exit(1);
  }
}

main();
