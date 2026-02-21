# VS Code Extension

## Source
Extracted from Nova26 `src/ide/vscode-extension.ts`

---

## Pattern: VS Code Extension Integration

The VS Code Extension pattern implements a full IDE integration layer for Nova26, exposing the multi-agent system through native VS Code affordances: commands with keybindings, inline completion providers, webview panels for diff review and code explanation, a status bar item for build progress, and a tree data provider for build history. The extension communicates with the Nova26 server over HTTP, bridging the gap between the CLI/orchestrator and a GUI-based developer workflow.

---

## Implementation

### Extension Manifest and Command Registration

```typescript
import * as vscode from 'vscode';
import axios from 'axios';

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('NOVA26');

  // Status bar — persistent build indicator
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(sync~spin) NOVA26';
  statusBarItem.command = 'nova26.status';
  context.subscriptions.push(statusBarItem);
  statusBarItem.show();

  // Register all commands
  context.subscriptions.push(
    vscode.commands.registerCommand('nova26.generate', generateCode),
    vscode.commands.registerCommand('nova26.explain', explainCode),
    vscode.commands.registerCommand('nova26.fix', fixCode),
    vscode.commands.registerCommand('nova26.review', reviewCode),
    vscode.commands.registerCommand('nova26.swarm', swarmMode),
    vscode.commands.registerCommand('nova26.status', showStatus),
    vscode.commands.registerCommand('nova26.acceptSuggestion', acceptSuggestion),
    vscode.commands.registerCommand('nova26.rejectSuggestion', rejectSuggestion),
  );

  // Inline completion provider for TS/JS files
  const provider = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: '**/*.{ts,tsx,js,jsx}' },
    new NovaInlineCompletionProvider()
  );
  context.subscriptions.push(provider);

  // Tree view for build status sidebar
  const treeProvider = new BuildStatusProvider();
  vscode.window.registerTreeDataProvider('nova26BuildStatus', treeProvider);
}

export function deactivate() {}
```

### Inline Completion Provider

```typescript
class NovaInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ) {
    const config = vscode.workspace.getConfiguration('nova26');
    if (!config.get('autoSuggest')) return;

    const linePrefix = document
      .lineAt(position)
      .text.slice(0, position.character);

    if (!this.shouldTrigger(linePrefix)) return;

    try {
      const response = await axios.post(
        'http://localhost:3000/api/complete',
        {
          code: document.getText(),
          position: { line: position.line, character: position.character },
          prefix: linePrefix,
        }
      );
      return [new vscode.InlineCompletionItem(response.data.suggestion)];
    } catch {
      return;
    }
  }

  shouldTrigger(linePrefix: string): boolean {
    const triggers = ['// ', '/* ', 'function ', 'const ', 'let ', 'type '];
    return triggers.some((t) => linePrefix.endsWith(t));
  }
}
```

### Webview Panel for Code Explanation and Diff Review

```typescript
async function explainCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showWarningMessage('Please select code to explain');
    return;
  }

  const response = await axios.post('http://localhost:3000/api/explain', {
    code: selection,
  });

  // Open a side-by-side webview panel
  const panel = vscode.window.createWebviewPanel(
    'nova26Explain',
    'NOVA26 Explanation',
    vscode.ViewColumn.Beside,
    {}
  );

  panel.webview.html = `
    <html>
      <body style="font-family: sans-serif; padding: 20px;">
        <h2>Code Explanation</h2>
        <pre><code>${escapeHtml(selection)}</code></pre>
        <div>${response.data.explanation}</div>
      </body>
    </html>`;
}

// Diff view with accept/reject via postMessage
export function createDiffView(
  original: string,
  modified: string,
  description: string
): string {
  return `
    <div class="diff-container">
      <div class="side"><h3>Original</h3><pre>${escapeHtml(original)}</pre></div>
      <div class="side"><h3>Modified</h3><pre>${escapeHtml(modified)}</pre></div>
    </div>
    <div class="actions">
      <button class="accept" onclick="accept()">Accept Changes</button>
      <button class="reject" onclick="reject()">Reject</button>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      function accept() { vscode.postMessage({ command: 'accept', modified: ... }); }
      function reject() { vscode.postMessage({ command: 'reject' }); }
    </script>`;
}
```

### Diagnostic-Aware Fix Command

```typescript
async function fixCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  // Read VS Code's own diagnostics for the file
  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
  if (diagnostics.length === 0) {
    vscode.window.showInformationMessage('No issues found! 🎉');
    return;
  }

  statusBarItem.text = '$(sync~spin) Fixing...';

  try {
    const code = editor.document.getText();
    const response = await axios.post('http://localhost:3000/api/fix', {
      code,
      diagnostics,
    });

    // Replace entire document content with the fix
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.positionAt(code.length)
    );
    edit.replace(editor.document.uri, fullRange, response.data.code);
    await vscode.workspace.applyEdit(edit);

    vscode.window.showInformationMessage('✅ Issues fixed!');
  } catch (error: any) {
    vscode.window.showErrorMessage('❌ Fix failed');
  } finally {
    statusBarItem.text = '$(check) NOVA26';
  }
}
```


### Extension Manifest Configuration

```typescript
// Declarative manifest — contributes commands, keybindings, views, and settings
export const extensionManifest = {
  name: 'nova26',
  displayName: 'NOVA26 AI Development',
  version: '1.0.0',
  engines: { vscode: '^1.80.0' },
  activationEvents: ['onCommand:nova26.generate'],
  contributes: {
    commands: [
      { command: 'nova26.generate', title: 'Generate Code', category: 'NOVA26' },
      { command: 'nova26.explain', title: 'Explain Code', category: 'NOVA26' },
      { command: 'nova26.fix', title: 'Fix Issues', category: 'NOVA26' },
      { command: 'nova26.review', title: 'Review Code', category: 'NOVA26' },
      { command: 'nova26.swarm', title: 'Swarm Mode', category: 'NOVA26' },
      { command: 'nova26.status', title: 'Build Status', category: 'NOVA26' },
    ],
    keybindings: [
      { command: 'nova26.generate', key: 'ctrl+shift+g', mac: 'cmd+shift+g' },
      { command: 'nova26.explain', key: 'ctrl+shift+e', mac: 'cmd+shift+e' },
    ],
    views: {
      explorer: [
        { id: 'nova26BuildStatus', name: 'NOVA26 Build Status', when: 'nova26:enabled' },
      ],
    },
    configuration: {
      title: 'NOVA26',
      properties: {
        'nova26.apiEndpoint': {
          type: 'string',
          default: 'http://localhost:3000',
          description: 'NOVA26 server endpoint',
        },
        'nova26.model': {
          type: 'string',
          default: 'qwen2.5:7b',
          enum: ['qwen2.5:7b', 'qwen2.5:14b', 'gpt-4o', 'claude-3-sonnet'],
          description: 'Default LLM model',
        },
        'nova26.autoSuggest': {
          type: 'boolean',
          default: true,
          description: 'Enable inline suggestions',
        },
      },
    },
  },
};
```

### Key Concepts

- Declarative manifest (`package.json`) defines commands, keybindings, views, and configuration — VS Code reads this at install time
- Imperative activation (`activate()`) registers command handlers, completion providers, and tree data providers at runtime
- HTTP bridge to Nova26 server — the extension is a thin client; all AI logic lives server-side
- Status bar item provides persistent, at-a-glance build state with animated spinner during operations
- Webview panels for rich content (explanations, diffs) with `acquireVsCodeApi()` for bidirectional messaging
- Inline completion provider with trigger-pattern gating to avoid noisy suggestions
- Tree data provider for build status sidebar view, scoped with `when: 'nova26:enabled'` context key
- Diagnostic integration — the fix command reads VS Code's own error diagnostics and sends them to the server for AI-powered repair

---

## Anti-Patterns

### ❌ Don't Do This

```typescript
// Putting AI logic directly in the extension
export function activate(context: vscode.ExtensionContext) {
  vscode.commands.registerCommand('nova26.generate', async () => {
    const editor = vscode.window.activeTextEditor;
    // ❌ Running LLM inference inside the extension process
    const model = await loadModel('qwen2.5:7b');
    const result = await model.generate(editor.document.getText());
    // ❌ No status feedback, no error handling, no cancellation
    editor.edit((builder) => builder.insert(editor.selection.active, result));
  });
}
```

### ✅ Do This Instead

```typescript
// Extension as thin client — delegate to the Nova26 server
export function activate(context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right
  );
  statusBar.show();

  vscode.commands.registerCommand('nova26.generate', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    statusBar.text = '$(sync~spin) Generating...';
    try {
      const response = await axios.post(
        'http://localhost:3000/api/generate',
        { prompt, file: editor.document.fileName }
      );
      const edit = new vscode.WorkspaceEdit();
      edit.insert(editor.document.uri, editor.selection.active, response.data.code);
      await vscode.workspace.applyEdit(edit);
      vscode.window.showInformationMessage('✅ Code generated!');
    } catch (error: any) {
      vscode.window.showErrorMessage('❌ Generation failed: ' + error.message);
    } finally {
      statusBar.text = '$(check) NOVA26';
    }
  });
}
```

---

## When to Use This Pattern

✅ **Use for:**
- Providing a GUI-native interface to a multi-agent AI system within VS Code
- Exposing AI code generation, explanation, review, and fix commands through the command palette and keybindings
- Delivering inline AI completions that integrate with VS Code's native ghost-text UX
- Showing rich diff views and explanations in webview panels with accept/reject workflows

❌ **Don't use for:**
- Headless CI/CD pipelines where no IDE is present — use the CLI (`nova26 generate`) instead
- Lightweight editor integrations (Vim, Emacs) that don't support the VS Code Extension API

---

## Benefits

1. Native IDE experience — commands, keybindings, status bar, and sidebar views feel like built-in VS Code features rather than external tools
2. Thin-client architecture keeps the extension lightweight; all AI inference and orchestration stays server-side, avoiding extension process bloat
3. Inline completion provider leverages VS Code's ghost-text UX for non-intrusive AI suggestions with trigger-pattern gating
4. Webview panels enable rich interactive content (diff review with accept/reject, formatted explanations) that plain text output channels cannot provide
5. Diagnostic-aware fix command reads VS Code's own error list, giving the AI server precise context about what needs repair

---

## Related Patterns

- See `../13-browser-and-preview/preview-server.md` for the local preview server that the extension can launch for visual component inspection
- See `../13-browser-and-preview/visual-validator.md` for the automated visual validation that complements the extension's code review command
- See `../04-cli-and-commands/cli-entry.md` for the CLI counterpart — same Nova26 server, different interface surface
- See `../05-execution/swarm-mode.md` for the swarm mode that the extension's `nova26.swarm` command delegates to via terminal

---

*Extracted: 2026-02-18*
