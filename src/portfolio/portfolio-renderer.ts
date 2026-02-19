// Portfolio CLI Output & Status Display
// KIMI-PORTFOLIO-04: R16-01 spec

import type { 
  Portfolio, 
  PortfolioProject, 
  PortfolioPattern, 
  PatternLineage 
} from './portfolio-manifest.js';
import type { 
  ProjectSimilarity, 
  CrossProjectInsight 
} from './similarity-engine.js';
import type { SkillGrowthAnalysis } from './pattern-detection.js';

// ============================================================================
// Types
// ============================================================================

export interface RenderOptions {
  format: 'terminal' | 'json' | 'markdown';
  compact: boolean;
  includeInsights: boolean;
  includePatterns: boolean;
  includeLineage: boolean;
  maxProjects: number;
  maxPatterns: number;
}

export interface PortfolioStatus {
  summary: PortfolioSummary;
  recentProjects: RenderedProject[];
  skillTrends: RenderedSkillTrend[];
  portfolioPatterns: RenderedPattern[];
  crossProjectInsights: RenderedInsight[];
  warnings: string[];
}

export interface PortfolioSummary {
  totalProjects: number;
  activeProjects: number;
  averageAceScore: number;
  totalPatterns: number;
  portfolioPatterns: number;
  skillTrend: 'improving' | 'stable' | 'declining';
}

export interface RenderedProject {
  name: string;
  type: string;
  language: string;
  aceScore: number;
  lastBuild: string;
  status: 'active' | 'stale' | 'archived';
}

export interface RenderedSkillTrend {
  dimension: string;
  trend: 'improving' | 'stable' | 'declining';
  current: number;
  baseline: number;
  indicator: string;
}

export interface RenderedPattern {
  name: string;
  scope: 'project' | 'portfolio' | 'global';
  quality: number;
  occurrences: number;
  isAntiPattern: boolean;
}

export interface RenderedInsight {
  type: 'better-pattern' | 'anti-pattern' | 'new-project-match' | 'skill-growth';
  title: string;
  description: string;
  source?: string;
  target?: string;
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_OPTIONS: RenderOptions = {
  format: 'terminal',
  compact: false,
  includeInsights: true,
  includePatterns: true,
  includeLineage: false,
  maxProjects: 10,
  maxPatterns: 10,
};

// ============================================================================
// PortfolioRenderer Class
// ============================================================================

export class PortfolioRenderer {
  private options: RenderOptions;

  constructor(options?: Partial<RenderOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ---- Main Render Methods ----

  renderPortfolio(
    portfolio: Portfolio,
    skillAnalysis: SkillGrowthAnalysis,
    insights: CrossProjectInsight[]
  ): string {
    switch (this.options.format) {
      case 'json':
        return this.renderJson(portfolio, skillAnalysis, insights);
      case 'markdown':
        return this.renderMarkdown(portfolio, skillAnalysis, insights);
      case 'terminal':
      default:
        return this.renderTerminal(portfolio, skillAnalysis, insights);
    }
  }

  renderStatus(portfolio: Portfolio, skillAnalysis: SkillGrowthAnalysis, insights: CrossProjectInsight[] = []): PortfolioStatus {
    const activeProjects = portfolio.projects.filter(p => !p.isArchived).length;
    const scores = portfolio.projects.map(p => p.aceScoreHistory[p.aceScoreHistory.length - 1]?.score || 0);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    const summary: PortfolioSummary = {
      totalProjects: portfolio.projects.length,
      activeProjects,
      averageAceScore: Math.round(avgScore),
      totalPatterns: portfolio.projects.reduce((sum, p) => sum + p.patternCount, 0),
      portfolioPatterns: portfolio.portfolioPatterns.filter((p: PortfolioPattern) => p.scope === 'portfolio').length,
      skillTrend: skillAnalysis.overallTrend,
    };

    // Get recent projects (sorted by lastBuildAt descending)
    const recentProjects = [...portfolio.projects]
      .sort((a, b) => new Date(b.lastBuildAt).getTime() - new Date(a.lastBuildAt).getTime())
      .slice(0, this.options.maxProjects)
      .map(p => this.renderProjectBrief(p));

    // Get skill trends
    const skillTrends = skillAnalysis.dimensions.map(d => ({
      dimension: d.dimension,
      trend: d.trend,
      current: Math.round(d.rollingAverage5Projects),
      baseline: Math.round(d.allTimeAverage),
      indicator: d.trend === 'improving' ? '↑' : d.trend === 'declining' ? '↓' : '→',
    }));

    // Get portfolio patterns
    const portfolioPatterns = portfolio.portfolioPatterns
      .filter((p: PortfolioPattern) => p.scope === 'portfolio')
      .slice(0, this.options.maxPatterns)
      .map((p: PortfolioPattern) => ({
        name: p.name,
        scope: p.scope,
        quality: Math.round(p.averageQualityScore),
        occurrences: p.occurrenceCount,
        isAntiPattern: p.isAntiPattern,
      }));

    // Get insights
    const crossProjectInsights = insights.slice(0, 5).map(i => ({
      type: i.type,
      title: i.title,
      description: i.description,
      source: i.sourceProjectId,
      target: i.targetProjectId,
    }));

    // Generate warnings
    const warnings = this.generateWarnings(portfolio, skillAnalysis);

    return {
      summary,
      recentProjects,
      skillTrends,
      portfolioPatterns,
      crossProjectInsights,
      warnings,
    };
  }

  // ---- Terminal Format ----

  private renderTerminal(
    portfolio: Portfolio,
    skillAnalysis: SkillGrowthAnalysis,
    insights: CrossProjectInsight[]
  ): string {
    const lines: string[] = [];
    const status = this.renderStatus(portfolio, skillAnalysis, insights);

    // Header
    lines.push('');
    lines.push('┌─────────────────────────────────────────────────────────────┐');
    lines.push('│  🚀 NOVA PORTFOLIO DASHBOARD                                │');
    lines.push('└─────────────────────────────────────────────────────────────┘');
    lines.push('');

    // Summary
    lines.push('📊 PORTFOLIO SUMMARY');
    lines.push(`   Total Projects: ${status.summary.totalProjects} (${status.summary.activeProjects} active)`);
    lines.push(`   Average ACE Score: ${this.formatScore(status.summary.averageAceScore)}`);
    lines.push(`   Portfolio Patterns: ${status.summary.portfolioPatterns}`);
    lines.push(`   Skill Trend: ${this.formatTrend(status.summary.skillTrend)}`);
    lines.push('');

    // Recent Projects
    lines.push('📁 RECENT PROJECTS');
    for (const project of status.recentProjects) {
      const statusIcon = project.status === 'active' ? '●' : project.status === 'stale' ? '◐' : '○';
      lines.push(`   ${statusIcon} ${project.name.padEnd(20)} ${this.formatScore(project.aceScore)} ${project.language}`);
    }
    if (portfolio.projects.length > this.options.maxProjects) {
      lines.push(`   ... and ${portfolio.projects.length - this.options.maxProjects} more`);
    }
    lines.push('');

    // Skill Trends
    lines.push('📈 SKILL GROWTH');
    for (const trend of status.skillTrends) {
      const bar = this.renderBar(trend.current, 100, 20);
      lines.push(`   ${trend.indicator} ${trend.dimension.padEnd(15)} ${bar} ${trend.current}/${trend.baseline}`);
    }
    lines.push('');

    // Portfolio Patterns
    if (this.options.includePatterns && status.portfolioPatterns.length > 0) {
      lines.push('🔧 PORTFOLIO PATTERNS');
      for (const pattern of status.portfolioPatterns) {
        const icon = pattern.isAntiPattern ? '⚠️' : '✓';
        lines.push(`   ${icon} ${pattern.name.padEnd(25)} Q:${pattern.quality} Used:${pattern.occurrences}x`);
      }
      lines.push('');
    }

    // Insights
    if (this.options.includeInsights && status.crossProjectInsights.length > 0) {
      lines.push('💡 CROSS-PROJECT INSIGHTS');
      for (const insight of status.crossProjectInsights.slice(0, 3)) {
        const typeIcon = insight.type === 'anti-pattern' ? '⚠️' : insight.type === 'better-pattern' ? '💡' : '🔗';
        // Truncate long descriptions
        const description = insight.description.length > 55 
          ? insight.description.substring(0, 52) + '...' 
          : insight.description;
        lines.push(`   ${typeIcon} ${insight.title}: ${description}`);
      }
      lines.push('');
    }

    // Warnings
    if (status.warnings.length > 0) {
      lines.push('⚠️  WARNINGS');
      for (const warning of status.warnings.slice(0, 3)) {
        lines.push(`   • ${warning}`);
      }
      lines.push('');
    }

    // Skill Summary
    lines.push('📝 SUMMARY');
    lines.push(`   ${skillAnalysis.summary}`);
    lines.push('');

    return lines.join('\n');
  }

  // ---- JSON Format ----

  private renderJson(
    portfolio: Portfolio,
    skillAnalysis: SkillGrowthAnalysis,
    insights: CrossProjectInsight[]
  ): string {
    const status = this.renderStatus(portfolio, skillAnalysis, insights);
    return JSON.stringify(status, null, 2);
  }

  // ---- Markdown Format ----

  private renderMarkdown(
    portfolio: Portfolio,
    skillAnalysis: SkillGrowthAnalysis,
    insights: CrossProjectInsight[]
  ): string {
    const status = this.renderStatus(portfolio, skillAnalysis, insights);
    const lines: string[] = [];

    lines.push('# Nova Portfolio Dashboard');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Projects | ${status.summary.totalProjects} |`);
    lines.push(`| Active Projects | ${status.summary.activeProjects} |`);
    lines.push(`| Average ACE Score | ${status.summary.averageAceScore} |`);
    lines.push(`| Portfolio Patterns | ${status.summary.portfolioPatterns} |`);
    lines.push(`| Skill Trend | ${status.summary.skillTrend} |`);
    lines.push('');

    lines.push('## Recent Projects');
    lines.push('');
    lines.push(`| Project | Type | Language | ACE Score | Status |`);
    lines.push(`|---------|------|----------|-----------|--------|`);
    for (const project of status.recentProjects) {
      lines.push(`| ${project.name} | ${project.type} | ${project.language} | ${project.aceScore} | ${project.status} |`);
    }
    lines.push('');

    lines.push('## Skill Growth');
    lines.push('');
    lines.push(`| Dimension | Trend | Current | Baseline |`);
    lines.push(`|-----------|-------|---------|----------|`);
    for (const trend of status.skillTrends) {
      lines.push(`| ${trend.dimension} | ${trend.trend} ${trend.indicator} | ${trend.current} | ${trend.baseline} |`);
    }
    lines.push('');

    if (this.options.includePatterns && status.portfolioPatterns.length > 0) {
      lines.push('## Portfolio Patterns');
      lines.push('');
      lines.push(`| Pattern | Quality | Occurrences | Type |`);
      lines.push(`|---------|---------|-------------|------|`);
      for (const pattern of status.portfolioPatterns) {
        const type = pattern.isAntiPattern ? '⚠️ Anti-pattern' : '✓ Pattern';
        lines.push(`| ${pattern.name} | ${pattern.quality} | ${pattern.occurrences} | ${type} |`);
      }
      lines.push('');
    }

    if (this.options.includeInsights && status.crossProjectInsights.length > 0) {
      lines.push('## Cross-Project Insights');
      lines.push('');
      for (const insight of status.crossProjectInsights) {
        const typeIcon = insight.type === 'anti-pattern' ? '⚠️' : insight.type === 'better-pattern' ? '💡' : '🔗';
        lines.push(`### ${typeIcon} ${insight.title}`);
        lines.push(insight.description);
        if (insight.source && insight.target) {
          lines.push(`_Source: ${insight.source} → Target: ${insight.target}_`);
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push(`*Generated by Nova Portfolio Engine*`);
    lines.push(`*${skillAnalysis.summary}*`);

    return lines.join('\n');
  }

  // ---- Helper Methods ----

  private renderProjectBrief(project: PortfolioProject): RenderedProject {
    const daysSinceBuild = (Date.now() - new Date(project.lastBuildAt).getTime()) / (1000 * 60 * 60 * 24);
    let status: RenderedProject['status'] = 'active';
    if (project.isArchived) {
      status = 'archived';
    } else if (daysSinceBuild > 90) {
      status = 'stale';
    }

    const latestScore = project.aceScoreHistory[project.aceScoreHistory.length - 1]?.score || 0;

    return {
      name: project.name,
      type: project.type,
      language: project.primaryLanguage,
      aceScore: latestScore,
      lastBuild: project.lastBuildAt,
      status,
    };
  }

  private generateWarnings(portfolio: Portfolio, skillAnalysis: SkillGrowthAnalysis): string[] {
    const warnings: string[] = [];

    // Check for stale projects
    const staleProjects = portfolio.projects.filter(p => {
      const daysSinceBuild = (Date.now() - new Date(p.lastBuildAt).getTime()) / (1000 * 60 * 60 * 24);
      return !p.isArchived && daysSinceBuild > 90;
    });
    if (staleProjects.length > 0) {
      warnings.push(`${staleProjects.length} project(s) haven't been built in 90+ days`);
    }

    // Check for declining skills
    if (skillAnalysis.overallTrend === 'declining') {
      warnings.push('Skill trend is declining - consider reviewing recent projects');
    }

    // Check for low ACE scores
    const lowScoreProjects = portfolio.projects.filter(p => {
      const score = p.aceScoreHistory[p.aceScoreHistory.length - 1]?.score || 0;
      return score < 50;
    });
    if (lowScoreProjects.length > 0) {
      warnings.push(`${lowScoreProjects.length} project(s) have ACE scores below 50`);
    }

    return warnings;
  }

  private formatScore(score: number): string {
    if (score >= 80) return `🟢 ${score}`;
    if (score >= 60) return `🟡 ${score}`;
    if (score >= 40) return `🟠 ${score}`;
    return `🔴 ${score}`;
  }

  private formatTrend(trend: 'improving' | 'stable' | 'declining'): string {
    switch (trend) {
      case 'improving': return '📈 improving';
      case 'declining': return '📉 declining';
      case 'stable': return '➡️  stable';
    }
  }

  private renderBar(value: number, max: number, width: number): string {
    const filled = Math.round((value / max) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  // ---- Pattern Lineage Rendering ----

  renderLineage(pattern: PortfolioPattern, lineage: PatternLineage): string {
    if (!this.options.includeLineage) {
      return '';
    }

    const lines: string[] = [];
    lines.push(`\n📜 LINEAGE: ${pattern.name}`);
    lines.push(`   Quality: ${Math.round(pattern.averageQualityScore)}/100`);
    lines.push(`   Occurrences: ${pattern.occurrenceCount}`);
    lines.push('');

    lines.push('   Evolution:');
    for (const version of lineage.versions) {
      const marker = version.projectId === lineage.bestVersionProjectId ? '★' : ' ';
      lines.push(`   ${marker} ${new Date(version.builtAt).toLocaleDateString()} | ${version.projectName.padEnd(20)} | Q:${version.qualityScore}`);
    }

    return lines.join('\n');
  }

  renderSimilarityMatrix(
    projects: PortfolioProject[],
    similarities: Map<string, ProjectSimilarity[]>
  ): string {
    const lines: string[] = [];
    lines.push('');
    lines.push('🔗 PROJECT SIMILARITY MATRIX');
    lines.push('');

    // Get top similarities for each project
    for (const [projectId, sims] of similarities) {
      const project = projects.find(p => p.id === projectId);
      if (!project || sims.length === 0) continue;

      lines.push(`   ${project.name}:`);
      for (const sim of sims.slice(0, 3)) {
        const target = projects.find(p => p.id === sim.targetProjectId);
        if (!target) continue;

        const score = Math.round(sim.recencyWeightedScore * 100);
        const icon = score >= 80 ? '🔥' : score >= 60 ? '👍' : '💡';
        lines.push(`      ${icon} ${target.name.padEnd(20)} ${score}% similarity`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
