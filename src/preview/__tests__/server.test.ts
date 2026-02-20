// KMS-27: Preview Server Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startPreviewServer, previewComponent } from '../server.js';

// Mock http module
vi.mock('http', () => ({
  createServer: vi.fn((handler) => ({
    listen: vi.fn((port, callback) => {
      if (callback) callback();
    }),
    close: vi.fn((callback) => {
      if (callback) callback();
    }),
    on: vi.fn(),
    _handler: handler,
  })),
  IncomingMessage: class {},
  ServerResponse: class {},
}));

// Mock fs module
const mockReadFileSync = vi.fn();
const mockExistsSync = vi.fn();

vi.mock('fs', () => ({
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  existsSync: (...args: any[]) => mockExistsSync(...args),
}));

import { createServer } from 'http';

describe('Preview Server', () => {
  let mockServer: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = {
      listen: vi.fn((port, callback) => {
        if (callback) callback();
      }),
      close: vi.fn((callback) => {
        if (callback) callback();
      }),
      on: vi.fn(),
    };
    vi.mocked(createServer).mockReturnValue(mockServer as any);
  });

  describe('startPreviewServer', () => {
    it('should start server on default port 3456', async () => {
      await startPreviewServer();

      expect(createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(3456, expect.any(Function));
    });

    it('should start server on custom port', async () => {
      await startPreviewServer({ port: 8080 });

      expect(mockServer.listen).toHaveBeenCalledWith(8080, expect.any(Function));
    });
  });

  describe('previewComponent', () => {
    it('should start server on port 3457 for single component preview', async () => {
      await previewComponent('Button');

      expect(mockServer.listen).toHaveBeenCalledWith(3457, expect.any(Function));
    });
  });

  describe('route handling', () => {
    let requestHandler: Function;
    
    beforeEach(() => {
      mockServer = {
        listen: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
      };
      vi.mocked(createServer).mockImplementation((handler: any) => {
        requestHandler = handler;
        return mockServer;
      });
    });

    const createMockRes = () => ({
      setHeader: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
    });

    it('should handle OPTIONS requests', async () => {
      await startPreviewServer();
      const mockRes = createMockRes();
      
      requestHandler({ url: '/', method: 'OPTIONS' }, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should serve dashboard on root path', async () => {
      await startPreviewServer();
      const mockRes = createMockRes();
      
      requestHandler({ url: '/', method: 'GET' }, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('NOVA26 Preview'));
    });

    it('should serve health check endpoint', async () => {
      await startPreviewServer();
      const mockRes = createMockRes();
      
      requestHandler({ url: '/health', method: 'GET' }, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const responseBody = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseBody.status).toBe('healthy');
      expect(responseBody.version).toBe('2.0.0');
    });

    it('should return 404 for unknown routes', async () => {
      await startPreviewServer();
      const mockRes = createMockRes();
      
      requestHandler({ url: '/unknown-route', method: 'GET' }, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
      const responseBody = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseBody.error).toBe('Not found');
    });

    it('should return 404 when component does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      await startPreviewServer();
      const mockRes = createMockRes();
      
      requestHandler({ url: '/component/NonExistent', method: 'GET' }, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
      const responseBody = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseBody.error).toContain('not found');
    });

    it('should serve component preview when file exists', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('export function Button() {}');
      
      await startPreviewServer();
      const mockRes = createMockRes();
      
      requestHandler({ url: '/component/Button', method: 'GET' }, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const responseBody = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseBody.component).toBe('Button');
      expect(responseBody.source).toBe('export function Button() {}');
    });

    it('should serve static files', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from('file content'));
      
      await startPreviewServer();
      const mockRes = createMockRes();
      
      requestHandler({ url: '/static/styles.css', method: 'GET' }, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/css' });
    });

    it('should return 404 for unknown static files', async () => {
      mockExistsSync.mockReturnValue(false);
      await startPreviewServer();
      const mockRes = createMockRes();
      
      requestHandler({ url: '/static/unknown.css', method: 'GET' }, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    });
  });

  describe('content type handling', () => {
    let requestHandler: Function;
    
    beforeEach(() => {
      mockServer = {
        listen: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
      };
      vi.mocked(createServer).mockImplementation((handler: any) => {
        requestHandler = handler;
        return mockServer;
      });
    });

    const createMockRes = () => ({
      setHeader: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
    });

    const testCases = [
      { ext: '.html', expected: 'text/html' },
      { ext: '.css', expected: 'text/css' },
      { ext: '.js', expected: 'application/javascript' },
      { ext: '.json', expected: 'application/json' },
      { ext: '.png', expected: 'image/png' },
      { ext: '.jpg', expected: 'image/jpeg' },
      { ext: '.svg', expected: 'image/svg+xml' },
    ];

    testCases.forEach(({ ext, expected }) => {
      it(`should return correct content type for ${ext} files`, async () => {
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(Buffer.from('content'));
        
        await startPreviewServer();
        const mockRes = createMockRes();
        
        requestHandler({ url: `/static/file${ext}`, method: 'GET' }, mockRes);

        expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': expected });
      });
    });

    it('should default to octet-stream for unknown extensions', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(Buffer.from('content'));
      
      await startPreviewServer();
      const mockRes = createMockRes();
      
      requestHandler({ url: '/static/file.unknown', method: 'GET' }, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/octet-stream' });
    });
  });
});
