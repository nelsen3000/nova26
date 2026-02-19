// ASO Optimizer — R19-01
// App Store Optimization: keywords, subtitle, description, category suggestions

import type { ASOOptimizer } from './types.js';

export interface KeywordAnalysis {
  keyword: string;
  volume: number; // 0-100
  difficulty: number; // 0-100
  relevance: number; // 0-1
  competition: 'low' | 'medium' | 'high';
}

export interface CategorySuggestion {
  name: string;
  relevance: number;
  competition: 'low' | 'medium' | 'high';
  averageRating: number;
}

export class ASOOptimizerEngine {
  private keywords: Map<string, KeywordAnalysis> = new Map();
  private categories: CategorySuggestion[] = [];

  analyzeKeywords(
    appDescription: string,
    competitorKeywords: string[],
    _locale: string = 'en-US'
  ): KeywordAnalysis[] {
    // Extract potential keywords from description
    const words = appDescription.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
    
    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }

    const analysis: KeywordAnalysis[] = [];
    
    for (const [word, freq] of wordFreq.entries()) {
      const volume = Math.min(freq * 10, 100);
      const difficulty = this.calculateDifficulty(word, competitorKeywords);
      const relevance = this.calculateRelevance(word, appDescription);
      
      const keywordAnalysis: KeywordAnalysis = {
        keyword: word,
        volume,
        difficulty,
        relevance,
        competition: difficulty > 70 ? 'high' : difficulty > 40 ? 'medium' : 'low',
      };
      
      this.keywords.set(word, keywordAnalysis);
      analysis.push(keywordAnalysis);
    }

    return analysis.sort((a, b) => 
      (b.volume * b.relevance) - (a.volume * a.relevance)
    );
  }

  generateSubtitle(
    appName: string,
    keywords: string[],
    maxLength: number = 30
  ): string {
    const baseSubtitle = keywords.slice(0, 3).join(' · ');
    
    if (baseSubtitle.length <= maxLength) {
      return baseSubtitle;
    }
    
    // Truncate intelligently
    return keywords[0]?.slice(0, maxLength - 3) + '...' || appName;
  }

  generateDescription(
    features: string[],
    keywords: string[],
    _locale: string = 'en-US'
  ): string {
    const paragraphs: string[] = [];
    
    // Opening paragraph
    paragraphs.push(
      features.slice(0, 2).join('. ') + '.'
    );
    
    // Feature list
    paragraphs.push(
      'Key Features:\n' + 
      features.map(f => `• ${f}`).join('\n')
    );
    
    // Keywords paragraph (SEO)
    paragraphs.push(
      'Keywords: ' + keywords.slice(0, 8).join(', ')
    );
    
    return paragraphs.join('\n\n');
  }

  suggestCategories(
    appDescription: string,
    _features: string[]
  ): CategorySuggestion[] {
    const categoryKeywords: Record<string, string[]> = {
      'Productivity': ['task', 'schedule', 'organize', 'manage', 'work'],
      'Social Networking': ['chat', 'share', 'connect', 'friend', 'community'],
      'Entertainment': ['game', 'play', 'fun', 'watch', 'stream'],
      'Utilities': ['tool', 'calculate', 'convert', 'measure', 'track'],
      'Lifestyle': ['health', 'fitness', 'food', 'travel', 'shopping'],
    };

    const suggestions: CategorySuggestion[] = [];
    const descLower = appDescription.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const matches = keywords.filter(k => descLower.includes(k)).length;
      const relevance = matches / keywords.length;
      
      if (relevance > 0.3) {
        suggestions.push({
          name: category,
          relevance,
          competition: 'medium',
          averageRating: 4.2,
        });
      }
    }

    this.categories = suggestions.sort((a, b) => b.relevance - a.relevance);
    return this.categories;
  }

  calculateProjectedScore(
    keywords: KeywordAnalysis[],
    _category: string,
    ratings: { average: number; count: number }
  ): number {
    const keywordScore = keywords.slice(0, 7).reduce(
      (sum, k) => sum + (k.volume * k.relevance * (1 - k.difficulty / 100)),
      0
    ) / 7;

    const ratingScore = (ratings.average / 5) * 30;
    const volumeScore = Math.min(ratings.count / 1000, 20);

    const total = (keywordScore * 0.5) + ratingScore + volumeScore;
    return Math.min(Math.round(total), 100);
  }

  optimizeForLocale(
    optimizer: ASOOptimizer,
    targetLocale: string
  ): ASOOptimizer {
    // Return localized version
    return {
      ...optimizer,
      locale: targetLocale,
      keywords: optimizer.keywords.map(k => 
        this.translateKeyword(k, targetLocale)
      ),
    };
  }

  detectDuplicateKeywords(keywords: string[]): string[] {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    
    for (const kw of keywords) {
      const normalized = kw.toLowerCase().trim();
      if (seen.has(normalized)) {
        duplicates.push(kw);
      }
      seen.add(normalized);
    }
    
    return duplicates;
  }

  private calculateDifficulty(word: string, competitorKeywords: string[]): number {
    const competitorsUsing = competitorKeywords.filter(
      k => k.toLowerCase().includes(word)
    ).length;
    return Math.min(competitorsUsing * 15, 100);
  }

  private calculateRelevance(word: string, description: string): number {
    const descLower = description.toLowerCase();
    const count = (descLower.match(new RegExp(word, 'g')) ?? []).length;
    return Math.min(count / 5, 1);
  }

  private translateKeyword(keyword: string, _locale: string): string {
    // Placeholder for translation logic
    return keyword;
  }
}

export function createASOOptimizer(): ASOOptimizerEngine {
  return new ASOOptimizerEngine();
}
