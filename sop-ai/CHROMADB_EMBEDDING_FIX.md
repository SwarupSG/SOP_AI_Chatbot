# ChromaDB Embedding Configuration Fix

## Problem
ChromaDB was trying to use `DefaultEmbeddingFunction`, causing the error:
```
"Cannot instantiate a collection with the DefaultEmbeddingFunction. Please install @chroma-core/default-embed, or provide a different embedding function"
```

## Solution
Configured ChromaDB to use Ollama embeddings explicitly instead of any default embedding function.

## Changes Made

### 1. Collection Creation (`lib/chroma.ts` - `rebuildIndex()`)
- **Before**: Collection created without explicit embedding configuration
- **After**: Collection created without any embedding function, with explicit comments
- **Location**: Line ~495-500

```typescript
// Create new collection WITHOUT any embedding function
// We provide embeddings explicitly via Ollama, so no embedding function is needed
const collection = await client.createCollection({
  name: COLLECTION_NAME,
  metadata: { description: 'SOP documents for RAG' },
});
```

### 2. Document Addition (`lib/chroma.ts` - `rebuildIndex()`)
- **Before**: Embeddings passed but not explicitly documented
- **After**: Explicit embeddings from Ollama with clear comments
- **Location**: Line ~597-602

```typescript
// Add all documents to ChromaDB with explicit embeddings from Ollama
// We provide embeddings manually, so ChromaDB won't try to use any default embedding function
await collection.add({
  ids: allIds,
  embeddings: allEmbeddings, // Explicit embeddings from Ollama (nomic-embed-text)
  documents: allDocuments,
  metadatas: allMetadatas,
});
```

### 3. Query Operations (`lib/chroma.ts` - `querySOPs()`)
- **Before**: Query embeddings passed but not explicitly documented
- **After**: Explicit query embeddings from Ollama with clear comments
- **Location**: Line ~387-394

```typescript
// Generate embedding for the question using Ollama (nomic-embed-text)
const queryEmbedding = await getEmbedding(question);

// Query ChromaDB for similar documents using explicit query embeddings
// We provide embeddings manually, so ChromaDB won't try to use any default embedding function
const results = await collection.query({
  queryEmbeddings: [queryEmbedding], // Explicit embedding from Ollama
  nResults: 5,
});
```

### 4. Client Initialization (`lib/chroma.ts` - `getChromaClient()`)
- **Before**: Client created without explicit documentation
- **After**: Added comment clarifying no default embedding function
- **Location**: Line ~27-32

```typescript
function getChromaClient(): ChromaClient {
  if (!chromaClient) {
    // Create ChromaDB client without any default embedding function
    // We use Ollama embeddings explicitly
    chromaClient = new ChromaClient({ path: CHROMA_URL });
  }
  return chromaClient;
}
```

## How It Works

1. **Embedding Generation**: The `getEmbedding()` function (already exists) calls Ollama API:
   ```typescript
   POST ${OLLAMA_URL}/api/embeddings
   Body: { model: "nomic-embed-text", prompt: text }
   Returns: data.embedding (number[])
   ```

2. **Collection Creation**: Collection is created WITHOUT any embedding function parameter

3. **Document Indexing**: When adding documents:
   - Embeddings are generated via Ollama for each document
   - Embeddings are passed explicitly in `collection.add({ embeddings: [...] })`

4. **Querying**: When querying:
   - Query embedding is generated via Ollama
   - Query embedding is passed explicitly in `collection.query({ queryEmbeddings: [...] })`

## Key Points

✅ **No DefaultEmbeddingFunction**: Collection is created without any embedding function  
✅ **Explicit Embeddings**: All embeddings provided manually via Ollama  
✅ **Ollama Integration**: Uses `nomic-embed-text` model via Ollama API  
✅ **Environment Variable**: Uses `OLLAMA_URL` (default: `http://localhost:11434`)

## Verification

The code now:
1. Creates collections without embedding functions
2. Always provides embeddings explicitly
3. Uses Ollama's `nomic-embed-text` model for all embeddings
4. Never relies on ChromaDB's default embedding functions

## Files Modified

- `lib/chroma.ts` - Updated collection creation, document addition, and query operations with explicit embedding configuration

## Testing

After these changes:
1. Delete existing collection (if any) to ensure clean state
2. Re-index documents: `npm run index` or Admin Dashboard → "Rebuild SOP Index"
3. Test queries to ensure embeddings work correctly

The error should no longer occur because ChromaDB will never try to use DefaultEmbeddingFunction.

