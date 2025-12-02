import { describe, it, expect, vi, beforeEach } from 'vitest';
import { URLDocumentProcessor } from '../url-document.processor.js';
import type { DocumentInput } from '../../../models/index.js';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('URLDocumentProcessor', () => {
  const processor = new URLDocumentProcessor();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject non-URL document types', async () => {
    const input: DocumentInput = {
      type: 'text',
      content: 'https://example.com',
      metadata: {
        title: 'Test',
        tags: [],
        createdAt: new Date(),
      },
    };

    await expect(processor.process(input)).rejects.toThrow(
      'URLDocumentProcessor can only process URL documents'
    );
  });

  it('should reject invalid URL format', async () => {
    const input: DocumentInput = {
      type: 'url',
      content: 'not-a-valid-url',
      metadata: {
        title: 'Test',
        tags: [],
        createdAt: new Date(),
      },
    };

    await expect(processor.process(input)).rejects.toThrow('Invalid URL format');
  });

  it('should handle unreachable URLs', async () => {
    const error = new Error('Network error');
    (error as any).code = 'ENOTFOUND';
    mockedAxios.get.mockRejectedValueOnce(error);
    mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

    const input: DocumentInput = {
      type: 'url',
      content: 'https://nonexistent-domain-12345.com',
      metadata: {
        title: 'Test',
        tags: [],
        createdAt: new Date(),
      },
    };

    await expect(processor.process(input)).rejects.toThrow('URL is unreachable');
  });

  it('should extract article content and metadata', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Article Title</title>
          <meta property="og:title" content="OG Title">
        </head>
        <body>
          <nav>Navigation</nav>
          <article>
            <h1>Article Heading</h1>
            <p>This is the main article content. It contains enough text to be considered valid article content. 
            We need to make sure it's long enough to pass the minimum length check of 100 characters.</p>
          </article>
          <footer>Footer content</footer>
        </body>
      </html>
    `;

    mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

    const input: DocumentInput = {
      type: 'url',
      content: 'https://example.com/article',
      metadata: {
        title: 'Fallback Title',
        tags: ['test'],
        createdAt: new Date(),
      },
    };

    const result = await processor.process(input);

    expect(result.id).toBeDefined();
    expect(result.content).toContain('main article content');
    expect(result.content).not.toContain('Navigation');
    expect(result.content).not.toContain('Footer');
    expect(result.metadata.title).toBe('OG Title');
    expect(result.metadata.url).toBe('https://example.com/article');
    expect(result.metadata.source).toBe('url');
    expect(result.extractedAt).toBeInstanceOf(Date);
  });

  it('should handle non-article content gracefully', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Short</title></head>
        <body><p>Too short</p></body>
      </html>
    `;

    mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

    const input: DocumentInput = {
      type: 'url',
      content: 'https://example.com/short',
      metadata: {
        title: 'Test',
        tags: [],
        createdAt: new Date(),
      },
    };

    await expect(processor.process(input)).rejects.toThrow(
      'URL does not contain sufficient article content'
    );
  });
});
