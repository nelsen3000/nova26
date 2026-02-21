// KMS-27: Visual Validator Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  takeScreenshots,
  validateVisually,
  formatVisualFeedback,
  type VisualValidationResult,
  type ScreenshotResult,
} from '../visual-validator.js';

// Mock child_process
const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
  execSync: (...args: any[]) => mockExecSync(...args),
}));

// Mock fs module
const mockExistsSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
  writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
}));

describe('Visual Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('takeScreenshots', () => {
    it('should return error when Playwright is not installed', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const results = await takeScreenshots('http://localhost:3000', 'test-task');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Playwright not installed');
    });

    it('should create screenshots directory if it does not exist', async () => {
      mockExistsSync.mockReturnValueOnce(false).mockReturnValue(true);
      mockExecSync
        .mockReturnValueOnce('Version 1.40.0') // playwright version check
        .mockReturnValueOnce(JSON.stringify({
          success: true,
          loadTime: 1500,
          consoleErrors: [],
        }))
        .mockReturnValueOnce(JSON.stringify({
          success: true,
          loadTime: 1200,
          consoleErrors: [],
        }))
        .mockReturnValueOnce(JSON.stringify({
          success: true,
          loadTime: 1000,
          consoleErrors: [],
        }));

      await takeScreenshots('http://localhost:3000', 'test-task');

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.nova/screenshots'),
        { recursive: true }
      );
    });

    it('should return results with correct structure when Playwright is not available', async () => {
      // When playwright is not available, function returns early with single result
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const results = await takeScreenshots('http://localhost:3000', 'test-task');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Playwright not installed');
    });

    it('should return correct structure for screenshot results', async () => {
      // When playwright is not available, the function returns early
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const results = await takeScreenshots('http://localhost:3000', 'test-task-2');

      // Verify result structure even when playwright is not available
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('success');
      expect(results[0]).toHaveProperty('width');
      expect(results[0]).toHaveProperty('height');
      expect(results[0]).toHaveProperty('consoleErrors');
      expect(results[0]).toHaveProperty('loadTime');
    });

    it('should handle missing directories correctly', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      await takeScreenshots('http://localhost:3000', 'test-task-3');

      // Should attempt to create screenshots directory
      expect(mockMkdirSync).toHaveBeenCalled();
    });

    it('should handle error in result correctly', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const results = await takeScreenshots('http://localhost:3000', 'test-task-4');

      // Should return error when playwright not available
      expect(results[0].error).toBe('Playwright not installed');
      expect(results[0].success).toBe(false);
    });
  });

  describe('validateVisually', () => {
    it('should pass validation for component with all best practices', async () => {
      const componentCode = `
        export function Button() {
          return (
            <button 
              className="sm:w-full md:w-auto transition-all animate-fade"
              aria-label="Submit"
              role="button"
              onClick={() => {}}
            >
              <img src="icon.png" alt="Icon" loading="lazy" />
              <span>Loading...</span>
              <span>Error occurred</span>
              <span>No data available</span>
            </button>
          );
        }
      `;

      const result = await validateVisually(componentCode, 'test-task');

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing responsive classes', async () => {
      const componentCode = `
        export function Button() {
          return <button>Click me</button>;
        }
      `;

      const result = await validateVisually(componentCode, 'test-task');

      expect(result.issues).toContain('No responsive Tailwind classes found (sm:, md:, lg:)');
      expect(result.score).toBeLessThan(100);
    });

    it('should detect missing accessibility attributes', async () => {
      const componentCode = `
        export function Button() {
          return <button className="sm:w-full">Click me</button>;
        }
      `;

      const result = await validateVisually(componentCode, 'test-task');

      expect(result.issues).toContain('No ARIA attributes found');
      expect(result.score).toBeLessThan(100);
    });

    it('should detect images without alt attributes', async () => {
      const componentCode = `
        export function Gallery() {
          return <img src="photo.jpg" className="sm:w-full" aria-label="Gallery" />;
        }
      `;

      const result = await validateVisually(componentCode, 'test-task');

      expect(result.issues).toContain('Images missing alt attributes');
    });

    it('should detect inline styles anti-pattern', async () => {
      const componentCode = `
        export function Button() {
          return <button style={{ color: 'red' }} className="sm:w-full" aria-label="Red">Click</button>;
        }
      `;

      const result = await validateVisually(componentCode, 'test-task');

      expect(result.issues).toContain('Inline styles detected — use Tailwind classes instead');
    });

    it('should detect div onClick anti-pattern', async () => {
      const componentCode = `
        export function Clickable() {
          return <div onClick={() => {}} className="sm:w-full" aria-label="Clickable">Click</div>;
        }
      `;

      const result = await validateVisually(componentCode, 'test-task');

      expect(result.issues).toContain('<div onClick> detected — use <button> for interactive elements');
    });

    it('should fail validation when score is below 70', async () => {
      const componentCode = `
        export function BadComponent() {
          return <div>Hello</div>;
        }
      `;

      const result = await validateVisually(componentCode, 'test-task');

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(70);
    });

    it('should detect missing loading, error, and empty states', async () => {
      const componentCode = `
        export function SimpleComponent() {
          return <div className="sm:w-full" aria-label="Simple">Hello</div>;
        }
      `;

      const result = await validateVisually(componentCode, 'test-task');

      expect(result.issues).toContain('No loading state detected');
      expect(result.issues).toContain('No error handling detected');
      expect(result.issues).toContain('No empty state detected');
    });
  });

  describe('formatVisualFeedback', () => {
    it('should format passed result correctly', () => {
      const result: VisualValidationResult = {
        passed: true,
        score: 85,
        issues: ['Minor issue 1'],
        screenshots: [],
      };

      const feedback = formatVisualFeedback(result);

      expect(feedback).toContain('Visual Validation: PASSED');
      expect(feedback).toContain('Score: 85/100');
      expect(feedback).toContain('Minor issue 1');
    });

    it('should format failed result correctly', () => {
      const result: VisualValidationResult = {
        passed: false,
        score: 50,
        issues: ['Major issue 1', 'Major issue 2'],
        screenshots: [],
      };

      const feedback = formatVisualFeedback(result);

      expect(feedback).toContain('Visual Validation: FAILED');
      expect(feedback).toContain('Score: 50/100');
    });

    it('should include screenshot information when available', () => {
      const result: VisualValidationResult = {
        passed: true,
        score: 90,
        issues: [],
        screenshots: [
          {
            success: true,
            width: 375,
            height: 812,
            screenshotPath: '/path/to/mobile.png',
            loadTime: 1200,
            consoleErrors: ['Console error'],
          },
        ],
      };

      const feedback = formatVisualFeedback(result);

      expect(feedback).toContain('Screenshots');
      expect(feedback).toContain('375x812');
      expect(feedback).toContain('OK');
      expect(feedback).toContain('1200ms');
    });

    it('should handle empty issues array', () => {
      const result: VisualValidationResult = {
        passed: true,
        score: 100,
        issues: [],
        screenshots: [],
      };

      const feedback = formatVisualFeedback(result);

      expect(feedback).toContain('PASSED');
      expect(feedback).not.toContain('Issues Found');
    });
  });
});
