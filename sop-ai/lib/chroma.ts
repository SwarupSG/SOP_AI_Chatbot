import { ChromaClient } from 'chromadb';
import * as fs from 'fs';

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const COLLECTION_NAME = 'sop-documents';

let chromaClient: ChromaClient | null = null;

function getChromaClient(): ChromaClient {
  if (!chromaClient) {
    chromaClient = new ChromaClient({ path: CHROMA_URL });
  }
  return chromaClient;
}

async function getEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

async function getLLMResponse(prompt: string): Promise<string> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral:7b',
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama generate API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  } catch (error) {
    console.error('Error generating LLM response:', error);
    throw error;
  }
}

export async function querySOPs(question: string): Promise<{ answer: string; confidence: number; sources: string[] }> {
  try {
    const client = getChromaClient();
    
    // Check if collection exists
    const collections = await client.listCollections();
    const collectionExists = collections.some(c => c.name === COLLECTION_NAME);
    
    if (!collectionExists) {
      return {
        answer: "SOP index is empty. Please rebuild the index from the admin dashboard.",
        confidence: 0.0,
        sources: [],
      };
    }

    const collection = await client.getCollection({ name: COLLECTION_NAME });

    // Generate embedding for the question
    const queryEmbedding = await getEmbedding(question);

    // Query ChromaDB for similar documents
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 5, // Get top 5 most relevant SOPs
    });

    if (!results.documents || results.documents[0].length === 0) {
      return {
        answer: "No relevant SOPs found for this question.",
        confidence: 0.0,
        sources: [],
      };
    }

    // Extract relevant SOP content
    const relevantDocs = results.documents[0];
    const distances = results.distances?.[0] || [];
    const metadatas = results.metadatas?.[0] || [];

    // Calculate confidence based on similarity (lower distance = higher confidence)
    // Convert distance to confidence (assuming cosine distance, 0 = identical, 1 = orthogonal)
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const confidence = Math.max(0, Math.min(1, 1 - avgDistance));

    // Build context from relevant SOPs
    const context = relevantDocs
      .map((doc, i) => {
        const metadata = metadatas[i] || {};
        const title = metadata.title || 'SOP Entry';
        return `[${title}]\n${doc}`;
      })
      .join('\n\n---\n\n');

    // Generate answer using LLM with context
    const prompt = `You are a helpful assistant that answers questions about Standard Operating Procedures (SOPs).

Context from SOP documents:
${context}

Question: ${question}

Provide a clear, concise answer based on the SOP context above. If the context doesn't contain enough information, say so.`;

    const answer = await getLLMResponse(prompt);

    // Extract sources (titles from metadata)
    const sources = metadatas
      .map((m: any) => m.title)
      .filter((t: string) => t)
      .slice(0, 3); // Limit to top 3 sources

    return {
      answer,
      confidence,
      sources,
    };
  } catch (error) {
    console.error('Error querying SOPs:', error);
    
    // Fallback if services aren't running
    if (error instanceof Error && error.message.includes('fetch')) {
      return {
        answer: "Unable to connect to Ollama or ChromaDB. Please ensure Docker services are running (docker-compose up -d) and models are pulled.",
        confidence: 0.0,
        sources: [],
      };
    }

    return {
      answer: "An error occurred while querying SOPs. Please try again.",
      confidence: 0.0,
      sources: [],
    };
  }
}

export async function rebuildIndex(sopFilePath?: string): Promise<void> {
  try {
    const client = getChromaClient();

    // Delete existing collection if it exists
    try {
      const collections = await client.listCollections();
      const existingCollection = collections.find(c => c.name === COLLECTION_NAME);
      if (existingCollection) {
        await client.deleteCollection({ name: COLLECTION_NAME });
        console.log('Deleted existing collection');
      }
    } catch (error) {
      // Collection might not exist, that's okay
    }

    // Create new collection
    const collection = await client.createCollection({
      name: COLLECTION_NAME,
      metadata: { description: 'SOP documents for RAG' },
    });

    console.log('Created new ChromaDB collection');

    // Parse SOP files - both Excel and Word documents
    const { parseSOPFile, parseSOPDirectory } = await import('../scripts/parse-sop');
    const allEntries: any[] = [];

    // Process Excel file if provided, otherwise use default
    if (sopFilePath) {
      console.log(`Processing file: ${sopFilePath}`);
      const fileEntries = await parseSOPFile(sopFilePath);
      allEntries.push(...fileEntries);
    } else {
      // Process default Excel file
      const defaultExcelPath = '/Users/Swarup/Documents/SOP_AI_Chatbot/S4_-_SOPs_-_MF_Transactions.xlsx';
      if (fs.existsSync(defaultExcelPath)) {
        console.log(`Processing default Excel file: ${defaultExcelPath}`);
        const fileEntries = await parseSOPFile(defaultExcelPath);
        allEntries.push(...fileEntries);
      }
    }

    // Process Word documents from template_sample folder
    const templateSamplePath = '/Users/Swarup/Documents/SOP_AI_Chatbot/template_sample';
    if (fs.existsSync(templateSamplePath)) {
      console.log(`Processing Word documents from: ${templateSamplePath}`);
      const dirEntries = await parseSOPDirectory(templateSamplePath);
      allEntries.push(...dirEntries);
    }

    const entries = allEntries;
    console.log(`Parsed ${entries.length} total SOP entries, generating embeddings...`);

    // Process entries in batches to avoid overwhelming Ollama
    const batchSize = 10;
    const allIds: string[] = [];
    const allEmbeddings: number[][] = [];
    const allDocuments: string[] = [];
    const allMetadatas: any[] = [];

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entries.length / batchSize)}`);

      const batchPromises = batch.map(async (entry, idx) => {
        const globalIdx = i + idx;
        const embedding = await getEmbedding(entry.content);
        
        return {
          id: `sop-${globalIdx}`,
          embedding,
          document: entry.content,
          metadata: {
            title: entry.title || `SOP Entry ${globalIdx + 1}`,
            category: entry.category || 'General',
            section: entry.section || '',
          },
        };
      });

      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach((result) => {
        allIds.push(result.id);
        allEmbeddings.push(result.embedding);
        allDocuments.push(result.document);
        allMetadatas.push(result.metadata);
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Add all documents to ChromaDB
    await collection.add({
      ids: allIds,
      embeddings: allEmbeddings,
      documents: allDocuments,
      metadatas: allMetadatas,
    });

    console.log(`Successfully indexed ${entries.length} SOP entries into ChromaDB`);
  } catch (error) {
    console.error('Error rebuilding index:', error);
    throw error;
  }
}
