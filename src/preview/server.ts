// Visual Preview Server for NOVA26
// Provides mobile/tablet/desktop viewport switching

// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require('express');
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

// Express types handled by any declarations

const app = express();
const PORT = 3001;

// Device viewports
const VIEWPORTS = {
  mobile: { width: 375, height: 667, name: 'iPhone SE' },
  tablet: { width: 768, height: 1024, name: 'iPad Mini' },
  desktop: { width: 1440, height: 900, name: 'Desktop' }
};

/**
 * Start the preview server
 */
export function startPreviewServer(): void {
  app.use(express.static(join(process.cwd(), 'public')));
  
  // Main preview interface
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.get('/preview', (req: any, res: any) => {
    const component = req.query.component as string;
    const device = (req.query.device as 'mobile' | 'tablet' | 'desktop') || 'desktop';
    
    const viewport = VIEWPORTS[device];
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>NOVA26 Preview - ${component || 'App'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .toolbar {
      background: rgba(0,0,0,0.3);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .toolbar h1 {
      color: white;
      font-size: 16px;
      font-weight: 500;
    }
    .device-buttons {
      display: flex;
      gap: 8px;
    }
    .device-btn {
      background: rgba(255,255,255,0.1);
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }
    .device-btn:hover {
      background: rgba(255,255,255,0.2);
    }
    .device-btn.active {
      background: #3b82f6;
    }
    .device-info {
      color: rgba(255,255,255,0.6);
      font-size: 13px;
      margin-left: auto;
    }
    .preview-area {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }
    .device-frame {
      background: white;
      border-radius: ${device === 'mobile' ? '40px' : device === 'tablet' ? '20px' : '8px'};
      padding: ${device === 'mobile' ? '12px' : device === 'tablet' ? '16px' : '0'};
      box-shadow: 0 25px 80px rgba(0,0,0,0.5);
      transition: all 0.3s ease;
    }
    .device-screen {
      width: ${viewport.width}px;
      height: ${viewport.height}px;
      background: white;
      border-radius: ${device === 'mobile' ? '32px' : device === 'tablet' ? '12px' : '4px'};
      overflow: hidden;
      position: relative;
    }
    .device-screen iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .resize-handle {
      position: absolute;
      bottom: 10px;
      right: 10px;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      opacity: 0.3;
    }
    .resize-handle:hover {
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>🔮 NOVA26 Preview</h1>
    <div class="device-buttons">
      <button class="device-btn ${device === 'mobile' ? 'active' : ''}" onclick="setDevice('mobile')">📱 Mobile</button>
      <button class="device-btn ${device === 'tablet' ? 'active' : ''}" onclick="setDevice('tablet')">📱 Tablet</button>
      <button class="device-btn ${device === 'desktop' ? 'active' : ''}" onclick="setDevice('desktop')">🖥️ Desktop</button>
    </div>
    <div class="device-info">
      ${viewport.name} • ${viewport.width}×${viewport.height}
    </div>
  </div>
  
  <div class="preview-area">
    <div class="device-frame" id="deviceFrame">
      <div class="device-screen">
        <iframe src="/render?component=${component || ''}&device=${device}"></iframe>
      </div>
    </div>
  </div>
  
  <script>
    function setDevice(device) {
      const url = new URL(window.location);
      url.searchParams.set('device', device);
      window.location.href = url.toString();
    }
  </script>
</body>
</html>`;
    
    res.send(html);
  });
  
  // Component renderer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.get('/render', (req: any, res: any) => {
    const component = req.query.component as string;
    const device = req.query.device as string;
    
    // TODO: Implement actual component rendering with Vite
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      background: #f8fafc;
    }
    .placeholder {
      background: white;
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .placeholder h2 {
      color: #1e293b;
      margin-bottom: 10px;
    }
    .placeholder p {
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="placeholder">
    <h2>🔮 ${component || 'Component Preview'}</h2>
    <p>Device: ${device}</p>
    <p>Visual preview with live rendering coming in next update...</p>
  </div>
</body>
</html>`;
    
    res.send(html);
  });
  
  app.listen(PORT, () => {
    console.log(`\n🎨 Preview server running at http://localhost:${PORT}`);
    console.log(`📱 Open /preview?component=UserCard&device=mobile`);
    console.log(`📱 Open /preview?component=UserCard&device=tablet`);
    console.log(`🖥️ Open /preview?component=UserCard&device=desktop\n`);
  });
}

/**
 * List available components for preview
 */
export function listPreviewableComponents(): string[] {
  const componentsDir = join(process.cwd(), 'src', 'components');
  if (!existsSync(componentsDir)) {
    return [];
  }
  
  return readdirSync(componentsDir)
    .filter(f => f.endsWith('.tsx'))
    .map(f => f.replace('.tsx', ''));
}
