/**
 * Grounding check utility
 * Validates that LLM responses are grounded in the provided context
 */

export interface GroundingResult {
  isGrounded: boolean;
  confidence: number;
  warnings: string[];
}

/**
 * Check if a response appears to be grounded in the provided context
 */
export function checkGrounding(answer: string, context: string): GroundingResult {
  const warnings: string[] = [];
  let confidence = 1.0;
  
  const answerLower = answer.toLowerCase();
  const contextLower = context.toLowerCase();
  
  // Check for hedging language suggesting the model is uncertain
  const uncertainPhrases = [
    'i think', 'probably', 'might be', 'could be', 
    'i believe', 'it seems', 'possibly', 'perhaps',
    'i\'m not sure', 'may or may not'
  ];
  
  uncertainPhrases.forEach(phrase => {
    if (answerLower.includes(phrase)) {
      warnings.push(`Contains uncertain language: "${phrase}"`);
      confidence -= 0.1;
    }
  });
  
  // Check for specific numbers/dates in answer that aren't in context
  const numbersInAnswer = answer.match(/\b\d{4,}\b/g) || [];
  numbersInAnswer.forEach(num => {
    if (!context.includes(num)) {
      warnings.push(`Contains number "${num}" not found in context`);
      confidence -= 0.15;
    }
  });
  
  // Check for phrases indicating the model made something up
  const inventedPhrases = [
    'generally speaking', 'in most cases', 'typically',
    'as a general rule', 'usually'
  ];
  
  inventedPhrases.forEach(phrase => {
    if (answerLower.includes(phrase) && !contextLower.includes(phrase)) {
      warnings.push(`Contains generalizing language not in context: "${phrase}"`);
      confidence -= 0.1;
    }
  });
  
  // Positive check: response mentions it's based on SOPs
  const groundedPhrases = [
    'according to the sop', 'based on the sop', 
    'the sop states', 'as per the documentation'
  ];
  
  const hasGroundedLanguage = groundedPhrases.some(phrase => 
    answerLower.includes(phrase)
  );
  
  if (hasGroundedLanguage) {
    confidence = Math.min(1.0, confidence + 0.1);
  }
  
  return {
    isGrounded: warnings.length < 2 && confidence > 0.5,
    confidence: Math.max(0, Math.min(1, confidence)),
    warnings,
  };
}

/**
 * Check if the response properly declined when info wasn't available
 */
export function isProperDecline(answer: string): boolean {
  const declinePhrases = [
    'not available in the sop',
    'not covered in the sop',
    'this information is not available',
    'i don\'t have information',
    'no information available'
  ];
  
  const answerLower = answer.toLowerCase();
  return declinePhrases.some(phrase => answerLower.includes(phrase));
}
