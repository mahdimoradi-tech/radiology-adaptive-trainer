import { describe, it, expect } from 'vitest';
import { loadAllKbArticles, retrieveKbSnippets } from '../retrieval.js';

describe('Knowledge Base & Retrieval', () => {
  it('loads all 6 KB articles with reviewed=false and empty sources', () => {
    const articles = loadAllKbArticles();
    expect(articles).toHaveLength(6);

    const slugs = articles.map((a) => a.slug).sort();
    expect(slugs).toEqual([
      'covid19',
      'covid19-vs-normal',
      'covid19-vs-pneumonia',
      'normal',
      'pneumonia',
      'pneumonia-vs-normal',
    ]);

    for (const art of articles) {
      expect(art.reviewed).toBe(false);
      expect(art.sources).toEqual([]);
      expect(art.content.length).toBeGreaterThan(20);
    }
  });

  it('retrieval for (covid19, pneumonia) returns the pair file first, max 3 chunks', () => {
    const snippets = retrieveKbSnippets({
      classes: ['covid19', 'pneumonia'],
      limit: 3,
    });

    expect(snippets).toHaveLength(3);
    // The exact pair file MUST be ranked first
    expect(snippets[0].slug).toBe('covid19-vs-pneumonia');
    expect(snippets[0].reviewed).toBe(false);

    // Remaining top 2 should be the individual classes
    const remainingSlugs = [snippets[1].slug, snippets[2].slug].sort();
    expect(remainingSlugs).toEqual(['covid19', 'pneumonia']);
  });

  it('retrieval for single class (normal) returns normal as first result', () => {
    const snippets = retrieveKbSnippets({
      classes: ['normal'],
      limit: 3,
    });

    expect(snippets.length).toBeGreaterThan(0);
    expect(snippets[0].slug).toBe('normal');
  });
});
