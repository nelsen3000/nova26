// Tool Parser Tests

import { describe, it, expect } from 'vitest';
import {
  parseXmlToolCalls,
  parseNativeToolCalls,
  parseToolCalls,
  extractFinalOutput,
  hasToolCalls,
  hasFinalOutput,
  stripToolCalls,
  formatToolResults,
} from './tool-parser.js';

// ============================================================================
// XML Parsing
// ============================================================================

describe('parseXmlToolCalls', () => {
  it('should parse a single tool call', () => {
    const response = `Let me read that file.
<tool_call>
{"name": "readFile", "arguments": {"path": "src/index.ts"}}
</tool_call>`;

    const calls = parseXmlToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('readFile');
    expect(calls[0].arguments).toEqual({ path: 'src/index.ts' });
    expect(calls[0].id).toMatch(/^tc_/);
  });

  it('should parse multiple tool calls', () => {
    const response = `
<tool_call>
{"name": "readFile", "arguments": {"path": "a.ts"}}
</tool_call>
Some reasoning here.
<tool_call>
{"name": "searchCode", "arguments": {"pattern": "TODO"}}
</tool_call>`;

    const calls = parseXmlToolCalls(response);
    expect(calls).toHaveLength(2);
    expect(calls[0].name).toBe('readFile');
    expect(calls[1].name).toBe('searchCode');
  });

  it('should skip invalid JSON in tool_call blocks', () => {
    const response = `
<tool_call>
not valid json
</tool_call>
<tool_call>
{"name": "readFile", "arguments": {"path": "b.ts"}}
</tool_call>`;

    const calls = parseXmlToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('readFile');
  });

  it('should handle empty arguments', () => {
    const response = `<tool_call>
{"name": "checkTypes"}
</tool_call>`;

    const calls = parseXmlToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('checkTypes');
    expect(calls[0].arguments).toEqual({});
  });

  it('should return empty array for no tool calls', () => {
    const calls = parseXmlToolCalls('Just some text with no tools.');
    expect(calls).toEqual([]);
  });
});

// ============================================================================
// Native JSON Parsing
// ============================================================================

describe('parseNativeToolCalls', () => {
  it('should parse Ollama-format tool calls', () => {
    const message = {
      tool_calls: [
        {
          id: 'call_1',
          function: {
            name: 'readFile',
            arguments: { path: 'src/index.ts' },
          },
        },
      ],
    };

    const calls = parseNativeToolCalls(message);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('readFile');
    expect(calls[0].id).toBe('call_1');
  });

  it('should handle string arguments', () => {
    const message = {
      tool_calls: [
        {
          function: {
            name: 'readFile',
            arguments: '{"path": "src/index.ts"}',
          },
        },
      ],
    };

    const calls = parseNativeToolCalls(message);
    expect(calls).toHaveLength(1);
    expect(calls[0].arguments).toEqual({ path: 'src/index.ts' });
  });

  it('should generate IDs when missing', () => {
    const message = {
      tool_calls: [{ function: { name: 'checkTypes', arguments: {} } }],
    };

    const calls = parseNativeToolCalls(message);
    expect(calls[0].id).toMatch(/^tc_/);
  });

  it('should return empty for no tool_calls', () => {
    expect(parseNativeToolCalls({})).toEqual([]);
    expect(parseNativeToolCalls({ tool_calls: undefined })).toEqual([]);
  });
});

// ============================================================================
// Auto-detect Parsing
// ============================================================================

describe('parseToolCalls', () => {
  it('should detect XML format', () => {
    const response = '<tool_call>\n{"name": "readFile", "arguments": {"path": "x.ts"}}\n</tool_call>';
    const calls = parseToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('readFile');
  });

  it('should fall back to JSON code blocks', () => {
    const response = 'I need to read the file:\n```json\n{"tool": "readFile", "args": {"path": "x.ts"}}\n```';
    const calls = parseToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('readFile');
  });

  it('should support name/arguments format in JSON blocks', () => {
    const response = '```json\n{"name": "searchCode", "arguments": {"pattern": "TODO"}}\n```';
    const calls = parseToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('searchCode');
  });

  it('should return empty for no tool calls', () => {
    expect(parseToolCalls('Just regular text.')).toEqual([]);
  });

  it('should prefer XML over JSON blocks', () => {
    const response = `<tool_call>
{"name": "readFile", "arguments": {"path": "xml.ts"}}
</tool_call>
\`\`\`json
{"tool": "searchCode", "args": {"pattern": "json"}}
\`\`\``;

    const calls = parseToolCalls(response);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('readFile');
  });
});

// ============================================================================
// Final Output Extraction
// ============================================================================

describe('extractFinalOutput', () => {
  it('should extract content from final_output tags', () => {
    const response = 'Some reasoning.\n<final_output>\nHere is the code.\n</final_output>';
    expect(extractFinalOutput(response)).toBe('Here is the code.');
  });

  it('should return null when no final_output tags', () => {
    expect(extractFinalOutput('Just text')).toBeNull();
  });

  it('should handle multiline content', () => {
    const response = `<final_output>
Line 1
Line 2
Line 3
</final_output>`;
    const output = extractFinalOutput(response);
    expect(output).toContain('Line 1');
    expect(output).toContain('Line 3');
  });
});

// ============================================================================
// Detection Helpers
// ============================================================================

describe('hasToolCalls', () => {
  it('should detect XML tool calls', () => {
    expect(hasToolCalls('<tool_call>{"name": "x"}</tool_call>')).toBe(true);
  });

  it('should return false for no tool calls', () => {
    expect(hasToolCalls('plain text')).toBe(false);
  });
});

describe('hasFinalOutput', () => {
  it('should detect final output tags', () => {
    expect(hasFinalOutput('<final_output>done</final_output>')).toBe(true);
  });

  it('should return false when absent', () => {
    expect(hasFinalOutput('no final output here')).toBe(false);
  });
});

describe('stripToolCalls', () => {
  it('should remove tool call and final output tags', () => {
    const response = 'Reasoning here.\n<tool_call>{"name":"x"}</tool_call>\nMore text.\n<final_output>done</final_output>';
    const stripped = stripToolCalls(response);
    expect(stripped).toContain('Reasoning here.');
    expect(stripped).toContain('More text.');
    expect(stripped).not.toContain('<tool_call>');
    expect(stripped).not.toContain('<final_output>');
  });
});

// ============================================================================
// Result Formatting
// ============================================================================

describe('formatToolResults', () => {
  it('should format successful results', () => {
    const calls = [{ id: 'tc_1', name: 'readFile', arguments: { path: 'x.ts' } }];
    const results = [{ success: true, output: 'file contents here' }];

    const formatted = formatToolResults(calls, results);
    expect(formatted).toContain('<tool_result name="readFile" id="tc_1">');
    expect(formatted).toContain('file contents here');
    expect(formatted).toContain('</tool_result>');
  });

  it('should format error results', () => {
    const calls = [{ id: 'tc_2', name: 'readFile', arguments: { path: 'missing.ts' } }];
    const results = [{ success: false, output: '', error: 'File not found' }];

    const formatted = formatToolResults(calls, results);
    expect(formatted).toContain('ERROR: File not found');
  });

  it('should format multiple results', () => {
    const calls = [
      { id: 'tc_1', name: 'readFile', arguments: {} },
      { id: 'tc_2', name: 'searchCode', arguments: {} },
    ];
    const results = [
      { success: true, output: 'file' },
      { success: true, output: 'search results' },
    ];

    const formatted = formatToolResults(calls, results);
    expect(formatted).toContain('tc_1');
    expect(formatted).toContain('tc_2');
  });
});
