// Preview Server for NOVA26
// Visual component preview and validation server

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

interface PreviewConfig {
  port: number;
  componentDir: string;
  staticDir: string;
}

const DEFAULT_CONFIG: PreviewConfig = {
  port: 3456,
  componentDir: join(process.cwd(), 'src', 'components'),
  staticDir: join(process.cwd(), 'public'),
};

/**
 * Start the preview server
 */
export async function startPreviewServer(config: Partial<PreviewConfig> = {}): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const server = createServer((req, res) => {
    handleRequest(req, res, finalConfig);
  });

  server.listen(finalConfig.port, () => {
    console.log('\n🎨 NOVA26 Preview Server\n');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Server running at: http://localhost:${finalConfig.port}`);
    console.log('');
    console.log('Available endpoints:');
    console.log(`  /              - Preview dashboard`);
    console.log(`  /component/:id - Preview specific component`);
    console.log(`  /health        - Server health check`);
    console.log('═══════════════════════════════════════════════════\n');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down preview server...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

/**
 * Handle HTTP requests
 */
function handleRequest(req: IncomingMessage, res: ServerResponse, config: PreviewConfig): void {
  const url = req.url || '/';
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Route handling
  if (url === '/') {
    serveDashboard(res);
  } else if (url === '/health') {
    serveHealthCheck(res);
  } else if (url.startsWith('/component/')) {
    const componentId = url.replace('/component/', '');
    serveComponentPreview(res, componentId, config);
  } else if (url.startsWith('/static/')) {
    serveStaticFile(res, url.replace('/static/', ''), config);
  } else {
    serve404(res);
  }
}

/**
 * Serve the preview dashboard
 */
function serveDashboard(res: ServerResponse): void {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>NOVA26 Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f23;
      color: #e0e0ff;
      min-height: 100vh;
    }
    .header {
      background: linear-gradient(90deg, #1a1a3e, #0f0f23);
      padding: 20px 40px;
      border-bottom: 1px solid #333366;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 600;
      background: linear-gradient(90deg, #6b8cff, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .container {
      padding: 40px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 30px;
    }
    .card {
      background: linear-gradient(135deg, #1a1a3e, #0f0f23);
      border: 1px solid #333366;
      border-radius: 12px;
      padding: 24px;
      transition: all 0.3s ease;
    }
    .card:hover {
      border-color: #6b8cff;
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(107, 140, 255, 0.1);
    }
    .card h3 {
      font-size: 18px;
      margin-bottom: 8px;
      color: #ffffff;
    }
    .card p {
      color: #8892b0;
      font-size: 14px;
    }
    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      margin-top: 12px;
    }
    .status.ready { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .status.preview { background: rgba(107, 140, 255, 0.2); color: #6b8cff; }
    .info-box {
      background: rgba(107, 140, 255, 0.1);
      border: 1px solid #333366;
      border-radius: 8px;
      padding: 16px;
      margin-top: 20px;
    }
    .info-box code {
      background: rgba(0,0,0,0.3);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', monospace;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎨 NOVA26 Component Preview</h1>
  </div>
  <div class="container">
    <h2>Welcome to the Preview Server</h2>
    <p style="color: #8892b0; margin-top: 8px;">
      Preview and validate your components in isolation
    </p>
    
    <div class="grid">
      <div class="card">
        <h3>Component Explorer</h3>
        <p>Browse all available components with live previews</p>
        <span class="status ready">Ready</span>
      </div>
      <div class="card">
        <h3>Visual Regression</h3>
        <p>Compare components against baseline screenshots</p>
        <span class="status preview">Preview Mode</span>
      </div>
      <div class="card">
        <h3>Responsive Testing</h3>
        <p>Test components at different viewport sizes</p>
        <span class="status ready">Ready</span>
      </div>
      <div class="card">
        <h3>Accessibility Audit</h3>
        <p>Run automated a11y checks on components</p>
        <span class="status ready">Ready</span>
      </div>
    </div>
    
    <div class="info-box">
      <strong>💡 Quick Start:</strong> Use <code>/preview --component Button</code> to preview a specific component.
    </div>
  </div>
</body>
</html>
  `;

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

/**
 * Serve health check endpoint
 */
function serveHealthCheck(res: ServerResponse): void {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(health, null, 2));
}

/**
 * Serve component preview
 */
function serveComponentPreview(res: ServerResponse, componentId: string, config: PreviewConfig): void {
  const componentPath = join(config.componentDir, `${componentId}.tsx`);
  
  if (!existsSync(componentPath)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Component not found',
      path: componentPath 
    }));
    return;
  }

  try {
    const content = readFileSync(componentPath, 'utf-8');
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      component: componentId,
      source: content,
      preview: 'Component preview available',
    }, null, 2));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Failed to load component',
      details: String(error)
    }));
  }
}

/**
 * Serve static files
 */
function serveStaticFile(res: ServerResponse, filePath: string, config: PreviewConfig): void {
  const fullPath = join(config.staticDir, filePath);
  
  if (!existsSync(fullPath)) {
    serve404(res);
    return;
  }

  try {
    const content = readFileSync(fullPath);
    const ext = extname(fullPath);
    const contentType = getContentType(ext);

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    res.writeHead(500);
    res.end('Failed to serve file');
  }
}

/**
 * Get MIME type for file extension
 */
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * Serve 404 page
 */
function serve404(res: ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

/**
 * Quick preview a specific component
 */
export async function previewComponent(componentName: string): Promise<void> {
  console.log(`\n🎨 Previewing component: ${componentName}\n`);
  
  const config: PreviewConfig = {
    ...DEFAULT_CONFIG,
    port: 3457, // Different port for single component
  };

  const server = createServer((req, res) => {
    if (req.url === '/') {
      // Redirect to component preview
      res.writeHead(302, { Location: `/component/${componentName}` });
      res.end();
    } else {
      handleRequest(req, res, config);
    }
  });

  server.listen(config.port, () => {
    console.log(`Component preview: http://localhost:${config.port}`);
    console.log('Press Ctrl+C to stop\n');
  });
}
