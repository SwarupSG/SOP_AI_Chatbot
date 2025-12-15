import { ChromaClient } from 'chromadb';

async function resetCollections() {
  const client = new ChromaClient({ path: 'http://localhost:8000' });
  
  const collectionsToDelete = ['sop-documents', 'sop_acronyms'];
  
  for (const name of collectionsToDelete) {
    try {
      await client.deleteCollection({ name });
      console.log(`✓ Deleted collection: ${name}`);
    } catch (e: any) {
      console.log(`⚠ Collection ${name} doesn't exist or already deleted: ${e.message}`);
    }
  }
  
  console.log('\n✅ Done! Now run:');
  console.log('  npm run index');
  console.log('  npm run index-acronyms');
}

resetCollections().catch(error => {
  console.error('Error resetting collections:', error);
  process.exit(1);
});

