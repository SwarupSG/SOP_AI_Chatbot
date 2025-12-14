import { ChromaClient } from 'chromadb';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db, indexedSOPs } from './db';
import { eq } from 'drizzle-orm';

const execAsync = promisify(exec);

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const COLLECTION_NAME = 'sop-documents';

// Confidence calculation weights (adjustable via environment variables)
const RETRIEVAL_WEIGHT = parseFloat(process.env.RETRIEVAL_WEIGHT || '0.6'); // 60% by default
const LLM_WEIGHT = parseFloat(process.env.LLM_WEIGHT || '0.4'); // 40% by default

// Domain-specific synonym dictionary for query expansion
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  // Acronyms
  'MFU': ['Mutual Fund Unit', 'MF Unit', 'mutual fund unit', 'MFU portal'],
  'CAN': ['Consolidated Account Number', 'CAN number', 'consolidated account'],
  'SOP': ['Standard Operating Procedure', 'procedure', 'process'],
  'SIP': ['Systematic Investment Plan', 'SIP order', 'systematic investment'],
  'FOT': ['First Order Today', 'FOT order'],
  'NCT': ['NCT form', 'NCT mandate'],
  'MICR': ['MICR code', 'bank MICR'],
  
  // Action synonyms
  'check': ['verify', 'view', 'see', 'find', 'look up', 'lookup', 'track'],
  'status': ['registration status', 'current status', 'state', 'progress'],
  'reset': ['change', 'update', 'modify', 'edit'],
  'create': ['add', 'new', 'make', 'set up', 'setup', 'register'],
  'delete': ['remove', 'cancel', 'deactivate'],
  'change': ['modify', 'update', 'edit', 'addition', 'deletion'],
  'process': ['handle', 'execute', 'complete', 'submit'],
  
  // System/UI terms
  'tracker': ['CAN tracker', 'status tracker', 'tracking', 'track status'],
  'bank details': ['bank account', 'bank information', 'account details', 'bank MICR'],
  'form': ['application form', 'fillable form', 'mandate form'],
};

// Debug: Print configuration on module load
console.log(`[CONFIG] OLLAMA_URL: ${OLLAMA_URL}`);
console.log(`[CONFIG] CHROMA_URL: ${CHROMA_URL}`);
console.log(`[CONFIG] OLLAMA_URL env var: ${process.env.OLLAMA_URL || 'not set'}`);

let chromaClient: ChromaClient | null = null;

function getChromaClient(): ChromaClient {
  if (!chromaClient) {
    // Create ChromaDB client without any default embedding function
    // We use Ollama embeddings explicitly
    chromaClient = new ChromaClient({ path: CHROMA_URL });
  }
  return chromaClient;
}

/**
 * Expand query using domain-specific synonyms
 * Creates variations of the query to improve retrieval
 */
function expandQuery(query: string): string[] {
  const variations = new Set<string>();
  variations.add(query); // Always include original query
  
  const lowerQuery = query.toLowerCase();
  
  Object.entries(DOMAIN_SYNONYMS).forEach(([term, synonyms]) => {
    const termLower = term.toLowerCase();
    if (lowerQuery.includes(termLower)) {
      synonyms.forEach(syn => {
        // Create variation with synonym
        const variation = query.replace(new RegExp(term, 'gi'), syn);
        variations.add(variation);
      });
    }
  });
  
  // Return unique variations (max 5 to avoid too many queries)
  return Array.from(variations).slice(0, 5);
}

interface RetrievalResult {
  id: string;
  content: string;
  metadata: { title?: string; source?: string; category?: string; section?: string };
  similarity: number;
}

/**
 * Re-rank results by boosting those where query keywords appear in the title
 * This helps prioritize results that directly match the query intent
 */
function rerankResults(query: string, results: RetrievalResult[]): RetrievalResult[] {
  const queryTerms = query.toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2); // Ignore very short words
  
  return results
    .map(result => {
      let boost = 0;
      const title = (result.metadata.title || '').toLowerCase();
      const content = result.content.toLowerCase();
      
      queryTerms.forEach(term => {
        // Title match = big boost
        if (title.includes(term)) {
          boost += 0.15;
          console.log(`[RERANK] Boost +0.15 for title match: "${term}" in "${result.metadata.title}"`);
        }
        // Content match = smaller boost
        else if (content.includes(term)) {
          boost += 0.03;
        }
      });
      
      return {
        ...result,
        similarity: Math.min(1, result.similarity + boost) // Cap at 1.0
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Merge and deduplicate results from multiple query variations
 * Returns top results sorted by similarity (best first)
 */
function mergeQueryResults(allResults: any[], topN: number = 10): {
  documents: string[];
  distances: number[];
  metadatas: any[];
} {
  // Combine all results into a single array with document content as key for deduplication
  const resultMap = new Map<string, { distance: number; metadata: any; document: string }>();
  
  allResults.forEach((result) => {
    if (!result.documents || !result.documents[0]) return;
    
    const docs = result.documents[0];
    const distances = result.distances?.[0] || [];
    const metadatas = result.metadatas?.[0] || [];
    
    docs.forEach((doc: string, i: number) => {
      // Use document content as key for deduplication
      const docKey = doc.substring(0, 200); // Use first 200 chars as key
      
      // Keep the result with the best (lowest) distance
      const distance = distances[i] ?? 1;
      const existing = resultMap.get(docKey);
      
      if (!existing || distance < existing.distance) {
        resultMap.set(docKey, {
          distance,
          metadata: metadatas[i] || {},
          document: doc,
        });
      }
    });
  });
  
  // Convert to arrays and sort by distance (best first)
  const merged = Array.from(resultMap.values())
    .sort((a, b) => a.distance - b.distance)
    .slice(0, topN);
  
  return {
    documents: merged.map(r => r.document),
    distances: merged.map(r => r.distance),
    metadatas: merged.map(r => r.metadata),
  };
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
        
        // Add helpful message for missing model
        if (response.status === 404) {
          console.log(`[HINT] Model not found. Run: ollama pull nomic-embed-text`);
        } else {
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
  return (await getLLMResponseWithConfidence(prompt)).response;
}

export async function getLLMResponseWithConfidence(prompt: string): Promise<{ response: string; confidence?: number }> {
  try {
    console.log(`[DEBUG] Calling LLM with prompt length: ${prompt.length}`);
    
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        prompt,
        stream: false,
        options: {
          // Request token probabilities if supported
          top_p: 0.9,
          temperature: 0.7,
        },
      }),
    });

    console.log(`[DEBUG] LLM response status: ${response.status}`);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[ERROR] LLM API error: ${response.status} - ${errorBody}`);
      
      // Fallback to curl method
      console.log(`[DEBUG] Trying curl fallback for LLM...`);
      const fallbackResponse = await getLLMResponseViaCurl(prompt);
      return { response: fallbackResponse };
    }

    const data = await response.json();
    console.log(`[DEBUG] LLM response received, length: ${data.response?.length || 0}`);
    
    // Try to extract confidence from response if available
    // Ollama might not return probabilities, so we'll use self-assessment
    return {
      response: data.response || '',
      // Confidence will be calculated separately via self-assessment
    };
  } catch (error: any) {
    console.error('[ERROR] getLLMResponse failed:', error.message);
    // Try curl fallback
    console.log(`[DEBUG] Trying curl fallback for LLM after error...`);
    const fallbackResponse = await getLLMResponseViaCurl(prompt);
    return { response: fallbackResponse };
  }
}

/**
 * Calculate LLM confidence using self-assessment
 * Asks the LLM to rate its own confidence in the answer
 */
async function calculateLLMConfidence(question: string, answer: string, context: string): Promise<number> {
  try {
    const assessmentPrompt = `You are evaluating the confidence level of an AI assistant's answer.

Question: ${question}

Context provided to the assistant:
${context.substring(0, 500)}...

Answer provided: ${answer}

On a scale of 0.0 to 1.0, how confident should the assistant be in this answer?
Consider:
- How well the answer addresses the question
- How well the context supports the answer
- Whether the answer is complete and accurate
- Whether there are any uncertainties or gaps

Respond with ONLY a number between 0.0 and 1.0 (e.g., 0.85 for 85% confidence).`;

    const assessmentResponse = await getLLMResponse(assessmentPrompt);
    
    // Extract number from response
    const match = assessmentResponse.match(/(\d+\.?\d*)/);
    if (match) {
      const confidence = parseFloat(match[1]);
      // Normalize to 0-1 range (in case LLM returns 0-100)
      const normalized = confidence > 1 ? confidence / 100 : confidence;
      return Math.max(0, Math.min(1, normalized));
    }
    
    // Fallback: analyze answer for uncertainty indicators
    return analyzeAnswerConfidence(answer);
  } catch (error) {
    console.error('Error calculating LLM confidence:', error);
    // Fallback to heuristic analysis
    return analyzeAnswerConfidence(answer);
  }
}

/**
 * Heuristic-based confidence analysis
 * Looks for uncertainty indicators in the answer
 */
function analyzeAnswerConfidence(answer: string): number {
  const lowerAnswer = answer.toLowerCase();
  
  // High confidence indicators
  const highConfidencePhrases = [
    'according to',
    'based on',
    'the procedure is',
    'the steps are',
    'you should',
    'you must',
    'you need to',
  ];
  
  // Low confidence indicators
  const lowConfidencePhrases = [
    'i\'m not sure',
    'i don\'t know',
    'unclear',
    'uncertain',
    'may not',
    'might not',
    'possibly',
    'perhaps',
    'i cannot',
    'unable to',
    'doesn\'t contain enough information',
    'no relevant',
    'not found',
  ];
  
  // Count indicators
  const highCount = highConfidencePhrases.filter(phrase => lowerAnswer.includes(phrase)).length;
  const lowCount = lowConfidencePhrases.filter(phrase => lowerAnswer.includes(phrase)).length;
  
  // Base confidence
  let confidence = 0.7; // Default moderate confidence
  
  // Adjust based on indicators
  if (highCount > 0 && lowCount === 0) {
    confidence = 0.85; // High confidence
  } else if (lowCount > 0) {
    confidence = Math.max(0.2, 0.7 - (lowCount * 0.15)); // Reduce confidence
  }
  
  // Check answer length (very short answers might be less confident)
  if (answer.length < 50) {
    confidence *= 0.9;
  }
  
  // Check if answer explicitly states uncertainty
  if (lowerAnswer.includes('if the context doesn\'t contain enough information')) {
    confidence = 0.3;
  }
  
  return Math.max(0, Math.min(1, confidence));
}

async function getLLMResponseViaCurl(prompt: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `ollama-llm-${Date.now()}.json`);
  
  try {
    const payload = JSON.stringify({
      model: 'qwen2.5:3b',
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
    console.log('\n[RETRIEVAL] =====================================');
    console.log('[RETRIEVAL] Query:', question);
    
    const client = getChromaClient();
    
    // Check if collection exists
    const collections = await client.listCollections();
    const collectionExists = collections.some(c => c.name === COLLECTION_NAME);
    
    if (!collectionExists) {
      console.log('[RETRIEVAL] Collection does not exist');
      console.log('[RETRIEVAL] =====================================\n');
      return {
        answer: "SOP index is empty. Please rebuild the index from the admin dashboard.",
        confidence: 0.0,
        sources: [],
      };
    }

    // Get collection (must have been created without embedding function)
    const collection = await client.getCollection({ name: COLLECTION_NAME });

    // Expand query using domain-specific synonyms
    const queryVariations = expandQuery(question);
    console.log('[RETRIEVAL] Query variations:', queryVariations);

    // Get results for each query variation
    const allQueryResults = await Promise.all(
      queryVariations.map(async (queryVar) => {
        const embedding = await getEmbedding(queryVar);
        const result = await collection.query({
          queryEmbeddings: [embedding],
          nResults: 10, // Get top 10 for each variation
        });
        return result;
      })
    );

    // Merge and deduplicate results, keeping top 10 by similarity
    const mergedResults = mergeQueryResults(allQueryResults, 10);
    
    if (!mergedResults.documents || mergedResults.documents.length === 0) {
      console.log('[RETRIEVAL] No results found after merging');
      console.log('[RETRIEVAL] =====================================\n');
      return {
        answer: "No relevant SOPs found for this question.",
        confidence: 0.0,
        sources: [],
      };
    }

    // Convert merged results to RetrievalResult format for re-ranking
    let retrievalResults: RetrievalResult[] = mergedResults.documents.map((doc, i) => ({
      id: `result-${i}`,
      content: doc,
      metadata: mergedResults.metadatas[i] || {},
      similarity: 1 - (mergedResults.distances[i] || 0) // Convert distance to similarity
    }));

    console.log('[RETRIEVAL] Retrieved', retrievalResults.length, 'results (after merging', allQueryResults.length, 'query variations)');
    console.log('[RETRIEVAL] Top results (before re-ranking):');
    retrievalResults.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. "${r.metadata.title}" (similarity: ${(r.similarity * 100).toFixed(1)}%)`);
      console.log(`     Preview: ${r.content.substring(0, 100)}...`);
    });

    // Re-rank based on keyword matching in titles
    retrievalResults = rerankResults(question, retrievalResults);

    console.log('[RERANK] After re-ranking:');
    retrievalResults.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. "${r.metadata.title}" (score: ${(r.similarity * 100).toFixed(1)}%)`);
    });

    // Extract re-ranked results
    const relevantDocs = retrievalResults.map(r => r.content);
    const distances = retrievalResults.map(r => 1 - r.similarity); // Convert back to distance for confidence calculation
    const metadatas = retrievalResults.map(r => r.metadata);

    // Calculate confidence based on similarity (lower distance = higher confidence)
    // Convert distance to confidence (assuming cosine distance, 0 = identical, 1 = orthogonal)
    const avgDistance = distances.length > 0 
      ? distances.filter((d): d is number => d != null).reduce((a, b) => a + b, 0) / distances.length
      : 1;
    const confidence = Math.max(0, Math.min(1, 1 - avgDistance));

    // Build context from re-ranked SOPs
    const context = relevantDocs
      .map((doc, i) => {
        const metadata = metadatas[i] || {};
        const title = metadata.title || 'SOP Entry';
        return `[${title}]\n${doc}`;
      })
      .join('\n\n---\n\n');

    console.log('[RETRIEVAL] Context length:', context.length, 'chars');
    console.log('[RETRIEVAL] =====================================\n');

    // Generate answer using LLM with context
    const prompt = `You are a helpful assistant that answers questions about Standard Operating Procedures (SOPs).

Context from SOP documents:
${context}

Question: ${question}

Instructions:
1. Carefully review ALL provided context sections, not just the first one
2. Look for information that answers the question, even if the section title is different from the question
3. For "How to" questions, provide clear step-by-step procedures
4. If related information exists under a different heading (e.g., "check status" info might be under "Tracker"), still include it
5. Connect acronyms to their meanings (MFU = Mutual Fund Unit, CAN = Consolidated Account Number)
6. Be concise but complete
7. Only say "not enough information" if you've thoroughly checked ALL context sections and found nothing relevant

Answer:`;

    const llmResult = await getLLMResponseWithConfidence(prompt);
    const answer = llmResult.response;

    console.log('[LLM] Response length:', answer.length, 'chars');

    // Calculate LLM confidence (self-assessment + heuristics)
    const llmConfidence = await calculateLLMConfidence(question, answer, context);

    // Combine retrieval confidence with LLM confidence
    // Weights are configurable via environment variables (default: 60% retrieval, 40% LLM)
    const combinedConfidence = (confidence * RETRIEVAL_WEIGHT) + (llmConfidence * LLM_WEIGHT);

    console.log('[LLM] Confidence:', (combinedConfidence * 100).toFixed(1) + '%');
    console.log(`[DEBUG] Confidence breakdown - Retrieval: ${(confidence * 100).toFixed(1)}%, LLM: ${(llmConfidence * 100).toFixed(1)}%, Combined: ${(combinedConfidence * 100).toFixed(1)}%`);

    // Extract sources (titles from metadata)
    const sources = metadatas
      .map((m: any) => m.title)
      .filter((t: string) => t)
      .slice(0, 3); // Limit to top 3 sources

    return {
      answer,
      confidence: combinedConfidence,
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

    // Create new collection WITHOUT any embedding function
    // We provide embeddings explicitly via Ollama, so no embedding function is needed
    const collection = await client.createCollection({
      name: COLLECTION_NAME,
      metadata: { description: 'SOP documents for RAG' },
    });
    
    // Verify collection was created without embedding function
    // All embeddings will be provided manually via Ollama
    console.log('Created new ChromaDB collection (no embedding function - using manual embeddings)');

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

    // Process uploaded files from uploads directory
    const uploadsPath = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadsPath)) {
      console.log(`Processing uploaded files from: ${uploadsPath}`);
      const uploadEntries = await parseSOPDirectory(uploadsPath);
      allEntries.push(...uploadEntries);
    }

    // Apply chunking strategy to split large entries and add overlap
    const { createChunksWithOverlap } = await import('../scripts/parse-sop');
    const chunks = createChunksWithOverlap(allEntries);
    console.log(`Parsed ${allEntries.length} total SOP entries, created ${chunks.length} chunks, generating embeddings...`);
    
    // Use chunks instead of entries for indexing
    const entries = chunks;

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
          // Title already includes part number for multi-chunk entries (from chunking function)
          const entryTitle = entry.title || 'Untitled';
          
          console.log(`[DEBUG] Processing chunk ${globalIdx + 1}/${entries.length}: ${entryTitle.substring(0, 50)}`);
          
          // Content already has title prepended by chunking function
          const contentWithTitle = entry.content;
          
          const embedding = await getEmbedding(contentWithTitle);
          console.log(`[DEBUG] Completed chunk ${globalIdx + 1}, embedding length: ${embedding.length}`);
          
          // Build metadata object, only including chunk info if it exists
          // ChromaDB only accepts string, number, or boolean - not undefined or null
          const metadata: Record<string, string | number | boolean> = {
            title: entryTitle,
            category: entry.category || 'General',
            section: entry.section || '',
            sourceFile: entry.sourceFile || entry.source || '',
          };
          
          // Only add chunk info if it exists
          if (entry.chunkIndex !== undefined) {
            metadata.chunkIndex = entry.chunkIndex;
          }
          if (entry.totalChunks !== undefined) {
            metadata.totalChunks = entry.totalChunks;
          }
          
          return {
            id: `sop-${globalIdx}`,
            embedding,
            document: contentWithTitle, // Store content with title included
            metadata,
          };
        } catch (error: any) {
          console.error(`[ERROR] Failed to process chunk ${globalIdx + 1}:`, error.message);
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

    // Add all documents to ChromaDB with explicit embeddings from Ollama
    // We provide embeddings manually, so ChromaDB won't try to use any default embedding function
    await collection.add({
      ids: allIds,
      embeddings: allEmbeddings, // Explicit embeddings from Ollama (nomic-embed-text)
      documents: allDocuments,
      metadatas: allMetadatas,
    });

    console.log(`Successfully indexed ${entries.length} SOP chunks into ChromaDB`);

    // Track indexed SOPs in database
    // Group chunks by source file (one entry per file, with total count)
    const fileGroups = new Map<string, { categories: Set<string>; count: number }>();
    
    entries.forEach((entry) => {
      const source = entry.sourceFile || entry.source || 'Unknown';
      const category = entry.category || 'General';
      
      if (!fileGroups.has(source)) {
        fileGroups.set(source, { categories: new Set(), count: 0 });
      }
      const group = fileGroups.get(source)!;
      group.categories.add(category);
      group.count++;
    });

    // Clear existing indexed SOPs
    await db.delete(indexedSOPs);

    // Insert new indexed SOPs - one row per source file
    for (const [sourceFile, data] of fileGroups.entries()) {
      // Use the first category or join if multiple
      const categories = Array.from(data.categories);
      const primaryCategory = categories.length > 0 ? categories[0] : 'General';
      
      await db.insert(indexedSOPs).values({
        sourceFile,
        category: primaryCategory,
        entryCount: data.count,
        lastIndexed: new Date(),
      });
    }

    console.log(`Tracked ${fileGroups.size} SOP sources in database`);

    // Generate predefined questions for each source file
    console.log('Generating predefined questions for documents...');
    const { generatePredefinedQuestions, storePredefinedQuestions } = await import('./question-generator');
    
    // Group entries by source file for question generation
    const entriesByFile = new Map<string, any[]>();
    entries.forEach((entry) => {
      const source = entry.sourceFile || 'Unknown';
      if (!entriesByFile.has(source)) {
        entriesByFile.set(source, []);
      }
      entriesByFile.get(source)!.push(entry);
    });

    // Generate questions for each file
    for (const [sourceFile, fileEntries] of entriesByFile.entries()) {
      try {
        const fileGroup = fileGroups.get(sourceFile);
        const category = fileGroup?.categories.values().next().value || undefined;
        
        console.log(`Generating questions for: ${sourceFile}`);
        const questions = await generatePredefinedQuestions(sourceFile, fileEntries, category);
        
        if (questions.length > 0) {
          await storePredefinedQuestions(sourceFile, questions, category);
        }
      } catch (error) {
        console.error(`Error generating questions for ${sourceFile}:`, error);
        // Continue with other files even if one fails
      }
    }

    console.log('Predefined questions generation complete');
  } catch (error) {
    console.error('Error rebuilding index:', error);
    throw error;
  }
}
