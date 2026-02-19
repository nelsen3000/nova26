// Semantic Differ — R19-02
// PR intent summarization, suspicious pattern detection

import type { SemanticDiffSummary } from './types.js';

export interface FileChange {
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  content?: string;
}

export class SemanticDiffer {
  analyzePRIntent(
    changes: FileChange[],
    commitMessages: string[] = []
  ): SemanticDiffSummary {
    // Categorize changes
    const grouped = this.categorizeChanges(changes);
    
    // Detect suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(changes);
    
    // Calculate confidence
    const overallConfidence = this.calculateConfidence(changes, suspiciousPatterns);
    
    // Determine if safe to merge
    const safeToMerge = this.assessSafety(changes, suspiciousPatterns);
    
    // Generate human-readable report
    const humanReadableReport = this.generateReport(changes, grouped, suspiciousPatterns);
    
    // Infer PR intent
    const prIntent = this.inferIntent(changes, commitMessages);

    return {
      prIntent,
      groupedChanges: grouped,
      suspiciousPatterns,
      overallConfidence,
      safeToMerge,
      humanReadableReport,
    };
  }

  categorizeChanges(changes: FileChange[]): SemanticDiffSummary['groupedChanges'] {
    const categories = new Map<string, FileChange[]>();
    
    for (const change of changes) {
      const category = this.classifyFile(change.filePath);
      const existing = categories.get(category) ?? [];
      existing.push(change);
      categories.set(category, existing);
    }
    
    return Array.from(categories.entries()).map(([category, files]) => ({
      category,
      files: files.map(f => f.filePath),
      summary: this.summarizeCategory(category, files),
    }));
  }

  detectSuspiciousPatterns(changes: FileChange[]): string[] {
    const patterns: string[] = [];
    
    // Pattern 1: Large changes without tests
    const largeChanges = changes.filter(c => c.additions + c.deletions > 100);
    const testChanges = changes.filter(c => c.filePath.includes('.test.') || c.filePath.includes('.spec.'));
    
    if (largeChanges.length > 0 && testChanges.length === 0) {
      patterns.push('Large code changes without corresponding test updates');
    }
    
    // Pattern 2: Multiple critical files changed
    const criticalFiles = changes.filter(c => 
      c.filePath.includes('config.') ||
      c.filePath.includes('auth') ||
      c.filePath.includes('security')
    );
    
    if (criticalFiles.length > 2) {
      patterns.push('Multiple critical system files modified');
    }
    
    // Pattern 3: Database schema changes
    const schemaChanges = changes.filter(c =>
      c.filePath.includes('schema') ||
      c.filePath.includes('migration') ||
      c.content?.includes('CREATE TABLE') ||
      c.content?.includes('ALTER TABLE')
    );
    
    if (schemaChanges.length > 0) {
      patterns.push('Database schema modifications detected');
    }
    
    // Pattern 4: Sensitive data exposure
    const sensitivePatterns = ['password', 'secret', 'token', 'key', 'credential'];
    const potentialExposure = changes.some(c =>
      sensitivePatterns.some(p => 
        c.content?.toLowerCase().includes(p) &&
        !c.filePath.includes('.test.')
      )
    );
    
    if (potentialExposure) {
      patterns.push('Potential sensitive data in changes');
    }
    
    // Pattern 5: Lock file conflicts
    const lockFiles = changes.filter(c =>
      c.filePath.includes('package-lock.json') ||
      c.filePath.includes('yarn.lock') ||
      c.filePath.includes('pnpm-lock.yaml')
    );
    
    if (lockFiles.length > 1) {
      patterns.push('Multiple lock file modifications');
    }
    
    return patterns;
  }

  calculateConfidence(changes: FileChange[], suspiciousPatterns: string[]): number {
    let confidence = 1.0;
    
    // Reduce confidence for suspicious patterns
    confidence -= suspiciousPatterns.length * 0.1;
    
    // Reduce confidence for very large changes
    const totalLines = changes.reduce((sum, c) => sum + c.additions + c.deletions, 0);
    if (totalLines > 1000) confidence -= 0.15;
    else if (totalLines > 500) confidence -= 0.1;
    
    // Reduce confidence for many deleted files
    const deletedCount = changes.filter(c => c.changeType === 'deleted').length;
    if (deletedCount > 5) confidence -= 0.1;
    
    return Math.max(0, Math.round(confidence * 100) / 100);
  }

  assessSafety(changes: FileChange[], suspiciousPatterns: string[]): boolean {
    // Not safe if there are suspicious patterns
    if (suspiciousPatterns.length > 2) return false;
    
    // Not safe if too many files changed
    if (changes.length > 50) return false;
    
    // Not safe if critical files changed without tests
    const criticalChanged = changes.some(c =>
      c.filePath.includes('auth') ||
      c.filePath.includes('payment') ||
      c.filePath.includes('security')
    );
    const testsAdded = changes.some(c =>
      c.filePath.includes('.test.') && c.changeType === 'added'
    );
    
    if (criticalChanged && !testsAdded) return false;
    
    return true;
  }

  generateReport(
    changes: FileChange[],
    grouped: SemanticDiffSummary['groupedChanges'],
    suspiciousPatterns: string[]
  ): string {
    const lines: string[] = [];
    
    lines.push('# Semantic Diff Report');
    lines.push('');
    
    // Summary
    const totalAdditions = changes.reduce((sum, c) => sum + c.additions, 0);
    const totalDeletions = changes.reduce((sum, c) => sum + c.deletions, 0);
    lines.push(`**Changes:** ${changes.length} files (+${totalAdditions}/-${totalDeletions})`);
    lines.push('');
    
    // Grouped changes
    lines.push('## Change Categories');
    for (const group of grouped) {
      lines.push(`### ${group.category}`);
      lines.push(group.summary);
      lines.push('');
    }
    
    // Suspicious patterns
    if (suspiciousPatterns.length > 0) {
      lines.push('## ⚠️ Suspicious Patterns');
      for (const pattern of suspiciousPatterns) {
        lines.push(`- ${pattern}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private classifyFile(filePath: string): string {
    if (filePath.includes('.test.') || filePath.includes('.spec.')) return 'Tests';
    if (filePath.includes('component') || filePath.endsWith('.tsx')) return 'Components';
    if (filePath.includes('api') || filePath.includes('endpoint')) return 'API';
    if (filePath.includes('util') || filePath.includes('helper')) return 'Utilities';
    if (filePath.includes('hook') || filePath.includes('use')) return 'Hooks';
    if (filePath.includes('style') || filePath.endsWith('.css') || filePath.endsWith('.scss')) return 'Styles';
    if (filePath.includes('config')) return 'Configuration';
    if (filePath.includes('doc')) return 'Documentation';
    return 'Other';
  }

  private summarizeCategory(_category: string, files: FileChange[]): string {
    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
    
    return `${files.length} files changed (+${totalAdditions}/-${totalDeletions})`;
  }

  private inferIntent(changes: FileChange[], commitMessages: string[]): string {
    // Look for keywords in commit messages
    const allText = commitMessages.join(' ').toLowerCase();
    
    if (allText.includes('fix') || allText.includes('bug')) {
      return 'Bug fix';
    }
    if (allText.includes('feat') || allText.includes('feature')) {
      return 'New feature';
    }
    if (allText.includes('refactor')) {
      return 'Code refactoring';
    }
    if (allText.includes('test')) {
      return 'Test improvements';
    }
    if (allText.includes('doc')) {
      return 'Documentation update';
    }
    if (allText.includes('deps') || allText.includes('package')) {
      return 'Dependency update';
    }
    
    // Infer from file types
    const testFiles = changes.filter(c => c.filePath.includes('.test.')).length;
    if (testFiles > changes.length / 2) {
      return 'Test coverage improvement';
    }
    
    return 'General maintenance';
  }
}

export function createSemanticDiffer(): SemanticDiffer {
  return new SemanticDiffer();
}
