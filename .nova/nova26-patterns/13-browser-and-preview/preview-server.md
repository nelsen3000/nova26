# Preview Server

## Source
Extracted from Nova26 `src/preview/server.ts`

---

## Pattern: Preview Server

The Preview Server provides a local Express-based development server with a device-frame UI for previewing VENUS-generated components at mobile, tablet, and desktop viewports. It serves a toolbar with device-switching buttons, wraps the rendered component in a realistic device frame (with appropriate border-radius and padding per device type), and displays viewport metadata. The server also exposes a component listing endpoint for discovering previewable `.tsx` files.

---

## Implementation

### Code Example

```typescript
const express = require('express');
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

const app = express();
const PORT = 3001;

// Named device viewports with realistic dimensions
const VIEWPORTS = {
  mobile:  { width: 375,  height: 667,  name: 'iPhone SE' },
  tablet:  { width: 768,  height: 1024, name: 'iPad Mini' },
  desktop: { width: 1440, height: 900,  name: 'Desktop' },
};

/**
 * Start the preview server with device-frame UI and component rendering
 */
export function startPreviewServer(): void {
  app.use(express.static(join(process.cwd(), 'public')));

  // Main preview route — renders device frame with toolbar
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
    .toolbar {
      background: rgba(0,0,0,0.3);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .device-btn {
      background: rgba(255,255,255,0.1);
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
    }
    .device-btn.active { background: #3b82f6; }
    .device-frame {
      background: white;
      border-radius: ${device === 'mobile' ? '40px' : device === 'tablet' ? '20px' : '8px'};
      padding: ${device === 'mobile' ? '12px' : device === 'tablet' ? '16px' : '0'};
      box-shadow: 0 25px 80px rgba(0,0,0,0.5);
    }
    .device-screen {
      width: ${viewport.width}px;
      height: ${viewport.height}px;
      overflow: hidden;
    }
    .device-screen iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>🔮 NOVA26 Preview</h1>
    <button class="device-btn ${device === 'mobile' ? 'active' : ''}"
            onclick="setDevice('mobile')">📱 Mobile</button>
    <button class="device-btn ${device === 'tablet' ? 'active' : ''}"
            onclick="setDevice('tablet')">📱 Tablet</button>
    <button class="device-btn ${device === 'desktop' ? 'active' : ''}"
            onclick="setDevice('desktop')">🖥️ Desktop</button>
    <span>${viewport.name} • ${viewport.width}×${viewport.height}</span>
  </div>
  <div class="preview-area">
    <div class="device-frame">
      <div class="device-screen">
        <iframe src="/render?component=${component || ''}&device=${device}"></iframe>
      </div>
    </div>
  </div>
  <script>
    function setDevice(d) {
      const url = new URL(window.location);
      url.searchParams.set('device', d);
      window.location.href = url.toString();
    }
  </script>
</body>
</html>`;
    res.send(html);
  });

  // Component render route — serves the actual component HTML
  app.get('/render', (req: any, res: any) => {
    const component = req.query.component as string;
    const device = req.query.device as string;
    res.send(`<div class="placeholder"><h2>${component || 'Component Preview'}</h2><p>Device: ${device}</p></div>`);
  });

  app.listen(PORT, () => {
    console.log(`🎨 Preview server running at http://localhost:${PORT}`);
  });
}
```

### Component Discovery

```typescript
/**
 * List available .tsx components for preview
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
```

### Key Concepts

- Device-frame UI with realistic border-radius and padding per device type (mobile: 40px rounded, tablet: 20px, desktop: 8px)
- Named viewport presets (iPhone SE, iPad Mini, Desktop) with standard dimensions
- Toolbar with active-state device buttons and viewport metadata display
- iframe-based component isolation — the rendered component lives in a sandboxed iframe
- Static file serving from `public/` directory for assets
- Component discovery via filesystem scan of `src/components/*.tsx`

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Hardcoded single viewport with no device switching
const app = express();
app.get('/preview', (req, res) => {
  res.send(`<iframe src="/render" style="width:100%;height:100vh"></iframe>`);
});
// No device frame, no viewport metadata, no breakpoint switching
```

### ✅ Do This Instead

```typescript
// Named viewports with device-frame UI and switching controls
const VIEWPORTS = {
  mobile:  { width: 375,  height: 667,  name: 'iPhone SE' },
  tablet:  { width: 768,  height: 1024, name: 'iPad Mini' },
  desktop: { width: 1440, height: 900,  name: 'Desktop' },
};

app.get('/preview', (req, res) => {
  const device = req.query.device || 'desktop';
  const viewport = VIEWPORTS[device];
  // Render device frame with correct dimensions, border-radius, and switching toolbar
});
```

---

## When to Use This Pattern

✅ **Use for:**
- Local development preview of agent-generated React components across device sizes
- Visual QA workflows where developers or agents need to inspect component rendering at specific breakpoints
- Providing screenshot targets for the Visual Validator's Playwright-based capture

❌ **Don't use for:**
- Production serving of the application — this is a development-only tool
- Full end-to-end testing (use Playwright directly against the real app instead)

---

## Benefits

1. Instant multi-device preview without browser DevTools — switch between mobile, tablet, and desktop with one click
2. Realistic device frames give visual context for how components will appear on actual devices
3. iframe isolation prevents preview styles from leaking into the component under test
4. Component discovery via filesystem scan eliminates manual configuration of previewable components
5. Lightweight Express server starts in milliseconds, no build step required

---

## Related Patterns

- See `../13-browser-and-preview/visual-validator.md` for the automated screenshot and scoring system that uses this server as its render target
- See `../01-orchestration/ralph-loop-execution.md` for how the orchestrator integrates preview and validation into the build cycle
- See `../03-quality-gates/test-runner-gate.md` for the test gate that may run visual regression checks alongside unit tests

---

*Extracted: 2026-02-18*
