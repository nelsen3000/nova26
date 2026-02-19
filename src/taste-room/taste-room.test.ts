// Tests for Taste Room Engine
// KIMI-VISIONARY-05

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TasteRoom, ALL_SECTIONS, type SwipeDirection, type TasteRoomSection } from './taste-room.js';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('TasteRoom', () => {
  let room: TasteRoom;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), 'nova-taste-room-test-' + Date.now());
    mkdirSync(tempDir, { recursive: true });
    room = new TasteRoom({ storagePath: tempDir });
    await room.initTasteRoom();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('initTasteRoom', () => {
    it('initializes taste room with default config', async () => {
      const newRoom = new TasteRoom({ storagePath: join(tempDir, 'init-test') });
      await expect(newRoom.initTasteRoom()).resolves.not.toThrow();
    });

    it('creates storage directory', async () => {
      const storagePath = join(tempDir, 'new-storage');
      const newRoom = new TasteRoom({ storagePath });
      
      await newRoom.initTasteRoom();
      
      expect(existsSync(storagePath)).toBe(true);
    });

    it('loads baseline collection', async () => {
      const cards = room.getCards('buttons');
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe('getCards', () => {
    it('gets cards by section', () => {
      const buttonCards = room.getCards('buttons');
      const cardCards = room.getCards('cards');

      expect(buttonCards.every(c => c.section === 'buttons')).toBe(true);
      expect(cardCards.every(c => c.section === 'cards')).toBe(true);
    });

    it('gets cards filtered by device', () => {
      const cards = room.getCards('buttons', 'mobile');

      expect(cards.length).toBeGreaterThan(0);
      expect(cards.every(c => 'mobile' in c.devicePreviews)).toBe(true);
    });

    it('respects limit parameter', () => {
      const cards = room.getCards('buttons', undefined, 2);

      expect(cards.length).toBeLessThanOrEqual(2);
    });

    it('cards have device previews for all three devices', () => {
      const cards = room.getCards('buttons');

      for (const card of cards) {
        expect(card.devicePreviews).toHaveProperty('mobile');
        expect(card.devicePreviews).toHaveProperty('tablet');
        expect(card.devicePreviews).toHaveProperty('desktop');
      }
    });
  });

  describe('getCard', () => {
    it('gets single card by ID', () => {
      const cards = room.getCards('buttons');
      const firstCard = cards[0];

      const retrieved = room.getCard(firstCard.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(firstCard.id);
    });

    it('returns undefined for non-existent card', () => {
      const retrieved = room.getCard('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('recordSwipe', () => {
    function getFirstCardId(): string {
      const cards = room.getCards('buttons');
      return cards[0].id;
    }

    it('records a right swipe (love)', () => {
      const event = room.recordSwipe({
        cardId: getFirstCardId(),
        direction: 'right',
        section: 'buttons',
        device: 'desktop',
      });

      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.direction).toBe('right');
    });

    it('records a left swipe (dislike)', () => {
      const event = room.recordSwipe({
        cardId: getFirstCardId(),
        direction: 'left',
        section: 'buttons',
        device: 'mobile',
      });

      expect(event.direction).toBe('left');
    });

    it('records an up swipe (inspiration board)', () => {
      const cardId = getFirstCardId();
      
      room.recordSwipe({
        cardId,
        direction: 'up',
        section: 'buttons',
        device: 'tablet',
      });

      const board = room.getInspirationBoard();
      expect(board.cards.some(c => c.id === cardId)).toBe(true);
    });

    it('records a down swipe', () => {
      const event = room.recordSwipe({
        cardId: getFirstCardId(),
        direction: 'down',
        section: 'buttons',
        device: 'desktop',
      });

      expect(event.direction).toBe('down');
    });
  });

  describe('getSwipeHistory', () => {
    it('gets swipe history', () => {
      const cards = room.getCards('buttons');
      
      room.recordSwipe({ cardId: cards[0].id, direction: 'right', section: 'buttons', device: 'desktop' });
      room.recordSwipe({ cardId: cards[1].id, direction: 'left', section: 'buttons', device: 'mobile' });
      room.recordSwipe({ cardId: cards[2].id, direction: 'up', section: 'buttons', device: 'tablet' });

      const history = room.getSwipeHistory();

      expect(history.length).toBe(3);
    });

    it('swipe history respects limit', () => {
      const cards = room.getCards('buttons');
      
      for (let i = 0; i < 5; i++) {
        room.recordSwipe({ 
          cardId: cards[i % cards.length].id, 
          direction: 'right', 
          section: 'buttons', 
          device: 'desktop' 
        });
      }

      const history = room.getSwipeHistory(2);

      expect(history.length).toBe(2);
    });

    it('swipe history is ordered by timestamp descending', () => {
      const cards = room.getCards('buttons');
      
      room.recordSwipe({ cardId: cards[0].id, direction: 'right', section: 'buttons', device: 'desktop' });
      room.recordSwipe({ cardId: cards[1].id, direction: 'left', section: 'buttons', device: 'mobile' });

      const history = room.getSwipeHistory();

      expect(new Date(history[0].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(history[1].timestamp).getTime()
      );
    });
  });

  describe('getCuratedFeed', () => {
    it('curated feed returns cards', () => {
      const feed = room.getCuratedFeed();

      expect(feed).toBeDefined();
      expect(feed.cards.length).toBeGreaterThan(0);
      expect(feed.generatedAt).toBeDefined();
      expect(feed.basedOnSwipeCount).toBe(0);
      expect(feed.confidenceScore).toBe(0);
    });

    it('curated feed confidence increases with more swipes', () => {
      const cards = room.getCards('buttons');
      
      // Record 10 swipes
      for (let i = 0; i < 10; i++) {
        room.recordSwipe({
          cardId: cards[i % cards.length].id,
          direction: 'right',
          section: 'buttons',
          device: 'desktop',
        });
      }

      const feed1 = room.getCuratedFeed();
      expect(feed1.confidenceScore).toBe(0.1); // 10/100

      // Record 90 more swipes
      for (let i = 0; i < 90; i++) {
        room.recordSwipe({
          cardId: cards[(i + 10) % cards.length].id,
          direction: 'right',
          section: 'buttons',
          device: 'desktop',
        });
      }

      const feed2 = room.getCuratedFeed();
      expect(feed2.confidenceScore).toBe(1); // Capped at 1
    });
  });

  describe('getInspirationBoard', () => {
    it('inspiration board contains only up-swiped cards', () => {
      const cards = room.getCards('buttons');
      if (cards.length < 3) return;
      
      // Swipe 3 cards up, 2 right, 1 left (using available cards)
      room.recordSwipe({ cardId: cards[0].id, direction: 'up', section: 'buttons', device: 'desktop' });
      room.recordSwipe({ cardId: cards[1].id, direction: 'up', section: 'buttons', device: 'desktop' });
      room.recordSwipe({ cardId: cards[2].id, direction: 'up', section: 'buttons', device: 'desktop' });
      
      if (cards.length > 3) {
        room.recordSwipe({ cardId: cards[3].id, direction: 'right', section: 'buttons', device: 'desktop' });
      }
      if (cards.length > 4) {
        room.recordSwipe({ cardId: cards[4].id, direction: 'right', section: 'buttons', device: 'desktop' });
      }

      const board = room.getInspirationBoard();
      expect(board.cards.length).toBe(3);
    });
  });

  describe('generateVariations', () => {
    it('generates variations from a card', async () => {
      const cards = room.getCards('buttons');
      const sourceCard = cards[0];

      const variations = await room.generateVariations(sourceCard.id, 4);

      expect(variations.length).toBe(4);
      expect(variations.every(v => v.sourceCollection === 'generated')).toBe(true);
      expect(variations[0].section).toBe(sourceCard.section);
    });

    it('throws when card not found', async () => {
      await expect(room.generateVariations('non-existent')).rejects.toThrow('Card not found');
    });
  });

  describe('getSectionStats', () => {
    it('section stats track likes and dislikes correctly', () => {
      const cards = room.getCards('buttons');
      if (cards.length < 3) return;
      
      // Swipe right (liked) and left (disliked) in buttons section
      room.recordSwipe({ cardId: cards[0].id, direction: 'right', section: 'buttons', device: 'desktop' });
      room.recordSwipe({ cardId: cards[1].id, direction: 'right', section: 'buttons', device: 'desktop' });
      room.recordSwipe({ cardId: cards[2].id, direction: 'right', section: 'buttons', device: 'desktop' });
      
      if (cards.length > 3) {
        room.recordSwipe({ cardId: cards[3].id, direction: 'left', section: 'buttons', device: 'desktop' });
      }
      if (cards.length > 4) {
        room.recordSwipe({ cardId: cards[4].id, direction: 'left', section: 'buttons', device: 'desktop' });
      }

      const stats = room.getSectionStats();

      expect(stats.buttons.liked).toBe(3);
      expect(stats.buttons.disliked).toBe(cards.length > 4 ? 2 : cards.length > 3 ? 1 : 0);
      expect(stats.buttons.total).toBeGreaterThan(0);
    });
  });

  describe('getPreferenceVector', () => {
    it('preference vector updates after swipes', () => {
      const cards = room.getCards('buttons');
      
      expect(room.getPreferenceVector()).toEqual([]);

      room.recordSwipe({ cardId: cards[0].id, direction: 'right', section: 'buttons', device: 'desktop' });

      expect(room.getPreferenceVector().length).toBeGreaterThan(0);
    });
  });

  describe('resetPreferences', () => {
    it('reset preferences clears history', () => {
      const cards = room.getCards('buttons');
      
      room.recordSwipe({ cardId: cards[0].id, direction: 'right', section: 'buttons', device: 'desktop' });
      room.recordSwipe({ cardId: cards[1].id, direction: 'up', section: 'buttons', device: 'desktop' });

      expect(room.getSwipeHistory().length).toBeGreaterThan(0);
      expect(room.getPreferenceVector().length).toBeGreaterThan(0);
      expect(room.getInspirationBoard().cards.length).toBeGreaterThan(0);

      room.resetPreferences();

      expect(room.getSwipeHistory()).toEqual([]);
      expect(room.getPreferenceVector()).toEqual([]);
      expect(room.getInspirationBoard().cards).toEqual([]);
    });
  });

  describe('ALL_SECTIONS', () => {
    it('section list includes all 16 sections', () => {
      expect(ALL_SECTIONS.length).toBe(16);
      expect(ALL_SECTIONS).toContain('buttons');
      expect(ALL_SECTIONS).toContain('cards');
      expect(ALL_SECTIONS).toContain('navigation');
      expect(ALL_SECTIONS).toContain('full-pages');
    });
  });
});
