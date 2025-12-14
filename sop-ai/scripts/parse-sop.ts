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

export async function parseSOPWord(filePath: string): Promise<SOPEntry[]> {
  console.log(`Reading Word document: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  try {
    // Extract text from Word document
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    
    // Extract HTML for better structure (optional, can use for more advanced parsing)
    const htmlResult = await mammoth.convertToHtml({ path: filePath });
    
    const entries: SOPEntry[] = [];
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Split document into sections (by headings or paragraphs)
    // For now, we'll create entries based on paragraphs or sections
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // Try to identify headings (lines that are short and might be titles)
    let currentTitle = fileName;
    let currentContent: string[] = [];
    
    paragraphs.forEach((para, index) => {
      const trimmed = para.trim();
      
      // Heuristic: if paragraph is short (< 100 chars) and ends without period, it might be a heading
      if (trimmed.length < 100 && !trimmed.endsWith('.') && !trimmed.endsWith('!') && !trimmed.endsWith('?')) {
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
    
    console.log(`Parsed ${entries.length} SOP entries from Word document`);
    return entries;
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

