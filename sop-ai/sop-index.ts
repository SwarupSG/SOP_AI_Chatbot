// SOP Indexing Script
// Ingests SOP documents from Excel and Word files into ChromaDB

import { rebuildIndex } from './lib/chroma';

async function indexSOPs() {
  const sopFilePath = process.argv[2];
  
  console.log('Starting SOP indexing...');
  console.log('This will:');
  console.log('1. Parse Excel SOP files and Word documents (.docx)');
  console.log('2. Process files from template_sample folder');
  console.log('3. Generate embeddings using Ollama (nomic-embed-text)');
  console.log('4. Store in ChromaDB for RAG queries');
  console.log('');

  try {
    await rebuildIndex(sopFilePath);
    console.log('\n✅ Indexing complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Indexing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  indexSOPs();
}

export { indexSOPs };
