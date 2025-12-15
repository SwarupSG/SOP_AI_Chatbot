import { getChromaClient, getEmbedding, expandQuery, mergeQueryResults, rerankResults } from './chroma';
import { queryAcronyms, type AcronymResult } from './chroma';
import { getAcronymMap, type Acronym } from './acronyms';

const COLLECTION_NAME = 'sop-documents';

export interface RAGContext {
  sopContext: string[];
  acronymDefinitions: string[];
  relevantAcronyms: Acronym[];
}

function extractAcronymsFromText(text: string, acronymMap: Map<string, Acronym>): Set<Acronym> {
  const foundAcronyms = new Set<Acronym>();
  const acronymPattern = /\b[A-Z]{2,6}\b/g;  // Extended to 6 chars for SARFAESI etc.
  
  const matches = text.matchAll(acronymPattern);
  for (const match of matches) {
    const potentialAcronym = match[0].toUpperCase();
    const acronym = acronymMap.get(potentialAcronym);
    if (acronym) {
      foundAcronyms.add(acronym);
    }
  }
  
  return foundAcronyms;
}

async function querySOPDocuments(queryText: string, nResults: number = 10): Promise<string[]> {
  try {
    const client = getChromaClient();
    
    const collections = await client.listCollections();
    const collectionExists = collections.some(c => c.name === COLLECTION_NAME);
    
    if (!collectionExists) {
      return [];
    }
    
    const collection = await client.getCollection({ name: COLLECTION_NAME });
    
    const queryVariations = expandQuery(queryText);
    const allQueryResults = await Promise.all(
      queryVariations.map(async (queryVar) => {
        const embedding = await getEmbedding(queryVar);
        const result = await collection.query({
          queryEmbeddings: [embedding],
          nResults: 10,
        });
        return result;
      })
    );
    
    const mergedResults = mergeQueryResults(allQueryResults, nResults);
    
    if (!mergedResults.documents || mergedResults.documents.length === 0) {
      return [];
    }
    
    const retrievalResults = mergedResults.documents.map((doc, i) => ({
      id: `result-${i}`,
      content: doc,
      metadata: mergedResults.metadatas[i] || {},
      similarity: 1 - (mergedResults.distances[i] || 0),
    }));
    
    const rerankedResults = rerankResults(queryText, retrievalResults);
    
    return rerankedResults.map(r => r.content);
  } catch (error: any) {
    console.error('[CONTEXT] Error querying SOP documents:', error.message);
    return [];
  }
}

export async function buildRAGContext(userQuery: string): Promise<RAGContext> {
  const acronymMap = getAcronymMap();
  const foundAcronymsMap = new Map<string, Acronym>();
  
  const sopContext = await querySOPDocuments(userQuery);
  
  const acronymResults = await queryAcronyms(userQuery, 5);
  
  acronymResults.forEach(result => {
    const acronym: Acronym = {
      abbreviation: result.abbreviation,
      fullForm: result.fullForm,
      category: result.category,
    };
    foundAcronymsMap.set(acronym.abbreviation.toUpperCase(), acronym);
  });
  
  sopContext.forEach(doc => {
    const docAcronyms = extractAcronymsFromText(doc, acronymMap);
    docAcronyms.forEach(acronym => {
      foundAcronymsMap.set(acronym.abbreviation.toUpperCase(), acronym);
    });
  });
  
  const relevantAcronyms = Array.from(foundAcronymsMap.values());
  const acronymDefinitions = relevantAcronyms.map(acronym => 
    `${acronym.abbreviation}: ${acronym.fullForm}`
  );
  
  return {
    sopContext,
    acronymDefinitions,
    relevantAcronyms,
  };
}

export function formatAcronymContext(acronyms: Acronym[]): string {
  if (acronyms.length === 0) {
    return '';
  }
  
  const lines = acronyms.map(acronym => 
    `- ${acronym.abbreviation}: ${acronym.fullForm}`
  );
  
  return `ACRONYM REFERENCE:\n${lines.join('\n')}`;
}
