import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

export interface SOPEntry {
  title?: string;
  content: string;
  category?: string;
  section?: string;
  sourceFile?: string;
  [key: string]: any;
}

export interface Chunk {
  title: string;
  content: string;
  source: string;
  category: string;
  chunkIndex?: number;
  totalChunks?: number;
  sourceFile?: string;
  section?: string;
}

// Chunking configuration
const MAX_CHUNK_WORDS = 400;    // Maximum words per chunk
const MIN_CHUNK_WORDS = 50;     // Minimum words per chunk
const OVERLAP_WORDS = 75;       // Words to overlap between chunks

/**
 * Split entries into chunks with size limits and overlap
 * Large entries are split into multiple chunks with overlapping content
 */
export function createChunksWithOverlap(entries: SOPEntry[]): Chunk[] {
  const chunks: Chunk[] = [];
  
  entries.forEach(entry => {
    const words = entry.content.split(/\s+/);
    
    // Always include title at start of content
    const titlePrefix = entry.title ? `${entry.title}\n\n` : '';
    
    if (words.length <= MAX_CHUNK_WORDS) {
      // Small enough, use as single chunk
      chunks.push({
        title: entry.title || 'SOP Entry',
        content: titlePrefix + entry.content,
        source: entry.sourceFile || 'Unknown',
        category: entry.category || 'SOP',
        sourceFile: entry.sourceFile,
        section: entry.section,
      });
    } else {
      // Split into multiple chunks with overlap
      const stepSize = MAX_CHUNK_WORDS - OVERLAP_WORDS;
      const totalChunks = Math.ceil((words.length - MAX_CHUNK_WORDS) / stepSize) + 1;
      let chunkIndex = 0;
      
      for (let i = 0; i < words.length; i += stepSize) {
        const chunkWords = words.slice(i, i + MAX_CHUNK_WORDS);
        
        // Skip if too small (unless it's the last chunk)
        if (chunkWords.length < MIN_CHUNK_WORDS && i + MAX_CHUNK_WORDS < words.length) {
          continue;
        }
        
        chunkIndex++;
        const chunkTitle = totalChunks > 1 
          ? `${entry.title || 'SOP Entry'} (Part ${chunkIndex}/${totalChunks})` 
          : (entry.title || 'SOP Entry');
        
        chunks.push({
          title: chunkTitle,
          content: titlePrefix + chunkWords.join(' '),
          source: entry.sourceFile || 'Unknown',
          category: entry.category || 'SOP',
          chunkIndex,
          totalChunks,
          sourceFile: entry.sourceFile,
          section: entry.section,
        });
      }
    }
  });
  
  console.log(`[CHUNKING] Created ${chunks.length} chunks from ${entries.length} entries`);
  return chunks;
}

export function parseSOPExcel(filePath: string): SOPEntry[] {
  console.log(`Reading Excel file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const entries: SOPEntry[] = [];

  // Process each sheet
  workbook.SheetNames.forEach((sheetName) => {
    console.log(`Processing sheet: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    
    // Read as array of arrays to better handle structure
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false,
      defval: '',
      header: 1 
    }) as any[][];

    // Find header row (usually row 2 or 3)
    let headerRowIndex = -1;
    let headers: string[] = [];
    
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
      const row = rawData[i];
      if (row && row.some((cell: any) => 
        typeof cell === 'string' && 
        (cell.toLowerCase().includes('task') || cell.toLowerCase().includes('who') || cell.toLowerCase().includes('tool'))
      )) {
        headerRowIndex = i;
        headers = row.map((cell: any) => String(cell || '').trim());
        break;
      }
    }

    if (headerRowIndex === -1) {
      console.warn(`Could not find header row in sheet ${sheetName}, skipping`);
      return;
    }

    // Process data rows
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.every((cell: any) => !cell || String(cell).trim() === '')) {
        continue; // Skip empty rows
      }

      const entry: SOPEntry = {
        content: '',
        category: sheetName,
        sourceFile: filePath,
      };

      const contentParts: string[] = [];
      let task = '';
      let who = '';
      let tools = '';
      let template = '';
      let sn = '';

      // Map columns based on headers
      headers.forEach((header, colIndex) => {
        const value = row[colIndex] ? String(row[colIndex]).trim() : '';
        if (!value) return;

        const headerLower = header.toLowerCase();
        
        if (headerLower.includes('s n') || headerLower.includes('sn')) {
          sn = value;
        } else if (headerLower.includes('task') || headerLower.includes('what')) {
          task = value;
          entry.title = value;
        } else if (headerLower.includes('who')) {
          who = value;
        } else if (headerLower.includes('tool')) {
          tools = value;
        } else if (headerLower.includes('template') || headerLower.includes('note')) {
          template = value;
        }
      });

      // Build structured content
      if (task) {
        contentParts.push(`Task: ${task}`);
      }
      if (who) {
        contentParts.push(`Responsible: ${who}`);
      }
      if (tools) {
        contentParts.push(`Tools: ${tools}`);
      }
      if (template) {
        contentParts.push(`Template/Notes: ${template}`);
      }
      if (sn) {
        entry.section = sn;
      }

      entry.content = contentParts.join('\n');

      // Only add if there's meaningful content (at least a task)
      if (task && entry.content.trim()) {
        entries.push(entry);
      }
    }
  });

  console.log(`Parsed ${entries.length} SOP entries from ${workbook.SheetNames.length} sheet(s)`);
  return entries;
}

function isLikelyHeading(text: string): boolean {
  const trimmed = text.trim();
  
  // Too short or too long
  if (trimmed.length < 3 || trimmed.length > 150) return false;
  
  // Common SOP heading patterns
  const headingPatterns = [
    /^How to/i,
    /^Steps? to/i,
    /^Steps? for/i,
    /^Procedure/i,
    /^Process/i,
    /^Guide/i,
    /^What is/i,
    /^When to/i,
    /^Where to/i,
    /^\d+\.\s+/,  // Numbered items like "1. Go to..."
    /\?$/,              // Lines ending with question mark are headings
    /^Why /i,           // "Why..." questions
    /^Which /i,         // "Which..." questions  
    /^Can I/i,          // "Can I..." questions
    /^How do/i,         // "How do I..." questions
    /^How can/i,        // "How can I..." questions
  ];
  
  if (headingPatterns.some(p => p.test(trimmed))) return true;
  
  // Short lines not ending with period are likely headings
  if (trimmed.length < 100 && !trimmed.endsWith('.')) return true;
  
  return false;
}

function parseWordDocFromHtml(html: string, fileName: string, filePath: string): SOPEntry[] {
  const entries: SOPEntry[] = [];
  
  // Use exec to find all headings and their positions
  const headingRegex = /<h[1-4][^>]*>(.*?)<\/h[1-4]>/gi;
  const headings: { text: string; index: number; endIndex: number }[] = [];
  
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      text: match[1].replace(/<[^>]+>/g, '').trim(), // Strip inner HTML tags
      index: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  console.log(`[PARSE] Found ${headings.length} HTML headings in document`);
  
  // If no headings found, return empty (caller will use text heuristics)
  if (headings.length === 0) {
    return [];
  }
  
  // Extract content before first heading (if any)
  if (headings.length > 0 && headings[0].index > 0) {
    const preContent = html.substring(0, headings[0].index)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (preContent.length > 20) {
      entries.push({
        title: fileName,
        content: preContent,
        category: fileName,
        sourceFile: filePath,
      });
    }
  }
  
  // Extract content between each heading and the next
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    
    // Content starts after this heading tag ends
    const contentStart = heading.endIndex;
    // Content ends at next heading (or end of document)
    const contentEnd = nextHeading ? nextHeading.index : html.length;
    
    const contentHtml = html.substring(contentStart, contentEnd);
    const contentText = contentHtml
      .replace(/<[^>]+>/g, ' ')  // Remove HTML tags
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim();
    
    // Only add if there's meaningful content
    if (contentText.length > 10) {
      entries.push({
        title: heading.text || fileName,
        content: contentText,
        category: fileName,
        sourceFile: filePath,
      });
      console.log(`[PARSE] Extracted section: "${heading.text}" (${contentText.length} chars)`);
    }
  }
  
  return entries;
}

export async function parseSOPWord(filePath: string): Promise<SOPEntry[]> {
  console.log(`Reading Word document: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  try {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Extract HTML for better structure (Mammoth preserves heading tags)
    const htmlResult = await mammoth.convertToHtml({ path: filePath });
    const html = htmlResult.value;
    
    // Check if HTML has heading structure
    const hasHeadings = /<h[1-4]/i.test(html);
    
    if (hasHeadings) {
      console.log(`[PARSE] Using HTML structure for: ${fileName}`);
      const entries = parseWordDocFromHtml(html, fileName, filePath);
      console.log(`Parsed ${entries.length} SOP entries from Word document (HTML structure)`);
      return entries;
    } else {
      console.log(`[PARSE] No HTML headings, using text heuristics for: ${fileName}`);
      
      // Fall back to text-based parsing with heuristics
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;
      
      const entries: SOPEntry[] = [];
      
      // Split document into sections (by headings or paragraphs)
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      
      // Try to identify headings (lines that are short and might be titles)
      let currentTitle = fileName;
      let currentContent: string[] = [];
      
      paragraphs.forEach((para, index) => {
        const trimmed = para.trim();
        
        // Use improved heading detection that recognizes questions and common SOP patterns
        if (isLikelyHeading(trimmed)) {
          // Save previous section if it has content
          if (currentContent.length > 0) {
            entries.push({
              title: currentTitle,
              content: currentContent.join('\n\n'),
              category: fileName,
              sourceFile: filePath,
            });
          }
          // Start new section
          currentTitle = trimmed;
          currentContent = [];
        } else {
          currentContent.push(trimmed);
        }
      });
      
      // Add the last section
      if (currentContent.length > 0) {
        entries.push({
          title: currentTitle,
          content: currentContent.join('\n\n'),
          category: fileName,
          sourceFile: filePath,
        });
      }
      
      // If no sections were created, create one entry with all content
      if (entries.length === 0 && text.trim()) {
        entries.push({
          title: fileName,
          content: text,
          category: fileName,
          sourceFile: filePath,
        });
      }
      
      console.log(`Parsed ${entries.length} SOP entries from Word document (text heuristics)`);
      return entries;
    }
  } catch (error) {
    console.error(`Error parsing Word document ${filePath}:`, error);
    throw error;
  }
}

export function previewSOPStructure(filePath: string): void {
  console.log(`\n=== Previewing SOP Structure ===\n`);
  
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
    console.log(`Sheets: ${workbook.SheetNames.join(', ')}\n`);

    workbook.SheetNames.forEach((sheetName) => {
      console.log(`\n--- Sheet: ${sheetName} ---`);
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Show first few rows
      const previewRows = data.slice(0, 5);
      console.log('Headers/First rows:');
      previewRows.forEach((row: any, i: number) => {
        console.log(`Row ${i + 1}:`, row);
      });
    });
  } else if (ext === '.docx' || ext === '.doc') {
    console.log('Word document detected. Preview not available for .docx files.');
    console.log('Use parse-sop to see extracted content.');
  } else {
    console.log(`Unknown file type: ${ext}`);
  }
}

export async function parseSOPFile(filePath: string): Promise<SOPEntry[]> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.xlsx' || ext === '.xls') {
    return parseSOPExcel(filePath);
  } else if (ext === '.docx' || ext === '.doc') {
    return await parseSOPWord(filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}. Supported: .xlsx, .xls, .docx, .doc`);
  }
}

export async function parseSOPDirectory(directoryPath: string): Promise<SOPEntry[]> {
  console.log(`Scanning directory: ${directoryPath}`);
  
  if (!fs.existsSync(directoryPath)) {
    console.warn(`Directory not found: ${directoryPath}`);
    return [];
  }

  const allEntries: SOPEntry[] = [];
  const files = fs.readdirSync(directoryPath);
  
  const supportedExtensions = ['.xlsx', '.xls', '.docx', '.doc'];
  const sopFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return supportedExtensions.includes(ext);
  });

  console.log(`Found ${sopFiles.length} SOP file(s) in directory`);

  for (const file of sopFiles) {
    const filePath = path.join(directoryPath, file);
    try {
      console.log(`\nProcessing: ${file}`);
      const entries = await parseSOPFile(filePath);
      allEntries.push(...entries);
      console.log(`✓ Processed ${entries.length} entries from ${file}`);
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error);
    }
  }

  return allEntries;
}

if (require.main === module) {
  let inputPath = process.argv[2] || '/Users/Swarup/Documents/SOP_AI_Chatbot/S4_-_SOPs_-_MF_Transactions.xlsx';
  
  // Resolve relative paths
  if (!path.isAbsolute(inputPath)) {
    inputPath = path.resolve(process.cwd(), inputPath);
  }
  
  (async () => {
    try {
      const stats = fs.statSync(inputPath);
      
      if (stats.isDirectory()) {
        // Process directory
        console.log(`\n=== Processing Directory: ${inputPath} ===\n`);
        const entries = await parseSOPDirectory(inputPath);
        console.log(`\n=== Total: ${entries.length} entries parsed ===\n`);
        
        // Show sample entries
        if (entries.length > 0) {
          console.log('Sample entries:');
          entries.slice(0, 3).forEach((entry, i) => {
            console.log(`\nEntry ${i + 1}:`);
            console.log('Title:', entry.title || 'N/A');
            console.log('Category:', entry.category);
            console.log('Source:', entry.sourceFile || 'N/A');
            console.log('Content preview:', entry.content.substring(0, 200) + '...');
          });
        }
      } else {
        // Process single file
        console.log(`\n=== Processing File: ${inputPath} ===\n`);
        previewSOPStructure(inputPath);
        
        const entries = await parseSOPFile(inputPath);
        console.log(`\n=== Parsed ${entries.length} entries ===\n`);
        
        // Show sample entries
        if (entries.length > 0) {
          console.log('Sample entries:');
          entries.slice(0, 3).forEach((entry, i) => {
            console.log(`\nEntry ${i + 1}:`);
            console.log('Title:', entry.title || 'N/A');
            console.log('Category:', entry.category);
            console.log('Content preview:', entry.content.substring(0, 200) + '...');
          });
        }
      }
    } catch (error) {
      console.error('Error parsing SOP file/directory:', error);
      process.exit(1);
    }
  })();
}

