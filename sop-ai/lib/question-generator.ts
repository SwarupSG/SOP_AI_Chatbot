import { getLLMResponse, querySOPs } from './chroma';
import { db, predefinedQuestions } from './db';
import { eq } from 'drizzle-orm';

/**
 * Generate predefined questions for a document that are likely to yield >80% confidence
 * Now includes validation to ensure questions meet the confidence threshold
 */
export async function generatePredefinedQuestions(
  sourceFile: string,
  documentContent: string[],
  category?: string
): Promise<string[]> {
  try {
    // First, extract high-confidence questions from document structure
    const structureQuestions = extractHighConfidenceQuestions(documentContent, category);
    
    // Then generate AI questions
    const aiQuestions = await generateAIQuestions(sourceFile, documentContent, category);
    
    // Combine and deduplicate
    const allQuestions = [...structureQuestions, ...aiQuestions]
      .filter((q, i, arr) => arr.indexOf(q) === i); // Remove duplicates
    
    console.log(`Generated ${allQuestions.length} candidate questions for ${sourceFile}`);
    
    // Validate each question - test confidence and only keep those with >80%
    const validatedQuestions: string[] = [];
    const MIN_CONFIDENCE = 0.8; // 80% threshold
    
    for (const question of allQuestions) {
      try {
        // Test the question to get actual confidence
        const result = await querySOPs(question);
        const confidence = result.confidence;
        
        if (confidence >= MIN_CONFIDENCE) {
          validatedQuestions.push(question);
          console.log(`✓ Question passed validation (${(confidence * 100).toFixed(1)}%): ${question.substring(0, 60)}...`);
        } else {
          console.log(`✗ Question failed validation (${(confidence * 100).toFixed(1)}%): ${question.substring(0, 60)}...`);
        }
        
        // Stop if we have enough high-confidence questions
        if (validatedQuestions.length >= 8) {
          break;
        }
      } catch (error) {
        console.error(`Error validating question "${question}":`, error);
        // Skip this question if validation fails
      }
    }
    
    // If we don't have enough validated questions, try generating more from structure
    if (validatedQuestions.length < 5) {
      console.log(`Only ${validatedQuestions.length} questions passed validation. Generating additional questions...`);
      const additionalQuestions = generateAdditionalQuestions(documentContent, category);
      
      for (const question of additionalQuestions) {
        if (validatedQuestions.length >= 8) break;
        if (validatedQuestions.includes(question)) continue;
        
        try {
          const result = await querySOPs(question);
          if (result.confidence >= MIN_CONFIDENCE) {
            validatedQuestions.push(question);
            console.log(`✓ Additional question passed: ${question.substring(0, 60)}...`);
          }
        } catch (error) {
          // Skip on error
        }
      }
    }
    
    console.log(`Final: ${validatedQuestions.length} validated questions for ${sourceFile}`);
    return validatedQuestions.slice(0, 8); // Return up to 8 validated questions
  } catch (error) {
    console.error(`Error generating questions for ${sourceFile}:`, error);
    // Fallback to structure-based questions (without validation)
    return extractHighConfidenceQuestions(documentContent, category).slice(0, 5);
  }
}

/**
 * Extract high-confidence questions directly from document structure
 * These are more likely to yield high confidence as they match document content exactly
 */
function extractHighConfidenceQuestions(documentContent: string[], category?: string): string[] {
  const questions: string[] = [];
  
  // Extract specific tasks/procedures from document entries
  documentContent.forEach((entry: any) => {
    const title = entry.title || '';
    const content = entry.content || '';
    
    // Extract task descriptions from content
    const taskMatch = content.match(/Task:\s*(.+?)(?:\n|$)/i);
    const whoMatch = content.match(/Responsible:\s*(.+?)(?:\n|$)/i);
    
    if (title && title.length > 10 && title.length < 100) {
      // Create question from title
      const titleQuestion = `How do I ${title.toLowerCase()}?`;
      if (!questions.includes(titleQuestion)) {
        questions.push(titleQuestion);
      }
    }
    
    if (taskMatch && taskMatch[1]) {
      const task = taskMatch[1].trim();
      if (task.length > 10 && task.length < 150) {
        // Create specific questions from tasks
        const taskQuestions = [
          `How do I ${task.toLowerCase()}?`,
          `What is the procedure for ${task.toLowerCase()}?`,
          `What are the steps to ${task.toLowerCase()}?`,
        ];
        
        taskQuestions.forEach((q) => {
          if (!questions.includes(q) && questions.length < 10) {
            questions.push(q);
          }
        });
      }
    }
  });
  
  return questions.slice(0, 10);
}

/**
 * Generate questions using AI
 */
async function generateAIQuestions(
  sourceFile: string,
  documentContent: string[],
  category?: string
): Promise<string[]> {
  try {
    // Extract more comprehensive content for better question generation
    const contentSample = documentContent
      .slice(0, 20) // Use more entries
      .map((entry: any) => {
        const parts: string[] = [];
        if (entry.title) parts.push(`Title: ${entry.title}`);
        if (entry.content) {
          // Extract key parts of content
          const lines = entry.content.split('\n').slice(0, 3);
          parts.push(lines.join(' '));
        }
        return parts.join('\n');
      })
      .filter(Boolean)
      .join('\n\n')
      .substring(0, 3000); // Increased context

    const fileName = sourceFile.split('/').pop() || sourceFile;

    const prompt = `You are generating predefined questions for a Standard Operating Procedures document. These questions MUST be answerable with >80% confidence.

Document: ${fileName}
Category: ${category || 'General'}

Document Content:
${contentSample}

CRITICAL REQUIREMENTS:
1. Questions must target SPECIFIC, CONCRETE procedures mentioned in the document
2. Questions must use EXACT terminology from the document
3. Questions must be answerable with step-by-step procedures from the document
4. Avoid vague or general questions
5. Focus on questions that have clear, definitive answers in the document

Generate 8-12 specific questions. Each question should:
- Reference specific tasks, tools, or procedures mentioned in the document
- Use the exact same terminology as the document
- Target concrete steps or processes
- Be answerable with specific information from the document

Good examples (specific, concrete):
- "What is the process for handling SIP orders in the system?"
- "Who is responsible for validating client KYC documents?"
- "What tool is used for processing refund transactions?"

Bad examples (too vague):
- "How do I ensure KYC is valid?" (too general)
- "What is the procedure?" (not specific)
- "How do I handle transactions?" (too broad)

Return ONLY a JSON array of question strings, nothing else. Example format:
["What is the process for handling SIP orders?", "Who is responsible for validating client KYC documents?"]`;

    const response = await getLLMResponse(prompt);

    // Parse JSON from response
    let questions: string[] = [];

    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      try {
        questions = JSON.parse(jsonMatch[0]);
      } catch (e) {
        questions = extractQuestionsFromText(response);
      }
    } else {
      questions = extractQuestionsFromText(response);
    }

    // Clean and validate
    questions = questions
      .filter((q) => q && typeof q === 'string' && q.trim().length > 15)
      .map((q) => q.trim().replace(/^["']|["']$/g, ''))
      .filter((q) => q.endsWith('?') && q.length > 20) // Must be a proper question
      .slice(0, 12);

    return questions;
  } catch (error) {
    console.error('Error in AI question generation:', error);
    return [];
  }
}

/**
 * Generate additional questions from document structure when needed
 */
function generateAdditionalQuestions(documentContent: string[], category?: string): string[] {
  const questions: string[] = [];
  
  // Extract unique task titles
  const tasks = documentContent
    .map((entry: any) => {
      const title = entry.title || '';
      const content = entry.content || '';
      const taskMatch = content.match(/Task:\s*(.+?)(?:\n|$)/i);
      return taskMatch ? taskMatch[1].trim() : title;
    })
    .filter((t) => t && t.length > 10 && t.length < 100)
    .filter((t, i, arr) => arr.indexOf(t) === i);

  // Generate more specific questions
  tasks.forEach((task) => {
    const specificQuestions = [
      `What is the exact procedure for ${task.toLowerCase()}?`,
      `What are the specific steps to ${task.toLowerCase()}?`,
      `Who is responsible for ${task.toLowerCase()}?`,
      `What tool is used for ${task.toLowerCase()}?`,
    ];
    
    specificQuestions.forEach((q) => {
      if (!questions.includes(q) && questions.length < 15) {
        questions.push(q);
      }
    });
  });

  return questions;
}

function extractQuestionsFromText(text: string): string[] {
  // Extract lines that end with ? or match question patterns
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const questions = lines
    .filter((line) => {
      const isQuestion = line.endsWith('?');
      const isNumbered = /^\d+[\.\)]\s*.*\?/.test(line);
      const isBullet = /^[-*]\s*.*\?/.test(line);
      return isQuestion || isNumbered || isBullet;
    })
    .map((line) => line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((q) => q.length > 10);

  return questions;
}


/**
 * Store predefined questions for a document
 */
export async function storePredefinedQuestions(
  sourceFile: string,
  questions: string[],
  category?: string
): Promise<void> {
  try {
    // Delete existing questions for this file
    await db.delete(predefinedQuestions).where(eq(predefinedQuestions.sourceFile, sourceFile));

    // Insert new questions
    for (const question of questions) {
      await db.insert(predefinedQuestions).values({
        sourceFile,
        question,
        category: category || null,
        createdAt: new Date(),
      });
    }

    console.log(`Stored ${questions.length} predefined questions for ${sourceFile}`);
  } catch (error) {
    console.error('Error storing predefined questions:', error);
    throw error;
  }
}

