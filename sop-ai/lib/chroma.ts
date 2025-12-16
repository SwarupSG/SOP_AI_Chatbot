import { ChromaClient } from 'chromadb';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db, indexedSOPs } from './db';
import { eq } from 'drizzle-orm';
import { LLM_OPTIONS, buildPrompt } from './promptConstants';
import { buildRAGContext, formatAcronymContext } from './contextBuilder';

const execAsync = promisify(exec);

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const COLLECTION_NAME = 'sop-documents';

// Path resolution helpers
// Find SOP Excel file
function findSOPExcelFile(): string | null {
  const filename = 'S4_-_SOPs_-_MF_Transactions.xlsx';
  const locations = [
    path.join(process.cwd(), 'data', filename),
    path.join(process.cwd(), filename),
    path.join(process.cwd(), '..', filename),
  ];

  for (const loc of locations) {
    try {
      if (fs.existsSync(loc)) {
        console.log('[INDEX] Found Excel at:', loc);
        return loc;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// Find template_sample directory
function findTemplateDir(): string | null {
  const locations = [
    path.join(process.cwd(), 'data', 'template_sample'),
    path.join(process.cwd(), 'data'),
    path.join(process.cwd(), 'template_sample'),
    path.join(process.cwd(), '..', 'template_sample'),
  ];

  for (const loc of locations) {
    try {
      if (fs.existsSync(loc) && fs.statSync(loc).isDirectory()) {
        console.log('[INDEX] Found template dir at:', loc);
        return loc;
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// Debug: Print configuration on module load
console.log(`[CONFIG] OLLAMA_URL: ${OLLAMA_URL}`);
console.log(`[CONFIG] CHROMA_URL: ${CHROMA_URL}`);
console.log(`[CONFIG] OLLAMA_URL env var: ${process.env.OLLAMA_URL || 'not set'}`);

let chromaClient: ChromaClient | null = null;

export function getChromaClient(): ChromaClient {
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

export async function getEmbedding(text: string): Promise<number[]> {
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

export async function getLLMResponse(prompt: string): Promise<string> {
  try {
    console.log(`[DEBUG] Calling LLM with prompt length: ${prompt.length}`);

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'qwen2.5:3b',
        prompt,
        stream: false,
        options: LLM_OPTIONS,
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
      model: process.env.LLM_MODEL || 'qwen2.5:3b',
      prompt,
      stream: false,
      options: LLM_OPTIONS,
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
    } catch { }
  }
}

export async function querySOPs(question: string, filterSopId?: string): Promise<{ answer: string; confidence: number; sources: string[] }> {
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
    const queryParams: any = {
      queryEmbeddings: [queryEmbedding],
      nResults: 5,
    };

    // Apply filter if provided
    if (filterSopId) {
      queryParams.where = { sopId: filterSopId };
      console.log(`[RAG] Scoped query for SOP ID: ${filterSopId}`);
    }

    const results = await collection.query(queryParams);

    if (!results.documents || results.documents[0].length === 0) {
      return {
        answer: "No relevant SOPs found for this question.",
        confidence: 0.0,
        sources: [],
      };
    }

    // Extract relevant SOP content
    const relevantDocs = (results.documents[0] || []).filter((doc): doc is string => doc !== null);
    const distances = results.distances?.[0] || [];
    const metadatas = results.metadatas?.[0] || [];

    // Calculate confidence based on similarity
    // Using exponential decay to map unbounded distance to 0-1 range
    // avgDistance 0 -> Confidence 1.0 (Exact match)
    // avgDistance 0.5 -> Confidence ~0.60
    // avgDistance 1.0 -> Confidence ~0.37
    const avgDistance = distances.length > 0
      ? distances.filter((d): d is number => d != null).reduce((a, b) => a + b, 0) / distances.length
      : 1;

    const confidence = Math.exp(-avgDistance);

    // Build context from relevant SOPs
    const context = relevantDocs
      .map((doc, i) => {
        const metadata = metadatas[i] || {};
        const title = metadata.title || 'SOP Entry';
        return `[${title}]\n${doc}`;
      })
      .join('\n\n---\n\n');

    // Build RAG context with acronyms using the ALREADY retrieved documents
    // This avoids a second redundant vector search
    const ragContext = await buildRAGContext(question, relevantDocs);
    const acronymContext = formatAcronymContext(ragContext.relevantAcronyms);

    // Build optimized prompt with Qwen tokens and grounding instructions
    const prompt = buildPrompt(acronymContext || '', context, question);

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
    // Note: TypeScript might complain about import type mismatch if not reloaded, but runtime is fine.
    // The parser now returns SOPDocument[]
    const allDocs: any[] = [];

    // Process Excel file if provided, otherwise use default
    if (sopFilePath) {
      console.log(`Processing file: ${sopFilePath}`);
      const fileDocs = await parseSOPFile(sopFilePath);
      allDocs.push(...fileDocs);
    } else {
      // Process default Excel file
      const defaultExcelPath = findSOPExcelFile();
      if (!defaultExcelPath) {
        throw new Error('SOP Excel file not found. Please place S4_-_SOPs_-_MF_Transactions.xlsx in the data/ directory.');
      }
      console.log(`Processing default Excel file: ${defaultExcelPath}`);
      const fileDocs = await parseSOPFile(defaultExcelPath);
      allDocs.push(...fileDocs);
    }

    // Process Word documents from template_sample folder
    const templateSamplePath = findTemplateDir();
    if (templateSamplePath) {
      console.log(`Processing Word documents from: ${templateSamplePath}`);
      const dirDocs = await parseSOPDirectory(templateSamplePath);
      allDocs.push(...dirDocs);
    } else {
      console.warn('Template sample folder not found in any location');
    }

    console.log(`Parsed ${allDocs.length} total SOP documents.`);

    // --- NEW: Save Structured Data for Knowledge Base UI ---
    console.log('[INDEX] Saving structured SOP data to sop_data/sop-entries.json...');
    const dataDir = path.join(process.cwd(), 'sop_data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(path.join(dataDir, 'sop-entries.json'), JSON.stringify(allDocs, null, 2));
    // --------------------------------------------------------

    console.log('Generating embeddings for vector search...');

    // Process entries in batches to avoid overwhelming Ollama
    const batchSize = 10;
    const allIds: string[] = [];
    const allEmbeddings: number[][] = [];
    const allContentStrings: string[] = [];
    const allMetadatas: any[] = [];

    for (let i = 0; i < allDocs.length; i += batchSize) {
      const batch = allDocs.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(allDocs.length / batchSize);
      console.log(`[DEBUG] Starting batch ${batchNum}/${totalBatches}`);

      const batchPromises = batch.map(async (doc, idx) => {
        const globalIdx = i + idx;
        try {
          console.log(`[DEBUG] Processing doc ${globalIdx + 1}: ${doc.title}`);
          const embedding = await getEmbedding(doc.content);
          if (!embedding || embedding.length === 0) {
            throw new Error('Empty embedding returned');
          }
          console.log(`[DEBUG] Completed entry ${globalIdx + 1}, embedding length: ${embedding.length}`);

          return {
            id: doc.id || `sop-${globalIdx}`, // Use semantic ID if available
            embedding,
            document: doc.content,
            metadata: {
              title: doc.title || `SOP Entry ${globalIdx + 1}`,
              category: doc.category || 'General',
              sourceFile: doc.sourceFile || 'Unknown',
              sopId: doc.id // Link back to structured JSON
            },
          };
        } catch (error: any) {
          console.error(`[ERROR] Failed to process doc ${globalIdx + 1}:`, error.message);
          return null; // Return null to filter out later
        }
      });

      console.log(`[DEBUG] Waiting for batch ${batchNum}...`);
      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach((result) => {
        if (result) {
          allIds.push(result.id);
          allEmbeddings.push(result.embedding);
          allContentStrings.push(result.document);
          allMetadatas.push(result.metadata);
        }
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Add all documents to ChromaDB
    await collection.add({
      ids: allIds,
      embeddings: allEmbeddings,
      documents: allContentStrings,
      metadatas: allMetadatas,
    });

    console.log(`Successfully indexed ${allIds.length} SOPs into ChromaDB`);

    // Track indexed SOPs in database
    // Group entries by source file and category
    const sopGroups = new Map<string, { category: string; count: number }>();

    allDocs.forEach((doc) => {
      const source = doc.sourceFile || 'Unknown';
      const category = doc.category || 'General';
      const key = `${source}::${category}`;

      if (!sopGroups.has(key)) {
        sopGroups.set(key, { category, count: 0 });
      }
      sopGroups.get(key)!.count++;
    });

    // Clear existing indexed SOPs
    await db.delete(indexedSOPs);

    // Insert new indexed SOPs
    for (const [key, data] of sopGroups.entries()) {
      const [sourceFile] = key.split('::');
      await db.insert(indexedSOPs).values({
        sourceFile,
        category: data.category,
        entryCount: data.count,
        lastIndexed: new Date(),
      });
    }

    console.log(`Tracked ${sopGroups.size} SOP sources in database`);
  } catch (error) {
    console.error('Error rebuilding index:', error);
    throw error;
  }
}

export async function indexAcronyms(): Promise<number> {
  try {
    const { loadAcronyms } = await import('./acronyms');

    console.log('[INDEX] Loading acronyms from CSV...');
    const acronyms = loadAcronyms();

    if (acronyms.length === 0) {
      throw new Error('No acronyms found in CSV');
    }

    console.log(`[INDEX] Found ${acronyms.length} acronyms`);

    const client = getChromaClient();
    const ACRONYM_COLLECTION_NAME = 'sop_acronyms';

    // Delete existing collection if it exists (to avoid embedding function mismatch)
    const collections = await client.listCollections();
    const existingCollection = collections.find(c => c.name === ACRONYM_COLLECTION_NAME);

    if (existingCollection) {
      console.log(`[INDEX] Deleting existing collection "${ACRONYM_COLLECTION_NAME}" to recreate without embedding function...`);
      try {
        await client.deleteCollection({ name: ACRONYM_COLLECTION_NAME });
      } catch (e) {
        console.warn(`[INDEX] Error deleting collection: ${e}`);
      }
    }

    // Create new collection without embedding function (we provide embeddings manually)
    console.log(`[INDEX] Creating collection "${ACRONYM_COLLECTION_NAME}"...`);
    const collection = await client.createCollection({
      name: ACRONYM_COLLECTION_NAME,
      metadata: { description: 'Financial acronyms for RAG' },
    });

    console.log('[INDEX] Generating embeddings and preparing documents...');

    const ids: string[] = [];
    const embeddings: number[][] = [];
    const documents: string[] = [];
    const metadatas: Record<string, string | number | boolean>[] = [];

    for (let i = 0; i < acronyms.length; i++) {
      const acronym = acronyms[i];
      const document = `${acronym.abbreviation} stands for ${acronym.fullForm}. ${acronym.abbreviation} means ${acronym.fullForm}. Category: ${acronym.category}`;

      console.log(`[INDEX] Processing ${i + 1}/${acronyms.length}: ${acronym.abbreviation}`);

      const embedding = await getEmbedding(document);

      ids.push(`acronym_${i}`);
      embeddings.push(embedding);
      documents.push(document);
      metadatas.push({
        abbreviation: acronym.abbreviation,
        fullForm: acronym.fullForm,
        category: acronym.category,
        type: 'acronym',
      });
    }

    console.log('[INDEX] Upserting to ChromaDB...');
    await collection.upsert({
      ids,
      embeddings,
      documents,
      metadatas,
    });

    console.log(`[INDEX] Successfully indexed ${acronyms.length} acronyms into ChromaDB`);
    return acronyms.length;
  } catch (error: any) {
    console.error('[INDEX] Error indexing acronyms:', error.message);
    throw error;
  }
}

export async function getAcronymStats(): Promise<{ total: number; byCategory: Record<string, number>; lastIndexed: string | null }> {
  try {
    const client = getChromaClient();
    const ACRONYM_COLLECTION_NAME = 'sop_acronyms';

    const collections = await client.listCollections();
    const collectionExists = collections.some(c => c.name === ACRONYM_COLLECTION_NAME);

    if (!collectionExists) {
      return { total: 0, byCategory: {}, lastIndexed: null };
    }

    const collection = await client.getCollection({ name: ACRONYM_COLLECTION_NAME });
    const count = await collection.count();

    const results = await collection.get({ limit: count });
    const metadatas = results.metadatas || [];

    const byCategory: Record<string, number> = {};
    metadatas.forEach((meta: any) => {
      const category = meta?.category || 'Uncategorized';
      byCategory[category] = (byCategory[category] || 0) + 1;
    });

    return {
      total: count,
      byCategory,
      lastIndexed: null, // ChromaDB doesn't store timestamps, would need separate tracking
    };
  } catch (error: any) {
    console.error('[STATS] Error getting acronym stats:', error.message);
    throw error;
  }
}

export interface AcronymResult {
  abbreviation: string;
  fullForm: string;
  category: string;
  score: number;
}

export async function queryAcronyms(query: string, nResults: number = 5): Promise<AcronymResult[]> {
  try {
    const client = getChromaClient();
    const ACRONYM_COLLECTION_NAME = 'sop_acronyms';

    const collections = await client.listCollections();
    const collectionExists = collections.some(c => c.name === ACRONYM_COLLECTION_NAME);

    if (!collectionExists) {
      console.log('[ACRONYMS] Collection does not exist');
      return [];
    }

    const collection = await client.getCollection({ name: ACRONYM_COLLECTION_NAME });
    const queryEmbedding = await getEmbedding(query);

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
    });

    if (!results.metadatas || results.metadatas[0].length === 0) {
      return [];
    }

    return results.metadatas[0].map((meta: any) => ({
      abbreviation: String(meta.abbreviation || ''),
      fullForm: String(meta.fullForm || ''),
      category: String(meta.category || ''),
      score: 1.0,
    }));
  } catch (error: any) {
    console.error('[ACRONYMS] Query error:', error.message);
    return [];
  }
}

export function expandQuery(query: string): string[] {
  return [query];
}

export function mergeQueryResults(results: any[], limit: number): { documents: string[]; metadatas: any[]; distances: number[] } {
  if (results.length === 0) {
    return { documents: [], metadatas: [], distances: [] };
  }
  const first = results[0];
  return {
    documents: first.documents?.[0]?.slice(0, limit) || [],
    metadatas: first.metadatas?.[0]?.slice(0, limit) || [],
    distances: first.distances?.[0]?.slice(0, limit) || [],
  };
}

export function rerankResults(query: string, results: any[]): any[] {
  return results;
}
