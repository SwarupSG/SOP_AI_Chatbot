import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

export interface Acronym {
  abbreviation: string;
  fullForm: string;
  category: string;
}

let acronymCache: Acronym[] | null = null;
let acronymMapCache: Map<string, Acronym> | null = null;

function findCSVFile(): string | null {
  const locations = [
    // Local data directory (inside Next.js project) - PRIORITY
    path.join(process.cwd(), 'data', 'Indian_Financial_Acronyms.csv'),
    path.join(process.cwd(), 'data', 'template_sample', 'Indian_Financial_Acronyms.csv'),
    // Fallbacks
    path.join(process.cwd(), 'template_sample', 'Indian_Financial_Acronyms.csv'),
    path.join(process.cwd(), '..', 'template_sample', 'Indian_Financial_Acronyms.csv'),
  ];
  
  for (const loc of locations) {
    try {
      if (fs.existsSync(loc)) {
        console.log('[ACRONYMS] Found CSV at:', loc);
        return loc;
      }
    } catch (e) {
      continue;
    }
  }
  
  console.warn('[ACRONYMS] CSV not found. Tried:', locations);
  return null;
}

export function loadAcronyms(): Acronym[] {
  if (acronymCache) {
    return acronymCache;
  }

  const csvPath = findCSVFile();
  
  if (!csvPath) {
    console.error('[ACRONYMS] CSV file not found in any location');
    return [];
  }

  try {
    console.log('[ACRONYMS] Reading CSV from:', csvPath);
    const workbook = XLSX.readFile(csvPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (data.length < 2) {
      console.warn('[ACRONYMS] CSV file is empty or has no data rows');
      return [];
    }

    const headers = data[0].map((h: any) => String(h || '').trim().toLowerCase());
    const abbrevIndex = headers.findIndex(h => h.includes('abbreviation') || h.includes('abbrev'));
    const fullFormIndex = headers.findIndex(h => h.includes('full form') || h.includes('fullform') || h.includes('full'));
    const categoryIndex = headers.findIndex(h => h.includes('category'));

    if (abbrevIndex === -1 || fullFormIndex === -1) {
      console.warn('[ACRONYMS] Required columns not found in CSV');
      return [];
    }

    const acronyms: Acronym[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const abbreviation = String(row[abbrevIndex] || '').trim();
      const fullForm = String(row[fullFormIndex] || '').trim();
      const category = categoryIndex >= 0 ? String(row[categoryIndex] || '').trim() : '';

      if (abbreviation && fullForm) {
        acronyms.push({ abbreviation, fullForm, category });
      }
    }

    acronymCache = acronyms;
    console.log(`[ACRONYMS] Loaded ${acronyms.length} acronyms`);
    return acronyms;
  } catch (error: any) {
    console.error(`[ACRONYMS] Error reading CSV: ${error.message}`);
    return [];
  }
}

export function getAcronymMap(): Map<string, Acronym> {
  if (acronymMapCache) {
    return acronymMapCache;
  }

  const acronyms = loadAcronyms();
  const map = new Map<string, Acronym>();

  acronyms.forEach(acronym => {
    map.set(acronym.abbreviation.toUpperCase(), acronym);
  });

  acronymMapCache = map;
  return map;
}

export function reloadAcronyms(): Acronym[] {
  acronymCache = null;
  acronymMapCache = null;
  return loadAcronyms();
}
