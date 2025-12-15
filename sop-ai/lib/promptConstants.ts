/**
 * Centralized prompt constants and templates
 * Makes it easy to tune prompts without searching through code
 */

import { type Acronym } from './acronyms';

// LLM Generation Options - tuned for factual Q&A
export const LLM_OPTIONS = {
  temperature: 0.3,      // Low for factual accuracy
  top_p: 0.9,            // Standard nucleus sampling
  repeat_penalty: 1.1,   // Prevent repetition
  num_predict: 512,      // Max tokens to generate
} as const;

// System prompt for RAG queries
export const SYSTEM_PROMPT = `You are an expert SOP (Standard Operating Procedure) assistant. Your goal is to provide accurate, actionable answers based strictly on the provided documentation.

CRITICAL INSTRUCTIONS:
1. DOCUMENTATION ONLY: You must answer ONLY using the provided "SOP CONTEXT". Do not use outside knowledge or make assumptions.
2. ACCURACY IS PARAMOUNT: If the answer is not in the context, strictly state: "This information is not available in the current SOPs."
3. USE ACRONYMS: Refer to the "ACRONYM REFERENCE" to understand abbreviations. when using an acronym for the first time, write it out: e.g., "NEFT (National Electronic Funds Transfer)".
4. STRUCTURED ANSWERS: 
   - For processes/steps: Use numbered lists (1., 2., 3.).
   - For lists of items: Use bullet points.
   - For direct questions: Answer directly and concisely.
5. NO HALLUCINATIONS: Do not invent steps or policy details. Validating your answer against the context is required.`;

// Response starter to prime grounded responses
export const RESPONSE_STARTER = 'Based on the SOP documentation, ';

// Fallback response when info isn't available
export const NO_INFO_RESPONSE = 'This information is not available in the current SOPs.';

// Build the full prompt template
export function buildPrompt(
  acronymContext: string,
  sopContext: string,
  question: string
): string {
  return `<|im_start|>system
${SYSTEM_PROMPT}
<|im_end|>
<|im_start|>user
=== ACRONYM REFERENCE ===
${acronymContext || 'No acronyms loaded.'}

=== SOP CONTEXT ===
${sopContext}

=== QUESTION ===
${question}

Provide your answer based ONLY on the context above:
<|im_end|>
<|im_start|>assistant
${RESPONSE_STARTER}`;
}

// Confidence assessment prompt
export function buildConfidencePrompt(
  question: string,
  answer: string,
  contextSnippet: string
): string {
  return `<|im_start|>system
You evaluate answer quality. Rate from 0.0 to 1.0 only.
<|im_end|>
<|im_start|>user
Question: ${question}
Context: ${contextSnippet.substring(0, 400)}...
Answer: ${answer.substring(0, 300)}

Rate confidence (0.0-1.0). Consider: Does context support the answer? Is it complete?
Reply with ONLY a number:
<|im_end|>
<|im_start|>assistant
`;
}

// Format acronyms for prompt injection
export function formatAcronymsForPrompt(acronyms: Acronym[]): string {
  if (!acronyms || acronyms.length === 0) {
    return 'No acronyms loaded.';
  }

  const lines = acronyms.map(a => `• ${a.abbreviation}: ${a.fullForm}`);
  return lines.join('\n');
}
