// Smart Retry System - Escalating retries with model switching
// Handles failures intelligently

import { getCurrentTier, selectTier, AVAILABLE_MODELS } from '../llm/model-router.js';
import { callLLM as callOllama } from '../llm/ollama-client.js';
import type { Task } from '../types/index.js';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

interface RetryAttempt {
  attempt: number;
  model: string;
  tier: string;
  strategy: string;
  success: boolean;
  error?: string;
  duration: number;
}

interface RetryResult {
  success: boolean;
  response?: string;
  attempts: RetryAttempt[];
  totalDuration: number;
  finalStrategy: string;
}

interface ErrorClassification {
  type: 'syntax' | 'logic' | 'timeout' | 'rate_limit' | 'context_length' | 'unknown';
  recoverable: boolean;
  suggestion: string;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 4,
  baseDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 30000,
};

// Error patterns for classification
const ERROR_PATTERNS: Array<{ pattern: RegExp; classification: ErrorClassification }> = [
  {
    pattern: /syntax.*error|unexpected token|missing semicolon/i,
    classification: { type: 'syntax', recoverable: true, suggestion: 'Fix syntax error and retry' },
  },
  {
    pattern: /timeout|timed out|took too long/i,
    classification: { type: 'timeout', recoverable: true, suggestion: 'Simplify prompt or use faster model' },
  },
  {
    pattern: /rate.*limit|too many requests/i,
    classification: { type: 'rate_limit', recoverable: true, suggestion: 'Wait and retry with backoff' },
  },
  {
    pattern: /context.*length|too long|maximum.*tokens/i,
    classification: { type: 'context_length', recoverable: true, suggestion: 'Reduce prompt size or chunk input' },
  },
  {
    pattern: /undefined|null reference|cannot read/i,
    classification: { type: 'logic', recoverable: true, suggestion: 'Add null checks and retry' },
  },
];

export class SmartRetrySystem {
  private config: RetryConfig;
  private attempts: RetryAttempt[] = [];

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute(
    _task: Task,
    prompt: string,
    initialModel: string,
    executeFn: (model: string, prompt: string) => Promise<string>
  ): Promise<RetryResult> {
    this.attempts = [];
    const startTime = Date.now();
    let currentModel = initialModel;
    let currentPrompt = prompt;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const attemptStart = Date.now();
      
      try {
        console.log(`🔄 Retry ${attempt}/${this.config.maxRetries}: Using ${currentModel}`);
        
        const response = await executeFn(currentModel, currentPrompt);
        
        const duration = Date.now() - attemptStart;
        this.attempts.push({
          attempt,
          model: currentModel,
          tier: getCurrentTier(),
          strategy: this.getStrategyName(attempt),
          success: true,
          duration,
        });

        return {
          success: true,
          response,
          attempts: this.attempts,
          totalDuration: Date.now() - startTime,
          finalStrategy: this.getStrategyName(attempt),
        };

      } catch (error) {
        const duration = Date.now() - attemptStart;
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        this.attempts.push({
          attempt,
          model: currentModel,
          tier: getCurrentTier(),
          strategy: this.getStrategyName(attempt),
          success: false,
          error: errorMsg,
          duration,
        });

        const classification = this.classifyError(errorMsg);
        console.log(`❌ Attempt ${attempt} failed: ${classification.type} - ${classification.suggestion}`);

        if (attempt === this.config.maxRetries) {
          break;
        }

        // Apply retry strategy
        const strategy = this.getStrategy(attempt, classification);
        currentModel = strategy.model;
        currentPrompt = strategy.modifyPrompt ? strategy.modifyPrompt(currentPrompt, errorMsg) : currentPrompt;

        // Wait before retry
        const delay = Math.min(
          this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
          this.config.maxDelay
        );
        
        if (classification.type === 'rate_limit') {
          console.log(`⏳ Rate limited. Waiting ${delay}ms...`);
        }
        
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      attempts: this.attempts,
      totalDuration: Date.now() - startTime,
      finalStrategy: 'failed',
    };
  }

  private classifyError(error: string): ErrorClassification {
    for (const { pattern, classification } of ERROR_PATTERNS) {
      if (pattern.test(error)) {
        return classification;
      }
    }
    return { type: 'unknown', recoverable: false, suggestion: 'Unknown error - may need manual intervention' };
  }

  private getStrategyName(attempt: number): string {
    const strategies = [
      'initial',
      'stronger_model',
      'context_chunking',
      'council_of_agents',
    ];
    return strategies[attempt - 1] || 'final';
  }

  private getStrategy(attempt: number, error: ErrorClassification): { model: string; modifyPrompt?: (prompt: string, error: string) => string } {
    switch (attempt) {
      case 1: {
        // Retry #1: Same model, but with error context
        return {
          model: this.getStrongerModel(),
          modifyPrompt: (prompt, error) => `${prompt}\n\nPrevious attempt failed with: ${error}\nPlease fix this error and try again.`,
        };
      }

      case 2: {
        // Retry #2: Upgrade to stronger model (free -> paid if available)
        const current = getCurrentTier();
        if (current === 'free') {
          console.log('🚀 Upgrading to paid tier for retry...');
          selectTier('paid');
        }
        
        const strongerModel = AVAILABLE_MODELS.find(m => m.name === 'gpt-4o') || AVAILABLE_MODELS[0];
        
        return {
          model: strongerModel.name,
          modifyPrompt: (prompt, error) => `Task: ${prompt}\n\nPrevious attempt with simpler model failed: ${error}\nThis is a complex task requiring careful attention.`,
        };
      }

      case 3: {
        // Retry #3: Chunk context if too long
        if (error.type === 'context_length') {
          return {
            model: AVAILABLE_MODELS.find(m => m.name === 'claude-3-opus')?.name || 'gpt-4o',
            modifyPrompt: (prompt) => {
              // Truncate prompt to fit
              const maxLen = 10000;
              if (prompt.length > maxLen) {
                return prompt.slice(0, maxLen) + '\n\n[Content truncated due to length...]';
              }
              return prompt;
            },
          };
        }
        
        return {
          model: 'claude-3-opus',
          modifyPrompt: (prompt, error) => `CRITICAL TASK - PREVIOUS FAILURES:\n${prompt}\n\nError history: ${error}\nThis requires expert-level implementation.`,
        };
      }

      case 4: {
        // Retry #4: Council of agents approach
        return {
          model: 'gpt-4o',
          modifyPrompt: (prompt, error) => `COUNCIL REVIEW REQUIRED:\n\nTask: ${prompt}\n\nMultiple agents have failed with: ${error}\n\nAs a senior architect, provide the most robust, production-ready solution. Consider:\n- All edge cases\n- Error handling\n- Performance\n- Security\n- Maintainability`,
        };
      }

      default:
        return { model: 'gpt-4o' };
    }
  }

  private getStrongerModel(): string {
    const current = getCurrentTier();
    if (current === 'free') {
      // Try to upgrade within free tier
      return 'qwen2.5:14b';
    }
    return 'gpt-4o';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getAttempts(): RetryAttempt[] {
    return this.attempts;
  }
}

// Specialized retry for code generation
export async function retryCodeGeneration(
  task: Task,
  prompt: string,
  validator: (code: string) => Promise<{ valid: boolean; errors: string[] }>
): Promise<{ code: string; attempts: number }> {
  const retrySystem = new SmartRetrySystem({ maxRetries: 3 });
  
  const result = await retrySystem.execute(task, prompt, 'qwen2.5:7b', async (model, p) => {
    // Call LLM
    const response = await callOllama(p, '', model);
    const code = response.content;
    
    // Validate
    const validation = await validator(code);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    return code;
  });

  if (!result.success) {
    throw new Error(`Failed after ${result.attempts.length} attempts`);
  }

  return {
    code: result.response!,
    attempts: result.attempts.length,
  };
}

// Retry with progressive enhancement
export async function progressiveEnhancement(
  basePrompt: string,
  enhancements: string[],
  executeFn: (prompt: string) => Promise<string>
): Promise<{ result: string; level: number }> {
  for (let i = 0; i < enhancements.length; i++) {
    const prompt = `${basePrompt}\n\n${enhancements.slice(0, i + 1).join('\n')}`;
    
    try {
      const result = await executeFn(prompt);
      return { result, level: i };
    } catch (error) {
      if (i === enhancements.length - 1) throw error;
      console.log(`Enhancement level ${i} failed, trying simpler approach...`);
    }
  }
  
  throw new Error('All enhancement levels failed');
}

// Format retry report
export function formatRetryReport(result: RetryResult): string {
  const lines = [
    '🔄 Smart Retry Report',
    '═══════════════════════════════════════════════════',
    `Success: ${result.success ? '✅' : '❌'}`,
    `Total Duration: ${result.totalDuration}ms`,
    `Attempts: ${result.attempts.length}`,
    '',
    'Attempt History:',
  ];

  for (const attempt of result.attempts) {
    const status = attempt.success ? '✅' : '❌';
    lines.push(`  ${status} Attempt ${attempt.attempt}: ${attempt.model} (${attempt.strategy})`);
    lines.push(`     Tier: ${attempt.tier} | Duration: ${attempt.duration}ms`);
    if (attempt.error) {
      lines.push(`     Error: ${attempt.error.slice(0, 60)}...`);
    }
  }

  lines.push('═══════════════════════════════════════════════════');
  return lines.join('\n');
}
