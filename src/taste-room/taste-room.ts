// Taste Room Engine — Infinite personalized visual design library
// KIMI-VISIONARY-05: R16-10 spec

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type SwipeDirection = 'right' | 'left' | 'up' | 'down';

export type TasteRoomSection =
  | 'buttons' | 'toggles' | 'switches' | 'fonts' | 'colors'
  | 'backgrounds' | 'cards' | 'inputs' | 'navigation'
  | 'modals' | 'tables' | 'loading-states' | 'empty-states'
  | 'heroes' | 'footers' | 'full-pages';

export type DevicePreview = 'mobile' | 'tablet' | 'desktop';

export interface TasteRoomConfig {
  storagePath: string;           // default: '.nova/taste-room'
  baselineCollectionSize: number;// default: 500
  curatedFeedSize: number;       // default: 20
  refreshInterval: 'daily' | 'weekly' | 'manual';
  sections: TasteRoomSection[];  // which sections to show
}

export interface TasteCard {
  id: string;
  section: TasteRoomSection;
  title: string;
  description: string;
  previewHtml: string;           // the component preview markup
  tags: string[];
  sourceCollection: 'baseline' | 'generated' | 'community';
  devicePreviews: Record<DevicePreview, string>; // HTML per device size
  metadata: Record<string, unknown>;
}

export interface SwipeEvent {
  id: string;
  cardId: string;
  direction: SwipeDirection;
  section: TasteRoomSection;
  device: DevicePreview;
  timestamp: string;
}

export interface CuratedFeed {
  cards: TasteCard[];
  generatedAt: string;
  basedOnSwipeCount: number;     // how many swipes informed this feed
  confidenceScore: number;       // 0-1, how confident the curation is
}

export interface InspirationBoard {
  id: string;
  cards: TasteCard[];            // cards swiped up
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

export const ALL_SECTIONS: TasteRoomSection[] = [
  'buttons', 'toggles', 'switches', 'fonts', 'colors',
  'backgrounds', 'cards', 'inputs', 'navigation',
  'modals', 'tables', 'loading-states', 'empty-states',
  'heroes', 'footers', 'full-pages',
];

// ============================================================================
// Zod Schemas
// ============================================================================

export const TasteRoomConfigSchema = z.object({
  storagePath: z.string().default('.nova/taste-room'),
  baselineCollectionSize: z.number().int().positive().default(500),
  curatedFeedSize: z.number().int().positive().default(20),
  refreshInterval: z.enum(['daily', 'weekly', 'manual']).default('manual'),
  sections: z.array(z.enum(ALL_SECTIONS as [string, ...string[]])).default(ALL_SECTIONS),
});

export const TasteCardSchema = z.object({
  id: z.string(),
  section: z.enum(ALL_SECTIONS as [string, ...string[]]),
  title: z.string(),
  description: z.string(),
  previewHtml: z.string(),
  tags: z.array(z.string()),
  sourceCollection: z.enum(['baseline', 'generated', 'community']),
  devicePreviews: z.record(z.string()),
  metadata: z.record(z.unknown()),
});

export const SwipeEventSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  direction: z.enum(['right', 'left', 'up', 'down']),
  section: z.enum(ALL_SECTIONS as [string, ...string[]]),
  device: z.enum(['mobile', 'tablet', 'desktop']),
  timestamp: z.string(),
});

export const CuratedFeedSchema = z.object({
  cards: z.array(TasteCardSchema),
  generatedAt: z.string(),
  basedOnSwipeCount: z.number(),
  confidenceScore: z.number().min(0).max(1),
});

export const InspirationBoardSchema = z.object({
  id: z.string(),
  cards: z.array(TasteCardSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: TasteRoomConfig = {
  storagePath: '.nova/taste-room',
  baselineCollectionSize: 500,
  curatedFeedSize: 20,
  refreshInterval: 'manual',
  sections: ALL_SECTIONS,
};

// ============================================================================
// TasteRoom Class
// ============================================================================

export class TasteRoom {
  private config: TasteRoomConfig;
  private cards: Map<string, TasteCard> = new Map();
  private swipeHistory: SwipeEvent[] = [];
  private inspirationBoard: InspirationBoard;
  private preferenceVector: number[] = [];

  constructor(config?: Partial<TasteRoomConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.inspirationBoard = {
      id: crypto.randomUUID(),
      cards: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // ---- Initialization ----

  async initTasteRoom(config?: Partial<TasteRoomConfig>): Promise<void> {
    const initConfig = { ...this.config, ...config };

    // Create storage directory
    if (!existsSync(initConfig.storagePath)) {
      mkdirSync(initConfig.storagePath, { recursive: true });
    }

    // Load baseline collection
    await this.loadBaselineCollection();

    // Load inspiration board from storage if exists
    this.loadInspirationBoard();

    this.config = initConfig;
  }

  private async loadBaselineCollection(): Promise<void> {
    // In production, this would load from a file or API
    // For tests, generate mock baseline cards
    const mockCards = this.generateMockBaselineCards();
    
    for (const card of mockCards) {
      this.cards.set(card.id, card);
    }
  }

  private generateMockBaselineCards(): TasteCard[] {
    const cards: TasteCard[] = [];
    const sections = this.config.sections;

    // Generate a few cards per section for testing
    for (const section of sections) {
      const count = Math.min(3, this.config.baselineCollectionSize / sections.length);
      
      for (let i = 0; i < count; i++) {
        cards.push(this.createMockCard(section, i));
      }
    }

    return cards;
  }

  private createMockCard(section: TasteRoomSection, index: number): TasteCard {
    const id = crypto.randomUUID();
    
    return {
      id,
      section,
      title: `${this.capitalize(section)} ${index + 1}`,
      description: `A ${section} component design`,
      previewHtml: `<div class="${section}">Preview of ${section}</div>`,
      tags: [section, 'baseline', `variant-${index + 1}`],
      sourceCollection: 'baseline',
      devicePreviews: {
        mobile: `<div class="${section} mobile">Mobile ${section}</div>`,
        tablet: `<div class="${section} tablet">Tablet ${section}</div>`,
        desktop: `<div class="${section} desktop">Desktop ${section}</div>`,
      },
      metadata: { index, section },
    };
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private loadInspirationBoard(): void {
    const boardPath = join(this.config.storagePath, 'inspiration-board.json');
    
    if (existsSync(boardPath)) {
      try {
        const content = readFileSync(boardPath, 'utf-8');
        const parsed = JSON.parse(content);
        const validated = InspirationBoardSchema.parse(parsed);
        // Cast cards to ensure correct typing
        this.inspirationBoard = {
          ...validated,
          cards: validated.cards.map(c => ({ ...c, section: c.section as TasteRoomSection })),
        };
      } catch (error) {
        console.warn('TasteRoom: failed to load inspiration board:', error);
      }
    }
  }

  private saveInspirationBoard(): void {
    const boardPath = join(this.config.storagePath, 'inspiration-board.json');
    this.inspirationBoard.updatedAt = new Date().toISOString();
    writeFileSync(boardPath, JSON.stringify(this.inspirationBoard, null, 2));
  }

  // ---- Card Access ----

  getCards(section: TasteRoomSection, device?: DevicePreview, limit?: number): TasteCard[] {
    let cards = Array.from(this.cards.values()).filter(c => c.section === section);

    if (device) {
      cards = cards.filter(c => device in c.devicePreviews);
    }

    if (limit !== undefined) {
      cards = cards.slice(0, limit);
    }

    return cards;
  }

  getCard(cardId: string): TasteCard | undefined {
    return this.cards.get(cardId);
  }

  // ---- Swipe Handling ----

  recordSwipe(event: Omit<SwipeEvent, 'id' | 'timestamp'>): SwipeEvent {
    const fullEvent: SwipeEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    this.swipeHistory.push(fullEvent);

    // Update preference vector based on direction
    this.updatePreferenceVector(event.direction, event.cardId);

    // Handle special directions
    if (event.direction === 'up') {
      // Add to inspiration board
      const card = this.cards.get(event.cardId);
      if (card) {
        this.inspirationBoard.cards.push(card);
        this.saveInspirationBoard();
      }
    }

    return fullEvent;
  }

  private updatePreferenceVector(direction: SwipeDirection, cardId: string): void {
    const card = this.cards.get(cardId);
    if (!card) return;

    // Weight by direction
    const weights: Record<SwipeDirection, number> = {
      right: 2,   // Love: strong positive
      left: -1,   // Dislike: negative
      up: 1,      // Inspiration: mild positive
      down: 0,    // Variations: neutral
    };

    const weight = weights[direction];
    
    // Simple preference vector: encode section and tags as numeric signals
    const sectionIndex = ALL_SECTIONS.indexOf(card.section);
    const signal = weight * (sectionIndex + 1);

    this.preferenceVector.push(signal);
  }

  getSwipeHistory(limit?: number): SwipeEvent[] {
    const history = [...this.swipeHistory].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (limit !== undefined) {
      return history.slice(0, limit);
    }

    return history;
  }

  // ---- Curated Feed ----

  getCuratedFeed(): CuratedFeed {
    const swipeCount = this.swipeHistory.length;
    const confidenceScore = Math.min(1, swipeCount / 100);

    let feedCards: TasteCard[];

    if (swipeCount === 0) {
      // Random selection from baseline
      feedCards = this.getRandomCards(this.config.curatedFeedSize);
    } else {
      // Rank by preference match
      feedCards = this.rankCardsByPreference(this.config.curatedFeedSize);
    }

    return {
      cards: feedCards,
      generatedAt: new Date().toISOString(),
      basedOnSwipeCount: swipeCount,
      confidenceScore,
    };
  }

  private getRandomCards(count: number): TasteCard[] {
    const allCards = Array.from(this.cards.values());
    const shuffled = [...allCards].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private rankCardsByPreference(count: number): TasteCard[] {
    // Simple ranking: prefer cards from sections with positive signals
    const allCards = Array.from(this.cards.values());
    
    // Calculate section scores
    const sectionScores: Record<string, number> = {};
    
    for (const event of this.swipeHistory) {
      const card = this.cards.get(event.cardId);
      if (card) {
        const weights: Record<SwipeDirection, number> = {
          right: 2, left: -1, up: 1, down: 0,
        };
        sectionScores[card.section] = (sectionScores[card.section] || 0) + weights[event.direction];
      }
    }

    // Sort cards by section score
    const ranked = allCards.sort((a, b) => {
      const scoreA = sectionScores[a.section] || 0;
      const scoreB = sectionScores[b.section] || 0;
      return scoreB - scoreA;
    });

    return ranked.slice(0, count);
  }

  // ---- Inspiration Board ----

  getInspirationBoard(): InspirationBoard {
    return this.inspirationBoard;
  }

  // ---- Variations ----

  async generateVariations(cardId: string, count: number = 4): Promise<TasteCard[]> {
    const sourceCard = this.cards.get(cardId);
    if (!sourceCard) {
      throw new Error(`Card not found: ${cardId}`);
    }

    const variations: TasteCard[] = [];

    for (let i = 0; i < count; i++) {
      const variation: TasteCard = {
        id: crypto.randomUUID(),
        section: sourceCard.section as TasteRoomSection,
        title: `${sourceCard.title} (Variation ${i + 1})`,
        description: `Variation of ${sourceCard.title}`,
        previewHtml: `<div class="${sourceCard.section} variation">Variation ${i + 1} of ${sourceCard.title}</div>`,
        tags: [...sourceCard.tags, 'variation'],
        sourceCollection: 'generated',
        devicePreviews: {
          mobile: `<div class="${sourceCard.section} variation mobile">Mobile Variation ${i + 1}</div>`,
          tablet: `<div class="${sourceCard.section} variation tablet">Tablet Variation ${i + 1}</div>`,
          desktop: `<div class="${sourceCard.section} variation desktop">Desktop Variation ${i + 1}</div>`,
        },
        metadata: { sourceCardId: cardId, variationIndex: i },
      };

      this.cards.set(variation.id, variation);
      variations.push(variation);
    }

    return variations;
  }

  // ---- Stats ----

  getSectionStats(): Record<TasteRoomSection, { total: number; liked: number; disliked: number }> {
    const stats = {} as Record<TasteRoomSection, { total: number; liked: number; disliked: number }>;

    // Initialize all sections
    for (const section of ALL_SECTIONS) {
      stats[section] = { total: 0, liked: 0, disliked: 0 };
    }

    // Count cards per section
    for (const card of this.cards.values()) {
      if (card.sourceCollection === 'baseline') {
        stats[card.section].total++;
      }
    }

    // Count swipes per section
    for (const event of this.swipeHistory) {
      const card = this.cards.get(event.cardId);
      if (card) {
        if (event.direction === 'right') {
          stats[card.section].liked++;
        } else if (event.direction === 'left') {
          stats[card.section].disliked++;
        }
      }
    }

    return stats;
  }

  getPreferenceVector(): number[] {
    return [...this.preferenceVector];
  }

  resetPreferences(): void {
    this.swipeHistory = [];
    this.preferenceVector = [];
    this.inspirationBoard.cards = [];
    this.inspirationBoard.updatedAt = new Date().toISOString();
    this.saveInspirationBoard();
  }
}
