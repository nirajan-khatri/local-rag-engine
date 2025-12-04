import type { DocumentProcessor, DocumentInput, ProcessedDocument } from '../../models/index.js';
import { randomUUID } from 'crypto';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class URLDocumentProcessor implements DocumentProcessor {
  private readonly timeout = 10000;

  async process(input: DocumentInput): Promise<ProcessedDocument> {
    if (input.type !== 'url') {
      throw new Error('URLDocumentProcessor can only process URL documents');
    }

    const url = typeof input.content === 'string' 
      ? input.content 
      : input.content.toString('utf-8');

    if (!this.isValidUrl(url)) {
      throw new Error('Invalid URL format');
    }

    try {
      const html = await this.fetchWebpage(url);
      const extracted = this.extractArticle(html, url);
      
      if (!extracted.content || extracted.content.trim().length < 100) {
        throw new Error('URL does not contain sufficient article content. Content may be too short or not article-like.');
      }

      return {
        id: randomUUID(),
        content: extracted.content.trim(),
        metadata: {
          ...input.metadata,
          title: extracted.title || input.metadata.title,
          url: url,
          source: 'url',
        },
        extractedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('article content') || 
            error.message.includes('Invalid URL')) {
          throw error;
        }
        
        if (axios.isAxiosError(error)) {
          if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            throw new Error(`URL is unreachable: ${url}`);
          }
          if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            throw new Error(`Connection timeout while fetching URL: ${url}`);
          }
          if (error.response) {
            throw new Error(`Failed to fetch URL (HTTP ${error.response.status}): ${url}`);
          }
        }
        
        throw new Error(`Failed to process URL: ${error.message}`);
      }
      throw new Error('Failed to process URL: Unknown error');
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private async fetchWebpage(url: string): Promise<string> {
    const response = await axios.get(url, {
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PersonalKnowledgeBase/1.0)',
      },
      maxRedirects: 5,
    });

    return response.data;
  }

  private extractArticle(html: string, url: string): { title: string; content: string } {
    const $ = cheerio.load(html);

    $('script, style, nav, header, footer, aside, .advertisement, .ad, #comments').remove();

    let title = '';
    title = $('meta[property="og:title"]').attr('content') || '';
    if (!title) title = $('meta[name="twitter:title"]').attr('content') || '';
    if (!title) title = $('title').text() || '';
    if (!title) title = $('h1').first().text() || '';
    title = title.trim();

    let content = '';
    
    const articleSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',
    ];

    for (const selector of articleSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.text();
        if (content.trim().length > 100) {
          break;
        }
      }
    }

    if (!content || content.trim().length < 100) {
      content = $('body').text();
    }

    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    return { title, content };
  }
}
