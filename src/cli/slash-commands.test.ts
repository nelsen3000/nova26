// Unit tests for slash-commands.ts
// Tests all slash command handlers with mocked dependencies

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module
const mockExecSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockGeneratePRD = vi.fn();
const mockCallLLM = vi.fn();
const mockListSkills = vi.fn();
const mockHandleTemplateCommand = vi.fn();
const mockQuickSecurityScan = vi.fn();
const mockFormatSecurityReport = vi.fn();
const mockGetSpendingReport = vi.fn();
const mockFormatReport = vi.fn();
const mockGetTodaySpending = vi.fn();
const mockGetCacheStats = vi.fn();
const mockFormatCacheStats = vi.fn();
const mockStartPreviewServer = vi.fn();
const mockPreviewComponent = vi.fn();
const mockProcessExit = vi.fn();

vi.mock('child_process', () => ({
  execSync: mockExecSync,
}));

vi.mock('fs', () => ({
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  readdirSync: mockReaddirSync,
}));

vi.mock('../agents/sun-prd-generator.js', () => ({
  generatePRD: mockGeneratePRD,
}));

vi.mock('../llm/ollama-client.js', () => ({
  callLLM: mockCallLLM,
}));

vi.mock('../skills/skill-loader.js', () => ({
  listSkills: mockListSkills,
}));

vi.mock('../template/template-engine.js', () => ({
  handleTemplateCommand: mockHandleTemplateCommand,
}));

vi.mock('../security/security-scanner.js', () => ({
  quickSecurityScan: mockQuickSecurityScan,
  formatSecurityReport: mockFormatSecurityReport,
}));

vi.mock('../cost/cost-tracker.js', () => ({
  getSpendingReport: mockGetSpendingReport,
  formatReport: mockFormatReport,
  getTodaySpending: mockGetTodaySpending,
}));

vi.mock('../llm/response-cache.js', () => ({
  getCacheStats: mockGetCacheStats,
  formatCacheStats: mockFormatCacheStats,
}));

vi.mock('../preview/server.js', () => ({
  startPreviewServer: mockStartPreviewServer,
  previewComponent: mockPreviewComponent,
}));

// Mock process.exit
Object.defineProperty(process, 'exit', {
  value: mockProcessExit,
  writable: true,
});

// Import after mocking
const { slashCommands, executeSlashCommand } = await import('./slash-commands.js');

describe('slash-commands', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('/fix command', () => {
    it('should show success message when no TypeScript errors', async () => {
      mockExecSync.mockReturnValue('');
      
      const command = slashCommands['/fix'];
      await command.handler([]);
      
      expect(mockExecSync).toHaveBeenCalledWith('npx tsc --noEmit', { stdio: 'inherit' });
      expect(consoleSpy).toHaveBeenCalledWith('🔧 Checking for TypeScript errors...\n');
      expect(consoleSpy).toHaveBeenCalledWith('✅ No errors found!');
    });

    it('should show MARS help message when TypeScript errors found', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('TypeScript errors');
      });
      
      const command = slashCommands['/fix'];
      await command.handler([]);
      
      expect(mockExecSync).toHaveBeenCalledWith('npx tsc --noEmit', { stdio: 'inherit' });
      expect(consoleSpy).toHaveBeenCalledWith('\n🤖 Asking MARS for fixes...');
    });
  });

  describe('/commit command', () => {
    it('should generate commit message from staged changes', async () => {
      mockExecSync.mockReturnValue('diff --git a/file.ts b/file.ts\n+change');
      mockCallLLM.mockResolvedValue({ content: 'feat: add new feature', model: 'test', duration: 100, tokens: 10 });
      
      const command = slashCommands['/commit'];
      await command.handler([]);
      
      expect(mockExecSync).toHaveBeenCalledWith('git diff --cached', { encoding: 'utf-8' });
      expect(mockCallLLM).toHaveBeenCalledWith(
        'Generate conventional commit message',
        expect.any(String),
        'SUN'
      );
      expect(consoleSpy).toHaveBeenCalledWith('\n💬 feat: add new feature');
    });

    it('should show warning when no staged changes', async () => {
      mockExecSync.mockReturnValue('   ');
      
      const command = slashCommands['/commit'];
      await command.handler([]);
      
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ No staged changes');
      expect(mockCallLLM).not.toHaveBeenCalled();
    });
  });

  describe('/generate command', () => {
    it('should generate PRD and save to file', async () => {
      const mockPRD = { meta: { name: 'Test' }, tasks: [] };
      mockGeneratePRD.mockResolvedValue(mockPRD);
      
      const command = slashCommands['/generate'];
      await command.handler(['build', 'login', 'system']);
      
      expect(mockGeneratePRD).toHaveBeenCalledWith('build login system');
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.nova/generated-'),
        JSON.stringify(mockPRD, null, 2)
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Saved to .nova/'));
    });
  });

  describe('/preview command', () => {
    it('should start preview server without component', async () => {
      const command = slashCommands['/preview'];
      await command.handler([]);
      
      expect(mockStartPreviewServer).toHaveBeenCalled();
      expect(mockPreviewComponent).not.toHaveBeenCalled();
    });

    it('should preview specific component when --component flag provided', async () => {
      const command = slashCommands['/preview'];
      await command.handler(['--component', 'Button']);
      
      expect(mockPreviewComponent).toHaveBeenCalledWith('Button');
      expect(mockStartPreviewServer).not.toHaveBeenCalled();
    });
  });

  describe('/template command', () => {
    it('should call handleTemplateCommand with args', async () => {
      const command = slashCommands['/template'];
      await command.handler(['show', 'MARS']);
      
      expect(mockHandleTemplateCommand).toHaveBeenCalledWith(['show', 'MARS']);
    });

    it('should call handleTemplateCommand with empty args for list', async () => {
      const command = slashCommands['/template'];
      await command.handler([]);

      expect(mockHandleTemplateCommand).toHaveBeenCalledWith(['list']);
    });
  });

  describe('/scan command', () => {
    it('should run security scan with default path', async () => {
      const mockResult = {
        findings: [],
        scannedFiles: 10,
        duration: 100,
        passed: true
      };
      mockQuickSecurityScan.mockResolvedValue(mockResult);
      mockFormatSecurityReport.mockReturnValue('Security report');
      mockExistsSync.mockReturnValue(true);

      const command = slashCommands['/scan'];
      await command.handler([]);

      expect(mockQuickSecurityScan).toHaveBeenCalledWith(process.cwd());
      expect(mockFormatSecurityReport).toHaveBeenCalledWith(mockResult);
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it('should run security scan with custom path', async () => {
      const mockResult = {
        findings: [],
        scannedFiles: 10,
        duration: 100,
        passed: true
      };
      mockQuickSecurityScan.mockResolvedValue(mockResult);
      mockFormatSecurityReport.mockReturnValue('Security report');
      mockExistsSync.mockReturnValue(true);

      const command = slashCommands['/scan'];
      await command.handler(['./src']);

      const { join } = await import('path');
      expect(mockQuickSecurityScan).toHaveBeenCalledWith(join(process.cwd(), './src'));
    });

    it('should exit with code 1 when scan fails', async () => {
      const mockResult = {
        findings: [{ severity: 'high' }],
        scannedFiles: 10,
        duration: 100,
        passed: false
      };
      mockQuickSecurityScan.mockResolvedValue(mockResult);
      mockFormatSecurityReport.mockReturnValue('Security report');
      mockExistsSync.mockReturnValue(true);

      const command = slashCommands['/scan'];
      await command.handler([]);

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('/cost command', () => {
    it('should show today spending by default', async () => {
      mockGetTodaySpending.mockReturnValue({ cost: 1.23, tokens: 1000, requests: 10 });
      
      const command = slashCommands['/cost'];
      await command.handler([]);
      
      expect(mockGetTodaySpending).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("💰 Today's Spending"));
    });

    it('should show report when report subcommand provided', async () => {
      const mockReport = { totalCost: 10, totalTokens: 10000, requestCount: 100, byModel: {} };
      mockGetSpendingReport.mockReturnValue(mockReport);
      mockFormatReport.mockReturnValue('Spending report');
      
      const command = slashCommands['/cost'];
      await command.handler(['report', '7']);
      
      expect(mockGetSpendingReport).toHaveBeenCalledWith(7);
      expect(mockFormatReport).toHaveBeenCalledWith(mockReport);
    });

    it('should show cache stats when cache subcommand provided', async () => {
      const mockStats = { 
        totalEntries: 100, 
        totalHits: 50, 
        totalTokensSaved: 5000, 
        estimatedCostSaved: 0.5, 
        hitRate: 50 
      };
      mockGetCacheStats.mockReturnValue(mockStats);
      mockFormatCacheStats.mockReturnValue('Cache stats');
      
      const command = slashCommands['/cost'];
      await command.handler(['cache']);
      
      expect(mockGetCacheStats).toHaveBeenCalled();
      expect(mockFormatCacheStats).toHaveBeenCalledWith(mockStats);
    });

    it('should show usage message for unknown subcommand', async () => {
      const command = slashCommands['/cost'];
      await command.handler(['unknown']);
      
      expect(consoleSpy).toHaveBeenCalledWith('Usage: /cost [today|report <days>|cache]');
    });
  });

  describe('/skills command', () => {
    it('should call listSkills', async () => {
      const command = slashCommands['/skills'];
      await command.handler([]);
      
      expect(mockListSkills).toHaveBeenCalled();
    });
  });

  describe('/help command', () => {
    it('should list all available commands', async () => {
      const command = slashCommands['/help'];
      await command.handler([]);
      
      expect(consoleSpy).toHaveBeenCalledWith('\n⚡ Slash Commands:\n');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/fix'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/template'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/scan'));
    });
  });

  describe('executeSlashCommand', () => {
    it('should execute valid command and return true', async () => {
      mockGetTodaySpending.mockReturnValue({ cost: 0, tokens: 0, requests: 0 });
      
      const result = await executeSlashCommand('/cost today');
      
      expect(result).toBe(true);
      expect(mockGetTodaySpending).toHaveBeenCalled();
    });

    it('should return false for unknown command', async () => {
      const result = await executeSlashCommand('/unknowncommand');
      
      expect(result).toBe(false);
    });

    it('should parse arguments correctly', async () => {
      mockHandleTemplateCommand.mockImplementation(() => {});
      
      await executeSlashCommand('/template show MARS');
      
      expect(mockHandleTemplateCommand).toHaveBeenCalledWith(['show', 'MARS']);
    });
  });
});
