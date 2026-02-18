// VS Code Integration - Extension API and commands
// Provides IDE-native experience

// VS Code Extension types (used by extension manifest)
export interface VSCodeCommand {
  command: string;
  title: string;
  handler: (...args: unknown[]) => Promise<void>;
}

export interface InlineSuggestion {
  text: string;
  range: { start: number; end: number };
  confidence: number;
}

export interface CodeDiff {
  original: string;
  modified: string;
  filename: string;
  description: string;
}

// VS Code Extension Manifest
export const extensionManifest = {
  name: 'nova26',
  displayName: 'NOVA26 AI Development',
  description: 'AI-powered development with 21 specialized agents',
  version: '1.0.0',
  engines: { vscode: '^1.80.0' },
  categories: ['Machine Learning', 'Programming Languages', 'Snippets'],
  activationEvents: ['onCommand:nova26.generate'],
  main: './out/extension.js',
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
        {
          id: 'nova26BuildStatus',
          name: 'NOVA26 Build Status',
          when: 'nova26:enabled',
        },
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

// Extension code (this runs inside VS Code)
export const extensionCode = `
import * as vscode from 'vscode';
import axios from 'axios';

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('NOVA26');
  
  // Status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(sync~spin) NOVA26";
  statusBarItem.command = 'nova26.status';
  context.subscriptions.push(statusBarItem);
  statusBarItem.show();

  // Register commands
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

  // Inline completion provider
  const provider = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: '**/*.{ts,tsx,js,jsx}' },
    new NovaInlineCompletionProvider()
  );
  context.subscriptions.push(provider);

  // Tree data provider for build status
  const treeProvider = new BuildStatusProvider();
  vscode.window.registerTreeDataProvider('nova26BuildStatus', treeProvider);
}

async function generateCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const prompt = await vscode.window.showInputBox({
    prompt: 'What would you like to generate?',
    placeHolder: 'e.g., Create a React component for a user profile'
  });

  if (!prompt) return;

  statusBarItem.text = "$(sync~spin) Generating...";
  
  try {
    const response = await axios.post('http://localhost:3000/api/generate', {
      prompt,
      file: editor.document.fileName,
    });

    const edit = new vscode.WorkspaceEdit();
    const position = editor.selection.active;
    edit.insert(editor.document.uri, position, response.data.code);
    await vscode.workspace.applyEdit(edit);

    vscode.window.showInformationMessage('✅ Code generated!');
  } catch (error) {
    vscode.window.showErrorMessage('❌ Generation failed: ' + error.message);
  } finally {
    statusBarItem.text = "$(check) NOVA26";
  }
}

async function explainCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showWarningMessage('Please select code to explain');
    return;
  }

  try {
    const response = await axios.post('http://localhost:3000/api/explain', {
      code: selection,
    });

    const panel = vscode.window.createWebviewPanel(
      'nova26Explain',
      'NOVA26 Explanation',
      vscode.ViewColumn.Beside,
      {}
    );

    panel.webview.html = \`
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h2>Code Explanation</h2>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;"><code>\${escapeHtml(selection)}</code></pre>
          <div style="margin-top: 20px;">\${response.data.explanation}</div>
        </body>
      </html>
    \`;
  } catch (error) {
    vscode.window.showErrorMessage('❌ Explanation failed');
  }
}

async function fixCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
  if (diagnostics.length === 0) {
    vscode.window.showInformationMessage('No issues found! 🎉');
    return;
  }

  statusBarItem.text = "$(sync~spin) Fixing...";

  try {
    const code = editor.document.getText();
    const response = await axios.post('http://localhost:3000/api/fix', {
      code,
      diagnostics,
    });

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.positionAt(code.length)
    );
    edit.replace(editor.document.uri, fullRange, response.data.code);
    await vscode.workspace.applyEdit(edit);

    vscode.window.showInformationMessage('✅ Issues fixed!');
  } catch (error) {
    vscode.window.showErrorMessage('❌ Fix failed');
  } finally {
    statusBarItem.text = "$(check) NOVA26";
  }
}

async function reviewCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const code = editor.document.getText();
  
  try {
    const response = await axios.post('http://localhost:3000/api/review', { code });
    
    outputChannel.clear();
    outputChannel.appendLine('🔍 Code Review Results');
    outputChannel.appendLine('=' .repeat(50));
    
    for (const issue of response.data.issues) {
      outputChannel.appendLine(\`[\${issue.severity.toUpperCase()}] \${issue.message}\`);
      outputChannel.appendLine(\`  File: \${issue.file}:\${issue.line}\`);
      outputChannel.appendLine(\`  Suggestion: \${issue.suggestion}\\n\`);
    }
    
    outputChannel.show();
  } catch (error) {
    vscode.window.showErrorMessage('❌ Review failed');
  }
}

async function swarmMode() {
  const task = await vscode.window.showInputBox({
    prompt: 'Describe the task for the agent swarm',
    placeHolder: 'e.g., Build a complete authentication system'
  });

  if (!task) return;

  const terminal = vscode.window.createTerminal('NOVA26 Swarm');
  terminal.sendText(\`cd \${vscode.workspace.rootPath} && nova26 swarm "\${task}"\`);
  terminal.show();
}

async function showStatus() {
  try {
    const response = await axios.get('http://localhost:3000/api/status');
    const status = response.data;
    
    vscode.window.showInformationMessage(
      \`Build: \${status.buildId} | Phase: \${status.phase} | Tasks: \${status.completed}/\${status.total}\`
    );
  } catch {
    vscode.window.showWarningMessage('NOVA26 server not running');
  }
}

// Inline completion provider
class NovaInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(document, position, context, token) {
    const config = vscode.workspace.getConfiguration('nova26');
    if (!config.get('autoSuggest')) return;

    const linePrefix = document.lineAt(position).text.slice(0, position.character);
    
    // Only trigger on specific patterns
    if (!this.shouldTrigger(linePrefix)) return;

    try {
      const response = await axios.post('http://localhost:3000/api/complete', {
        code: document.getText(),
        position: { line: position.line, character: position.character },
        prefix: linePrefix,
      });

      const item = new vscode.InlineCompletionItem(response.data.suggestion);
      return [item];
    } catch {
      return;
    }
  }

  shouldTrigger(linePrefix: string): boolean {
    const triggers = ['// ', '/* ', 'function ', 'const ', 'let ', 'type '];
    return triggers.some(t => linePrefix.endsWith(t));
  }
}

// Tree data provider for build status
class BuildStatusProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!element) {
      // Root items
      return Promise.resolve([
        new vscode.TreeItem('Current Build', vscode.TreeItemCollapsibleState.Collapsed),
        new vscode.TreeItem('Recent Builds', vscode.TreeItemCollapsibleState.Collapsed),
      ]);
    }
    return Promise.resolve([]);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function acceptSuggestion() {
  // Accept current inline suggestion
}

function rejectSuggestion() {
  // Reject current inline suggestion
}

export function deactivate() {}
`;

// Installation script
export const installScript = `#!/bin/bash
# Install NOVA26 VS Code Extension

echo "📦 Installing NOVA26 VS Code Extension..."

# Create extension directory
mkdir -p ~/.vscode/extensions/nova26-1.0.0

# Write manifest
cat > ~/.vscode/extensions/nova26-1.0.0/package.json << 'EOF'
${JSON.stringify(extensionManifest, null, 2)}
EOF

# Write extension code
cat > ~/.vscode/extensions/nova26-1.0.0/out/extension.js << 'EOF'
${extensionCode}
EOF

echo "✅ Extension installed!"
echo "Please reload VS Code to activate."
`;

// Webview content for diff view
export function createDiffView(original: string, modified: string, description: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
    .header { margin-bottom: 20px; }
    .diff-container { display: flex; gap: 20px; }
    .side { flex: 1; }
    .side h3 { margin-top: 0; }
    .code { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
    .code pre { margin: 0; font-family: 'Monaco', monospace; font-size: 12px; }
    .actions { margin-top: 20px; display: flex; gap: 10px; }
    button { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    .accept { background: #28a745; color: white; }
    .reject { background: #dc3545; color: white; }
    .line-removed { background: #ffe6e6; }
    .line-added { background: #e6ffe6; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${description}</h2>
    <p>Review the changes proposed by NOVA26</p>
  </div>
  
  <div class="diff-container">
    <div class="side">
      <h3>Original</h3>
      <div class="code"><pre>${escapeHtml(original)}</pre></div>
    </div>
    <div class="side">
      <h3>Modified</h3>
      <div class="code"><pre>${escapeHtml(modified)}</pre></div>
    </div>
  </div>
  
  <div class="actions">
    <button class="accept" onclick="accept()">Accept Changes</button>
    <button class="reject" onclick="reject()">Reject</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    function accept() {
      vscode.postMessage({ command: 'accept', modified: ${JSON.stringify(modified)} });
    }
    
    function reject() {
      vscode.postMessage({ command: 'reject' });
    }
  </script>
</body>
</html>
`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Export installer
export async function installVSCodeExtension(): Promise<void> {
  console.log('📦 VS Code Extension Installation');
  console.log('===================================');
  console.log('');
  console.log('To install the NOVA26 VS Code extension:');
  console.log('');
  console.log('1. Create extension directory:');
  console.log('   mkdir -p ~/.vscode/extensions/nova26-1.0.0');
  console.log('');
  console.log('2. The extension will be available on the VS Code Marketplace soon.');
  console.log('');
  console.log('3. Until then, use the CLI:');
  console.log('   nova26 generate "Create a login form"');
  console.log('');
}
