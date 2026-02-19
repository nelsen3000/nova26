// Personality Engine — Adaptive agent communication style per user
// KIMI-FRONTIER-04: Grok R13-04 spec

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import type { AgentName } from './message-bus.js';

// ============================================================================
// Core Types
// ============================================================================

export interface PersonalityDimensions {
  verbosity: number;
  formality: number;
  explanationDepth: number;
  technicalDensity: number;
  encouragement: number;
}

export interface PersonalityProfile {
  agentName: AgentName;
  dimensions: PersonalityDimensions;
  lastUpdatedAt: string;
  observationCount: number;
  lockedDimensions?: Array<keyof PersonalityDimensions>;
  version: number;
}

export type PersonalitySignal =
  | 'USER_TRUNCATED_OUTPUT'
  | 'USER_ASKED_FOR_MORE_DETAIL'
  | 'USER_EDITED_FORMALITY_UP'
  | 'USER_EDITED_FORMALITY_DOWN'
  | 'USER_ASKED_FOR_LESS_JARGON'
  | 'USER_POSITIVE_REACTION'
  | 'USER_SKIPPED_ENCOURAGEMENT'
  // Test-friendly aliases
  | 'MORE_DETAIL'
  | 'LESS_DETAIL'
  | 'USE_FORMAL'
  | 'USE_CASUAL'
  | 'MORE_TECHNICAL'
  | 'LESS_TECHNICAL'
  | 'SHOW_EMPATHY'
  | 'GET_TO_POINT'
  | 'RESET';

// ============================================================================
// Zod Schemas
// ============================================================================

export const PersonalityDimensionsSchema = z.object({
  verbosity: z.number().int().min(1).max(10),
  formality: z.number().int().min(1).max(10),
  explanationDepth: z.number().int().min(1).max(10),
  technicalDensity: z.number().int().min(1).max(10),
  encouragement: z.number().int().min(1).max(10),
});

export const PersonalityProfileSchema = z.object({
  agentName: z.string(),
  dimensions: PersonalityDimensionsSchema,
  lastUpdatedAt: z.string(),
  observationCount: z.number().int().nonnegative(),
  lockedDimensions: z.array(z.string()).optional(),
});

// ============================================================================
// PersonalityEngine Class
// ============================================================================

class PersonalityEngine {
  private profileDir: string;
  private profileCache: Map<AgentName, PersonalityProfile> = new Map();

  constructor(options?: { profileDir?: string }) {
    this.profileDir = options?.profileDir ?? join(process.cwd(), '.nova', 'personalities');
  }

  // ---- Default personalities per agent ----

  getDefaultProfile(agentName: AgentName): PersonalityProfile {
    const defaults: Record<string, PersonalityDimensions> = {
      // MARS (implementor): concise + highly technical + low encouragement
      MARS: { verbosity: 3, formality: 6, explanationDepth: 3, technicalDensity: 9, encouragement: 2 },
      // VENUS (UI/UX): warm + visual + moderate explanation
      VENUS: { verbosity: 6, formality: 5, explanationDepth: 6, technicalDensity: 5, encouragement: 8 },
      // JUPITER (planner): detailed + strategic + formal
      JUPITER: { verbosity: 8, formality: 8, explanationDepth: 9, technicalDensity: 6, encouragement: 4 },
      // PLUTO (tester): verbose + technical + neutral encouragement
      PLUTO: { verbosity: 8, formality: 7, explanationDepth: 7, technicalDensity: 8, encouragement: 3 },
      // MERCURY (scaffold): terse + low explanation
      MERCURY: { verbosity: 4, formality: 6, explanationDepth: 4, technicalDensity: 7, encouragement: 3 },
      // SATURN (reviewer): formal + professional
      SATURN: { verbosity: 6, formality: 8, explanationDepth: 7, technicalDensity: 7, encouragement: 4 },
      // NEPTUNE (deploy): highly technical
      NEPTUNE: { verbosity: 5, formality: 6, explanationDepth: 6, technicalDensity: 9, encouragement: 3 },
      // URANUS (debug): terse
      URANUS: { verbosity: 4, formality: 5, explanationDepth: 5, technicalDensity: 8, encouragement: 2 },
      // EARTH (docs): thorough explanation
      EARTH: { verbosity: 7, formality: 6, explanationDepth: 9, technicalDensity: 6, encouragement: 6 },
    };

    const dimensions = defaults[agentName] ?? {
      // Balanced defaults for other agents
      verbosity: 5,
      formality: 6,
      explanationDepth: 5,
      technicalDensity: 6,
      encouragement: 5,
    };

    return {
      agentName,
      dimensions,
      lastUpdatedAt: new Date().toISOString(),
      observationCount: 0,
      lockedDimensions: [],
      version: 1,
    };
  }

  // ---- Profile management ----

  async loadProfile(agentName: AgentName): Promise<PersonalityProfile> {
    // Check cache first
    const cached = this.profileCache.get(agentName);
    if (cached) {
      return cached;
    }

    // Try to load from disk
    const filePath = join(this.profileDir, `${agentName}.json`);
    
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const validated = PersonalityProfileSchema.parse(parsed);
        
        // Ensure lockedDimensions is initialized
        if (!validated.lockedDimensions) {
          validated.lockedDimensions = [];
        }
        
        // Cast to correct type (agentName from schema is string, but should be AgentName)
        const profile = validated as PersonalityProfile;
        this.profileCache.set(agentName, profile);
        return profile;
      } catch (error) {
        console.warn(`PersonalityEngine: failed to load profile for ${agentName}:`, error);
      }
    }

    // Return default if no saved profile
    const defaultProfile = this.getDefaultProfile(agentName);
    this.profileCache.set(agentName, defaultProfile);
    return defaultProfile;
  }

  async saveProfile(profile: PersonalityProfile): Promise<void> {
    if (!existsSync(this.profileDir)) {
      mkdirSync(this.profileDir, { recursive: true });
    }

    const filePath = join(this.profileDir, `${profile.agentName}.json`);
    const validated = PersonalityProfileSchema.parse(profile);
    
    writeFileSync(filePath, JSON.stringify(validated, null, 2));
    this.profileCache.set(profile.agentName, profile);
  }

  // ---- Learning from signals ----

  async applySignal(agentName: AgentName, signal: PersonalitySignal): Promise<PersonalityProfile> {
    const profile = await this.loadProfile(agentName);
    const locked = profile.lockedDimensions ?? [];

    // Define adjustments
    const adjustments: Partial<Record<keyof PersonalityDimensions, number>> = {};

    switch (signal) {
      case 'USER_TRUNCATED_OUTPUT':
      case 'LESS_DETAIL':
        if (!locked.includes('verbosity')) {
          adjustments.verbosity = -1;
        }
        break;
      case 'USER_ASKED_FOR_MORE_DETAIL':
      case 'MORE_DETAIL':
        if (!locked.includes('explanationDepth')) {
          adjustments.explanationDepth = 1;
        }
        if (!locked.includes('verbosity')) {
          adjustments.verbosity = 1;
        }
        break;
      case 'USER_EDITED_FORMALITY_UP':
      case 'USE_FORMAL':
        if (!locked.includes('formality')) {
          adjustments.formality = 1;
        }
        break;
      case 'USER_EDITED_FORMALITY_DOWN':
      case 'USE_CASUAL':
        if (!locked.includes('formality')) {
          adjustments.formality = -1;
        }
        break;
      case 'USER_ASKED_FOR_LESS_JARGON':
      case 'LESS_TECHNICAL':
        if (!locked.includes('technicalDensity')) {
          adjustments.technicalDensity = -2;
        }
        break;
      case 'MORE_TECHNICAL':
        if (!locked.includes('technicalDensity')) {
          adjustments.technicalDensity = 2;
        }
        break;
      case 'USER_POSITIVE_REACTION':
      case 'SHOW_EMPATHY':
        if (!locked.includes('encouragement')) {
          adjustments.encouragement = 1;
        }
        break;
      case 'USER_SKIPPED_ENCOURAGEMENT':
      case 'GET_TO_POINT':
        if (!locked.includes('encouragement')) {
          adjustments.encouragement = -2;
        }
        break;
      case 'RESET':
        // Reset to defaults
        const defaultProfile = this.getDefaultProfile(agentName);
        await this.saveProfile(defaultProfile);
        return defaultProfile;
    }

    // Apply adjustments and clamp to [1, 10]
    for (const [key, delta] of Object.entries(adjustments)) {
      const dimKey = key as keyof PersonalityDimensions;
      profile.dimensions[dimKey] = Math.max(1, Math.min(10, profile.dimensions[dimKey] + delta));
    }

    // Update metadata
    profile.observationCount++;
    profile.lastUpdatedAt = new Date().toISOString();
    profile.version = (profile.version || 1) + 1;

    await this.saveProfile(profile);
    return profile;
  }

  async resetToDefaults(agentName: AgentName): Promise<PersonalityProfile> {
    const defaultProfile = this.getDefaultProfile(agentName);
    await this.saveProfile(defaultProfile);
    return defaultProfile;
  }

  // ---- Prompt injection ----

  async buildPersonalityInstructions(agentName: AgentName): Promise<string> {
    const profile = await this.loadProfile(agentName);
    const d = profile.dimensions;

    // Build descriptors
    const verbosityDesc = d.verbosity <= 3 ? 'Terse' : d.verbosity <= 6 ? 'Moderate' : 'Verbose';
    const formalityDesc = d.formality <= 3 ? 'Casual' : d.formality <= 6 ? 'Professional' : 'Formal';
    const depthDesc = d.explanationDepth <= 3 ? 'Brief' : d.explanationDepth <= 6 ? 'Balanced' : 'Thorough';
    const techDesc = d.technicalDensity <= 3 ? 'Plain' : d.technicalDensity <= 6 ? 'Technical' : 'Dense';
    const encourageDesc = d.encouragement <= 3 ? 'Neutral' : d.encouragement <= 6 ? 'Supportive' : 'Encouraging';

    // Build instructions
    const verbosityInstr = d.verbosity <= 3 
      ? 'Keep responses short — use bullet points, skip preamble.'
      : d.verbosity <= 6
      ? 'Balance detail with brevity.'
      : 'Provide thorough explanations and context.';

    const formalityInstr = d.formality <= 3
      ? 'Use casual language; emojis are OK when appropriate.'
      : d.formality <= 6
      ? 'Use professional language appropriate for work context.'
      : 'Use formal language with proper structure and etiquette.';

    const depthInstr = d.explanationDepth <= 3
      ? 'State conclusions without extensive reasoning.'
      : d.explanationDepth <= 6
      ? 'Provide key reasoning for major decisions.'
      : 'Explain every decision and its rationale in detail.';

    const techInstr = d.technicalDensity <= 3
      ? 'Use simple language; avoid jargon and type annotations in prose.'
      : d.technicalDensity <= 6
      ? 'Use appropriate technical terms where they clarify meaning.'
      : 'Use precise technical language, types, and implementation details.';

    const encourageInstr = d.encouragement <= 3
      ? 'Skip praise and motivational language.'
      : d.encouragement <= 6
      ? 'Acknowledge progress when significant.'
      : 'Celebrate progress and acknowledge good decisions frequently.';

    return `## Communication Style
Verbosity: ${verbosityDesc}. ${verbosityInstr}
Formality: ${formalityDesc}. ${formalityInstr}
Explanation depth: ${depthDesc}. ${depthInstr}
Technical density: ${techDesc}. ${techInstr}
Encouragement: ${encourageDesc}. ${encourageInstr}

SAFETY OVERRIDE: Always communicate security warnings, data loss risks, and breaking changes with full detail regardless of the above style settings.`;
  }

  // ---- Safety override ----

  isSafetyContent(text: string): boolean {
    const safetyPatterns = [
      'security', 'vulnerability', 'breaking change', 'data loss', 'deprecated',
      'critical', 'warning', 'danger', 'unsafe', 'exploit',
    ];
    
    const lowerText = text.toLowerCase();
    return safetyPatterns.some(p => lowerText.includes(p));
  }

  async adaptMessage(agentName: AgentName, text: string): Promise<string> {
    // Safety override: never truncate safety content
    if (this.isSafetyContent(text)) {
      return text;
    }

    const profile = await this.loadProfile(agentName);
    const d = profile.dimensions;

    // For low verbosity, truncate longer messages
    if (d.verbosity <= 3 && text.length > 200) {
      // Extract first sentence or truncate at 200 chars
      const firstSentence = text.split(/[.!?]\s+/)[0];
      if (firstSentence && firstSentence.length < text.length) {
        return firstSentence + '.';
      }
      return text.slice(0, 200) + '...';
    }

    return text;
  }

  async getAllProfiles(): Promise<PersonalityProfile[]> {
    const agents: AgentName[] = [
      'MARS', 'VENUS', 'MERCURY', 'JUPITER', 'SATURN', 'PLUTO',
      'ATLAS', 'GANYMEDE', 'IO', 'CALLISTO', 'MIMAS', 'NEPTUNE',
      'ANDROMEDA', 'ENCELADUS', 'SUN', 'EARTH', 'RALPH',
    ];

    const profiles: PersonalityProfile[] = [];
    for (const agentName of agents) {
      profiles.push(await this.loadProfile(agentName));
    }
    
    return profiles;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let instance: PersonalityEngine | null = null;

export function getPersonalityEngine(options?: ConstructorParameters<typeof PersonalityEngine>[0]): PersonalityEngine {
  if (!instance) {
    instance = new PersonalityEngine(options);
  }
  return instance;
}

export function resetPersonalityEngine(): void {
  instance = null;
}

export { PersonalityEngine };
