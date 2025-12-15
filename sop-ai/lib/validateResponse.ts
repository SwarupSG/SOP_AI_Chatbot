import { getAcronymMap, type Acronym } from './acronyms';

const COMMON_WORDS_BLACKLIST = [
  // Original two-letter words
  'IT', 'OR', 'AN', 'AT', 'BY', 'DO', 'GO', 'IF', 'IN', 'IS', 
  'NO', 'OF', 'ON', 'SO', 'TO', 'UP', 'US', 'WE',
  // Additional common words that aren't financial acronyms
  'AM', 'PM', 'OK', 'BE', 'HE', 'ME', 'MY', 'AS', 'VS',
  // Common abbreviations (non-financial)
  'TV', 'PC', 'UK', 'EU', 'UN', 'ID', 'HR', 'PR', 'AI',
  // Prevent false matches
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL',
  'CAN', 'HAD', 'HER', 'WAS', 'ONE', 'OUR', 'OUT'
];

export function validateAcronymsInResponse(response: string): { correctedResponse: string; corrections: string[] } {
  const acronymMap = getAcronymMap();
  const corrections: string[] = [];
  
  const acronymPattern = /\b([A-Z]{2,6})\s*\(([^)]+)\)/g;
  const matches = Array.from(response.matchAll(acronymPattern));
  
  if (matches.length === 0) {
    return { correctedResponse: response, corrections: [] };
  }
  
  let correctedResponse = response;
  let offset = 0;
  
  for (const match of matches) {
    const acronym = match[1].toUpperCase();
    const providedDefinition = match[2].trim();
    const fullMatch = match[0];
    const originalIndex = match.index!;
    const adjustedIndex = originalIndex + offset;
    
    if (COMMON_WORDS_BLACKLIST.includes(acronym)) {
      continue;
    }
    
    const correctAcronym = acronymMap.get(acronym);
    
    if (correctAcronym) {
      const correctDefinition = correctAcronym.fullForm;
      const providedLower = providedDefinition.toLowerCase();
      const correctLower = correctDefinition.toLowerCase();
      
      if (!correctLower.includes(providedLower) && !providedLower.includes(correctLower)) {
        const corrected = `${acronym} (${correctDefinition})`;
        const beforeMatch = correctedResponse.substring(0, adjustedIndex);
        const afterMatch = correctedResponse.substring(adjustedIndex + fullMatch.length);
        correctedResponse = beforeMatch + corrected + afterMatch;
        offset += corrected.length - fullMatch.length;
        corrections.push(`${acronym}: "${providedDefinition}" → "${correctDefinition}"`);
      }
    }
  }
  
  return {
    correctedResponse,
    corrections,
  };
}

export function expandUnexpandedAcronyms(response: string): string {
  const acronymMap = getAcronymMap();
  const expandedAcronyms = new Set<string>();
  
  const standaloneAcronymPattern = /\b([A-Z]{2,6})\b/g;
  const matches = Array.from(response.matchAll(standaloneAcronymPattern));
  
  if (matches.length === 0) {
    return response;
  }
  
  let modifiedResponse = response;
  let offset = 0;
  
  for (const match of matches) {
    const acronym = match[1].toUpperCase();
    const fullMatch = match[0];
    const originalIndex = match.index!;
    const adjustedIndex = originalIndex + offset;
    
    if (COMMON_WORDS_BLACKLIST.includes(acronym)) {
      continue;
    }
    
    if (expandedAcronyms.has(acronym)) {
      continue;
    }
    
    const textAfterMatch = modifiedResponse.substring(adjustedIndex + fullMatch.length, adjustedIndex + fullMatch.length + 2);
    if (textAfterMatch.trim().startsWith('(')) {
      continue;
    }
    
    const correctAcronym = acronymMap.get(acronym);
    
    if (correctAcronym) {
      const expanded = `${fullMatch} (${correctAcronym.fullForm})`;
      const beforeMatch = modifiedResponse.substring(0, adjustedIndex);
      const afterMatch = modifiedResponse.substring(adjustedIndex + fullMatch.length);
      modifiedResponse = beforeMatch + expanded + afterMatch;
      offset += expanded.length - fullMatch.length;
      expandedAcronyms.add(acronym);
    }
  }
  
  return modifiedResponse;
}
