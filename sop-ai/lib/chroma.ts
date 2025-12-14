import { ChromaClient } from 'chromadb';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const COLLECTION_NAME = 'sop-documents';

// Debug: Print configuration on module load
console.log(`[CONFIG] OLLAMA_URL: ${OLLAMA_URL}`);
console.log(`[CONFIG] CHROMA_URL: ${CHROMA_URL}`);
console.log(`[CONFIG] OLLAMA_URL env var: ${process.env.OLLAMA_URL || 'not set'}`);

let chromaClient: ChromaClient | null = null;

function getChromaClient(): ChromaClient {
  if (!chromaClient) {
    chromaClient = new ChromaClient({ path: CHROMA_URL });
  }
  return chromaClient;
}

async function getEmbeddingViaCLI(text: string): Promise<number[]> {
  const tmpFile = path.join(os.tmpdir(), `ollama-embed-${Date.now()}.json`);
  
  try {
    console.log(`[DEBUG] Using temp file method for embedding (text length: ${text.length})`);
    
    // Write payload to temp file (avoids all shell escaping issues)
    const payload = JSON.stringify({
      model: 'nomic-embed-text:latest',
      prompt: text,
    });
    
    fs.writeFileSync(tmpFile, payload);
    
    const command = `curl -s http://localhost:11434/api/embeddings -d @${tmpFile}`;
    
    console.log(`[DEBUG] curl command: curl -s http://localhost:11434/api/embeddings -d @${tmpFile}`);
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    });

    if (stderr) {
      console.log(`[DEBUG] curl stderr: ${stderr}`);
    }

    const trimmed = stdout.trim();
    if (!trimmed) {
      throw new Error('Empty output from curl');
    }

    const result = JSON.parse(trimmed);
    
    if (result.error) {
      throw new Error(`Ollama API error: ${result.error}`);
    }
    
    if (result.embedding && Array.isArray(result.embedding)) {
      console.log(`[DEBUG] Got embedding via temp file, length: ${result.embedding.length}`);
      return result.embedding;
    }
    
    throw new Error('No embedding in response');
  } catch (error: any) {
    console.error(`[ERROR] Temp file embedding failed: ${error.message}`);
    throw error;
  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}

async function getEmbedding(text: string): Promise<number[]> {
  // Debug: Show exact URL and environment
  console.log(`[DEBUG] FULL URL: ${OLLAMA_URL}/api/embeddings`);
  console.log(`[DEBUG] Env check - process.env.OLLAMA_URL: ${process.env.OLLAMA_URL || 'not set'}`);
  console.log(`[DEBUG] OLLAMA_URL constant: ${OLLAMA_URL}`);
  
  // Try API with both model name variations
  const modelNames = ['nomic-embed-text:latest', 'nomic-embed-text'];
  
  for (const modelName of modelNames) {
    try {
      const url = `${OLLAMA_URL}/api/embeddings`;
      const payload = {
        model: modelName,
        prompt: text,
      };
      
      console.log(`[DEBUG] Attempting API call:`);
      console.log(`[DEBUG]   URL: ${url}`);
      console.log(`[DEBUG]   Model: ${modelName}`);
      console.log(`[DEBUG]   Text length: ${text.length}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`[DEBUG] Fetch timeout triggered for model: ${modelName}`);
        controller.abort();
      }, 30000); // 30 second timeout
      
      console.log(`[DEBUG] Sending fetch request...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`[DEBUG] Fetch completed, status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        if (data.embedding && Array.isArray(data.embedding)) {
          console.log(`[DEBUG] ✅ Got embedding via API (model: ${modelName}), length: ${data.embedding.length}`);
          return data.embedding;
        } else {
          console.log(`[DEBUG] API response missing embedding field, trying next model name`);
        }
      } else {
        const errorText = await response.text();
        console.log(`[DEBUG] API response not OK (${response.status}): ${errorText.substring(0, 200)}`);
        // If 404, try next model name; otherwise break
        if (response.status !== 404) {
          break;
        }
      }
    } catch (error: any) {
      // API failed, try next model name or fall back to CLI
      if (error.name === 'AbortError') {
        console.log(`[DEBUG] Embedding API timed out (model: ${modelName}), trying next...`);
      } else {
        console.log(`[DEBUG] Embedding API failed (model: ${modelName}): ${error.message}`);
      }
      // If this was the last model name, break to fall back to CLI
      if (modelName === modelNames[modelNames.length - 1]) {
        break;
      }
    }
  }

  // Fallback to CLI method
  console.log('[DEBUG] All API attempts failed, using CLI method');
  return getEmbeddingViaCLI(text);
}

async function getLLMResponse(prompt: string): Promise<string> {
  try {
    console.log(`[DEBUG] Calling LLM with prompt length: ${prompt.length}`);
    
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral:7b',
        prompt,
        stream: false,
      }),
    });

    console.log(`[DEBUG] LLM response status: ${response.status}`);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[ERROR] LLM API error: ${response.status} - ${errorBody}`);
      
      // Fallback to curl method
      console.log(`[DEBUG] Trying curl fallback for LLM...`);
      return await getLLMResponseViaCurl(prompt);
    }

    const data = await response.json();
    console.log(`[DEBUG] LLM response received, length: ${data.response?.length || 0}`);
    return data.response || '';
  } catch (error: any) {
    console.error('[ERROR] getLLMResponse failed:', error.message);
    // Try curl fallback
    console.log(`[DEBUG] Trying curl fallback for LLM after error...`);
    return await getLLMResponseViaCurl(prompt);
  }
}

async function getLLMResponseViaCurl(prompt: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `ollama-llm-${Date.now()}.json`);
  
  try {
    const payload = JSON.stringify({
      model: 'mistral:7b',
      prompt,
      stream: false,
    });
    
    fs.writeFileSync(tmpFile, payload);
    
    const command = `curl -s http://localhost:11434/api/generate -d @${tmpFile}`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large responses
      timeout: 120000, // 2 minute timeout for LLM
    });

    if (stderr) {
      console.log(`[DEBUG] LLM curl stderr: ${stderr}`);
    }

    const result = JSON.parse(stdout.trim());
    
    if (result.error) {
      throw new Error(`Ollama LLM error: ${result.error}`);
    }
    
    console.log(`[DEBUG] LLM curl response received, length: ${result.response?.length || 0}`);
    return result.response || '';
  } catch (error: any) {
    console.error(`[ERROR] LLM curl failed: ${error.message}`);
    throw error;
  } finally {
    try {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    } catch {}
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
    const avgDistance = distances.length > 0 
      ? distances.filter((d): d is number => d != null).reduce((a, b) => a + b, 0) / distances.length
      : 1;
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
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(entries.length / batchSize);
      console.log(`[DEBUG] Starting batch ${batchNum}/${totalBatches} (entries ${i + 1}-${Math.min(i + batchSize, entries.length)})`);

      const batchPromises = batch.map(async (entry, idx) => {
        const globalIdx = i + idx;
        try {
          console.log(`[DEBUG] Processing entry ${globalIdx + 1}/${entries.length}: ${(entry.title || 'Untitled').substring(0, 50)}`);
          const embedding = await getEmbedding(entry.content);
          console.log(`[DEBUG] Completed entry ${globalIdx + 1}, embedding length: ${embedding.length}`);
          
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
        } catch (error: any) {
          console.error(`[ERROR] Failed to process entry ${globalIdx + 1}:`, error.message);
          throw error;
        }
      });

      console.log(`[DEBUG] Waiting for batch ${batchNum} to complete...`);
      const batchResults = await Promise.all(batchPromises);
      console.log(`[DEBUG] Batch ${batchNum} completed, got ${batchResults.length} results`);

      batchResults.forEach((result) => {
        allIds.push(result.id);
        allEmbeddings.push(result.embedding);
        allDocuments.push(result.document);
        allMetadatas.push(result.metadata);
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log(`[DEBUG] Batch ${batchNum} processed, moving to next batch`);
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
