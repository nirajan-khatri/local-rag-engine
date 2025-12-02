import type { EmbeddingService } from '../models/index.js';
import { config } from '../config/index.js';

/**
 * Ollama Embedding Service
 * Generates embeddings using Ollama's local embedding models
 */
export class OllamaEmbeddingService implements EmbeddingService {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly dimensions: number = 768; // nomic-embed-text dimensions

  constructor(
    baseUrl: string = config.ollama.baseUrl,
    model: string = config.ollama.embeddingModel
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as { embedding?: number[] };
      
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      return data.embedding;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate embedding: ${error.message}`);
      }
      throw new Error('Failed to generate embedding: Unknown error');
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      // Process in parallel for better performance
      const embeddings = await Promise.all(
        texts.map((text) => this.embed(text))
      );
      return embeddings;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate batch embeddings: ${error.message}`);
      }
      throw new Error('Failed to generate batch embeddings: Unknown error');
    }
  }

  /**
   * Get the dimensionality of the embeddings
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Check if Ollama is available and the model is loaded
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return false;

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = data.models?.map((m) => m.name) || [];
      
      return models.some((name) => name.includes(this.model));
    } catch (error) {
      return false;
    }
  }
}
