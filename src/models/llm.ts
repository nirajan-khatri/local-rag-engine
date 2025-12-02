/**
 * LLM-related types and interfaces
 */

export interface GenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * LLM Service Interface
 * Interfaces with language models for answer generation
 */
export interface LLMService {
  /**
   * Generate text based on a prompt
   */
  generate(prompt: string, options?: GenerationOptions): Promise<string>;
}
