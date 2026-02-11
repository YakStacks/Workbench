/**
 * Natural Language Tool Dispatch - V3.0
 * Smart tool selection with scoring, disambiguation, and controlled chaining
 */

import { ToolManifest } from "./tool-manifest";
import { PermissionManager } from "./permissions";
import { PreviewManager, PreviewPlan } from "./dry-run";

// ============================================================================
// TYPES
// ============================================================================

export interface ToolCandidate {
  tool: ToolManifest;
  confidence: number; // 0-1
  reasoning: string;
  suggestedInput?: any;
  scoreBreakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  nameMatch: number;
  descriptionMatch: number;
  tagMatch: number;
  keywordMatch: number;
  usageBoost: number;
  recencyBoost: number;
  stabilityBonus: number;
  total: number;
}

export interface ToolDispatchPlan {
  selectedTool: ToolManifest;
  input: any;
  confidence: number;
  reasoning: string;
  alternatives?: ToolCandidate[];
  requiresConfirmation: boolean;
  preview?: PreviewPlan;
  // V3: disambiguation
  needsDisambiguation?: boolean;
  disambiguationPrompt?: string;
}

export interface DispatchResult {
  plan: ToolDispatchPlan;
  approved: boolean;
  executed: boolean;
  result?: any;
  error?: string;
}

// V3: Disambiguation result
export interface DisambiguationResult {
  query: string;
  candidates: ToolCandidate[];
  prompt: string;
  resolved: boolean;
  selectedIndex?: number;
}

// V3: Tool usage tracking for smarter scoring
export interface ToolUsageRecord {
  toolName: string;
  count: number;
  lastUsed: number; // timestamp
  contexts: string[]; // recent query contexts (last 5)
  successRate: number; // 0-1
}

// V3: Chain step definition
export interface ChainStep {
  tool: string;
  input: any;
  outputKey?: string;
  description: string;
  dependsOn?: string[]; // outputKeys this step needs
}

// V3: Chain plan (multi-tool execution plan)
export interface ChainPlan {
  id: string;
  query: string;
  steps: ChainStep[];
  estimatedSteps: number;
  requiresApproval: boolean;
  reasoning: string;
  warnings: string[];
  status: 'draft' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: number;
  results?: Array<{ step: number; tool: string; status: 'success' | 'failed'; output?: any; error?: string }>;
}

// V3: LLM-based dispatch config
export interface DispatchConfig {
  disambiguationThreshold: number;    // Max gap between top-2 before disambiguating (default: 0.15)
  autoChainMaxSteps: number;          // Max steps in auto-generated chains (default: 5)
  usageHistoryWeight: number;         // Weight for usage history in scoring (default: 0.2)
  recencyDecayMs: number;             // Time window for recency boost (default: 30 min)
  minConfidenceForAutoExec: number;   // Min confidence to skip confirmation (default: 0.85)
}

const DEFAULT_DISPATCH_CONFIG: DispatchConfig = {
  disambiguationThreshold: 0.15,
  autoChainMaxSteps: 5,
  usageHistoryWeight: 0.2,
  recencyDecayMs: 30 * 60 * 1000, // 30 minutes
  minConfidenceForAutoExec: 0.85,
};

// ============================================================================
// TOOL USAGE TRACKER
// ============================================================================

export class ToolUsageTracker {
  private usage: Map<string, ToolUsageRecord> = new Map();

  constructor(savedUsage?: Record<string, ToolUsageRecord>) {
    if (savedUsage) {
      for (const [key, record] of Object.entries(savedUsage)) {
        this.usage.set(key, record);
      }
    }
  }

  recordUsage(toolName: string, query: string, success: boolean): void {
    const existing = this.usage.get(toolName) || {
      toolName,
      count: 0,
      lastUsed: 0,
      contexts: [],
      successRate: 1,
    };

    existing.count++;
    existing.lastUsed = Date.now();
    existing.contexts = [query, ...existing.contexts].slice(0, 5);

    // Rolling success rate
    const totalAttempts = existing.count;
    const previousSuccesses = existing.successRate * (totalAttempts - 1);
    existing.successRate = (previousSuccesses + (success ? 1 : 0)) / totalAttempts;

    this.usage.set(toolName, existing);
  }

  getUsage(toolName: string): ToolUsageRecord | undefined {
    return this.usage.get(toolName);
  }

  getUsageScore(toolName: string, recencyDecayMs: number): number {
    const record = this.usage.get(toolName);
    if (!record) return 0;

    // Frequency score: log scale, capped
    const freqScore = Math.min(Math.log2(record.count + 1) / 5, 1);

    // Recency score: exponential decay
    const elapsed = Date.now() - record.lastUsed;
    const recencyScore = Math.exp(-elapsed / recencyDecayMs);

    // Success rate factor
    const successFactor = record.successRate;

    return (freqScore * 0.4 + recencyScore * 0.4 + successFactor * 0.2);
  }

  /**
   * Check if query is contextually similar to recent usage of a tool
   */
  getContextAffinity(toolName: string, query: string): number {
    const record = this.usage.get(toolName);
    if (!record || record.contexts.length === 0) return 0;

    const queryKeywords = extractKeywords(query);
    if (queryKeywords.length === 0) return 0;

    let maxOverlap = 0;
    for (const ctx of record.contexts) {
      const ctxKeywords = extractKeywords(ctx);
      if (ctxKeywords.length === 0) continue;
      const overlap = queryKeywords.filter(k => ctxKeywords.includes(k)).length;
      const similarity = overlap / Math.max(queryKeywords.length, ctxKeywords.length);
      maxOverlap = Math.max(maxOverlap, similarity);
    }

    return maxOverlap;
  }

  serialize(): Record<string, ToolUsageRecord> {
    const obj: Record<string, ToolUsageRecord> = {};
    this.usage.forEach((v, k) => { obj[k] = v; });
    return obj;
  }
}

// ============================================================================
// SHARED KEYWORD EXTRACTION
// ============================================================================

const COMMON_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
  'can', 'could', 'may', 'might', 'must', 'to', 'from', 'in', 'on', 'at',
  'for', 'with', 'about', 'as', 'by', 'of', 'or', 'and', 'not', 'no',
  'but', 'so', 'if', 'then', 'than', 'that', 'this', 'it', 'its',
  'my', 'your', 'our', 'his', 'her', 'their', 'what', 'which', 'who',
  'how', 'when', 'where', 'why', 'all', 'each', 'every', 'any', 'some',
  'just', 'also', 'very', 'too', 'more', 'most', 'much', 'many',
  'please', 'want', 'need', 'like', 'use', 'get', 'make', 'run',
]);

function extractKeywords(text: string): string[] {
  return text.toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 2 && !COMMON_WORDS.has(w));
}

// ============================================================================
// V3 TOOL MATCHER (Enhanced)
// ============================================================================

export class ToolMatcher {
  private usageTracker: ToolUsageTracker;
  private config: DispatchConfig;

  constructor(usageTracker?: ToolUsageTracker, config?: Partial<DispatchConfig>) {
    this.usageTracker = usageTracker || new ToolUsageTracker();
    this.config = { ...DEFAULT_DISPATCH_CONFIG, ...config };
  }

  setUsageTracker(tracker: ToolUsageTracker): void {
    this.usageTracker = tracker;
  }

  /**
   * V3: Multi-signal tool scoring with detailed breakdown
   */
  scoreToolMatch(tool: ToolManifest, query: string): ScoreBreakdown {
    const queryLower = query.toLowerCase();
    const breakdown: ScoreBreakdown = {
      nameMatch: 0,
      descriptionMatch: 0,
      tagMatch: 0,
      keywordMatch: 0,
      usageBoost: 0,
      recencyBoost: 0,
      stabilityBonus: 0,
      total: 0,
    };

    // --- Name matching (0-100) ---
    const toolNameLower = tool.name.toLowerCase();
    const toolShortName = toolNameLower.split('.').pop() || toolNameLower;

    if (toolNameLower === queryLower || toolShortName === queryLower) {
      breakdown.nameMatch = 100;
    } else if (queryLower.includes(toolShortName) || toolShortName.includes(queryLower)) {
      breakdown.nameMatch = 60;
    } else {
      // Partial word match in name parts
      const nameParts = toolNameLower.split(/[._-]/);
      const queryParts = queryLower.split(/\s+/);
      const namePartMatches = nameParts.filter(np =>
        queryParts.some(qp => np.includes(qp) || qp.includes(np))
      );
      breakdown.nameMatch = Math.min(namePartMatches.length * 25, 50);
    }

    // --- Description matching (0-40) ---
    const queryKeywords = extractKeywords(query);
    const descKeywords = extractKeywords(tool.description);

    if (queryKeywords.length > 0 && descKeywords.length > 0) {
      const descMatches = queryKeywords.filter(k => descKeywords.includes(k));
      breakdown.descriptionMatch = Math.min((descMatches.length / queryKeywords.length) * 40, 40);
    }

    // --- Tag matching (0-30) ---
    if (tool.tags && tool.tags.length > 0) {
      for (const tag of tool.tags) {
        const tagLower = tag.toLowerCase();
        if (queryLower.includes(tagLower) || tagLower.includes(queryLower)) {
          breakdown.tagMatch += 15;
        } else if (queryKeywords.some(k => tagLower.includes(k))) {
          breakdown.tagMatch += 8;
        }
      }
      breakdown.tagMatch = Math.min(breakdown.tagMatch, 30);
    }

    // --- Keyword overlap (0-30) ---
    if (queryKeywords.length > 0 && descKeywords.length > 0) {
      const allToolKeywords = [
        ...descKeywords,
        ...(tool.tags || []).map(t => t.toLowerCase()),
        ...tool.name.toLowerCase().split(/[._-]/)
      ];
      const uniqueToolKeywords = Array.from(new Set(allToolKeywords));
      const keywordHits = queryKeywords.filter(k => uniqueToolKeywords.includes(k));
      breakdown.keywordMatch = Math.min(keywordHits.length * 10, 30);
    }

    // --- Usage history boost (0-20) ---
    const usageScore = this.usageTracker.getUsageScore(tool.name, this.config.recencyDecayMs);
    const contextAffinity = this.usageTracker.getContextAffinity(tool.name, query);
    breakdown.usageBoost = Math.round((usageScore * 0.6 + contextAffinity * 0.4) * 20);

    // --- Recency boost (0-10) ---
    const usage = this.usageTracker.getUsage(tool.name);
    if (usage) {
      const elapsed = Date.now() - usage.lastUsed;
      if (elapsed < this.config.recencyDecayMs) {
        breakdown.recencyBoost = Math.round((1 - elapsed / this.config.recencyDecayMs) * 10);
      }
    }

    // --- Stability bonus (0-10) ---
    if (tool.stability === 'stable') {
      breakdown.stabilityBonus = 10;
    } else if (tool.stability === 'beta') {
      breakdown.stabilityBonus = 5;
    }

    // Total
    breakdown.total = breakdown.nameMatch
      + breakdown.descriptionMatch
      + breakdown.tagMatch
      + breakdown.keywordMatch
      + breakdown.usageBoost
      + breakdown.recencyBoost
      + breakdown.stabilityBonus;

    return breakdown;
  }

  /**
   * V3: Find matching tools with detailed scoring
   */
  findMatchingTools(query: string, availableTools: ToolManifest[], limit: number = 5): ToolCandidate[] {
    const candidates: ToolCandidate[] = [];

    for (const tool of availableTools) {
      const breakdown = this.scoreToolMatch(tool, query);

      if (breakdown.total > 0) {
        candidates.push({
          tool,
          confidence: Math.min(breakdown.total / 140, 1), // 140 = realistic max for strong match
          reasoning: this.generateReasoning(tool, query, breakdown),
          scoreBreakdown: breakdown,
        });
      }
    }

    return candidates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * V3: Generate detailed reasoning from score breakdown
   */
  private generateReasoning(tool: ToolManifest, query: string, breakdown: ScoreBreakdown): string {
    const reasons: string[] = [];

    if (breakdown.nameMatch >= 60) {
      reasons.push(`Strong name match`);
    } else if (breakdown.nameMatch >= 25) {
      reasons.push(`Partial name match`);
    }

    if (breakdown.descriptionMatch >= 20) {
      reasons.push('Description matches query');
    }

    if (breakdown.tagMatch >= 15) {
      const matchingTags = (tool.tags || []).filter(t =>
        query.toLowerCase().includes(t.toLowerCase())
      );
      if (matchingTags.length > 0) {
        reasons.push(`Tags: ${matchingTags.join(', ')}`);
      }
    }

    if (breakdown.keywordMatch >= 10) {
      reasons.push(`Keyword overlap`);
    }

    if (breakdown.usageBoost >= 10) {
      reasons.push('Frequently used');
    }

    if (breakdown.recencyBoost >= 5) {
      reasons.push('Recently used');
    }

    if (reasons.length === 0) {
      reasons.push('Weak keyword match');
    }

    return reasons.join('; ');
  }
}

// ============================================================================
// PARAMETER INFERENCE
// ============================================================================

export class ParameterInferencer {
  /**
   * Infer tool parameters from natural language
   */
  inferParameters(tool: ToolManifest, query: string, context?: any): any {
    const input: any = {};

    // Extract quoted strings (could be file paths, search queries, etc.)
    const quotedMatches = query.match(/"([^"]+)"/g);
    if (quotedMatches) {
      input.query = quotedMatches[0].replace(/"/g, '');
    }

    // Extract file paths
    const pathMatches = query.match(/([A-Z]:\\[\w\s\\.-]+|\w+[\/\\][\w\s\/\\.-]+)/g);
    if (pathMatches && pathMatches.length > 0) {
      input.path = pathMatches[0];
    }

    // Extract URLs
    const urlMatches = query.match(/https?:\/\/[^\s]+/g);
    if (urlMatches && urlMatches.length > 0) {
      input.url = urlMatches[0];
    }

    // Extract numbers
    const numberMatches = query.match(/\b\d+\b/g);
    if (numberMatches && numberMatches.length > 0) {
      input.number = parseInt(numberMatches[0]);
    }

    // V3: Merge any context-provided defaults
    if (context && typeof context === 'object') {
      if (context.workingDir && !input.path) {
        input.cwd = context.workingDir;
      }
      if (context.lastOutput && !input.query) {
        input.previousResult = context.lastOutput;
      }
    }

    return input;
  }
}

// ============================================================================
// V3 DISAMBIGUATION ENGINE
// ============================================================================

export class DisambiguationEngine {
  private threshold: number;

  constructor(threshold: number = 0.15) {
    this.threshold = threshold;
  }

  /**
   * Check if disambiguation is needed between top candidates
   */
  needsDisambiguation(candidates: ToolCandidate[]): boolean {
    if (candidates.length < 2) return false;

    const top = candidates[0];
    const second = candidates[1];

    // If top confidence is already very high, no disambiguation needed
    if (top.confidence >= 0.85) return false;

    // If gap between top two is too small, disambiguate
    const gap = top.confidence - second.confidence;
    return gap < this.threshold;
  }

  /**
   * Generate a disambiguation prompt for the user
   */
  generatePrompt(query: string, candidates: ToolCandidate[]): DisambiguationResult {
    const topCandidates = candidates.slice(0, Math.min(candidates.length, 4));

    const options = topCandidates.map((c, i) => {
      const icon = c.tool.icon || '';
      const conf = (c.confidence * 100).toFixed(0);
      return `${i + 1}. ${icon} **${c.tool.name}** (${conf}%) — ${c.tool.description}`;
    });

    const prompt = `Multiple tools match your request. Which did you mean?\n\n${options.join('\n')}`;

    return {
      query,
      candidates: topCandidates,
      prompt,
      resolved: false,
    };
  }

  /**
   * Resolve disambiguation by user selection
   */
  resolve(disambiguation: DisambiguationResult, selectedIndex: number): DisambiguationResult {
    return {
      ...disambiguation,
      resolved: true,
      selectedIndex,
    };
  }
}

// ============================================================================
// V3 CHAIN PLANNER
// ============================================================================

export class ChainPlanner {
  private maxSteps: number;

  constructor(maxSteps: number = 5) {
    this.maxSteps = maxSteps;
  }

  /**
   * Build a chain plan from an LLM response
   * Expected LLM output format:
   * CHAIN:
   * 1. tool.name | {"param": "value"} | outputKey | description
   * 2. tool.name | {"param": "{{outputKey}}"} | outputKey2 | description
   */
  parseChainFromLLM(llmResponse: string, availableTools: Map<string, any>): ChainPlan | null {
    const chainMatch = llmResponse.match(/CHAIN:\s*\n([\s\S]+?)(?:\n\n|$)/);
    if (!chainMatch) return null;

    const lines = chainMatch[1].trim().split('\n').filter(l => l.trim());
    const steps: ChainStep[] = [];
    const warnings: string[] = [];

    for (const line of lines) {
      // Parse: "1. tool.name | {input} | outputKey | description"
      const stepMatch = line.match(/^\d+\.\s*(\S+)\s*\|\s*(\{[^}]*\})\s*\|\s*(\w+)?\s*\|\s*(.+)$/);
      if (!stepMatch) {
        // Try simpler format: "1. tool.name | description"
        const simpleMatch = line.match(/^\d+\.\s*(\S+)\s*\|\s*(.+)$/);
        if (simpleMatch) {
          const [, toolName, description] = simpleMatch;
          if (!availableTools.has(toolName)) {
            warnings.push(`Tool not found: ${toolName}`);
            continue;
          }
          steps.push({ tool: toolName, input: {}, description: description.trim() });
        }
        continue;
      }

      const [, toolName, inputJson, outputKey, description] = stepMatch;

      if (!availableTools.has(toolName)) {
        warnings.push(`Tool not found: ${toolName}`);
        continue;
      }

      let input: any = {};
      try {
        input = JSON.parse(inputJson);
      } catch {
        warnings.push(`Invalid input JSON for step: ${toolName}`);
      }

      // Detect dependencies from template variables
      const dependsOn: string[] = [];
      const templateVars = inputJson.match(/\{\{(\w+)\}\}/g);
      if (templateVars) {
        for (const tv of templateVars) {
          const key = tv.replace(/\{\{|\}\}/g, '');
          dependsOn.push(key);
        }
      }

      steps.push({
        tool: toolName,
        input,
        outputKey: outputKey || undefined,
        description: description.trim(),
        dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
      });
    }

    if (steps.length === 0) return null;
    if (steps.length > this.maxSteps) {
      warnings.push(`Plan truncated from ${steps.length} to ${this.maxSteps} steps`);
      steps.length = this.maxSteps;
    }

    return {
      id: `chain_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      query: '',
      steps,
      estimatedSteps: steps.length,
      requiresApproval: true,
      reasoning: '',
      warnings,
      status: 'draft',
    };
  }

  /**
   * Build a simple rule-based chain for common patterns
   */
  buildSimpleChain(query: string, availableTools: Map<string, any>): ChainPlan | null {
    const queryLower = query.toLowerCase();

    // Pattern: "read X then write Y" / "read and modify"
    if (queryLower.includes('read') && (queryLower.includes('write') || queryLower.includes('modify') || queryLower.includes('edit'))) {
      const pathMatch = query.match(/([A-Z]:\\[\w\s\\.-]+|[\w./\\-]+\.\w+)/);
      if (pathMatch && availableTools.has('builtin.readFile') && availableTools.has('builtin.writeFile')) {
        return {
          id: `chain_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          query,
          steps: [
            {
              tool: 'builtin.readFile',
              input: { path: pathMatch[0] },
              outputKey: 'fileContent',
              description: `Read file: ${pathMatch[0]}`,
            },
            {
              tool: 'builtin.writeFile',
              input: { path: pathMatch[0], content: '{{fileContent}}' },
              outputKey: 'writeResult',
              description: `Write modified content back`,
            },
          ],
          estimatedSteps: 2,
          requiresApproval: true,
          reasoning: 'Detected read-then-write pattern',
          warnings: ['Content modification must be specified before executing write step'],
          status: 'draft',
        };
      }
    }

    // Pattern: "list files in X then ..."
    if (queryLower.includes('list') && queryLower.includes('files')) {
      const pathMatch = query.match(/(?:in|from|at)\s+([^\s]+)/i);
      if (pathMatch && availableTools.has('builtin.listDir')) {
        return {
          id: `chain_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          query,
          steps: [
            {
              tool: 'builtin.listDir',
              input: { path: pathMatch[1] },
              outputKey: 'dirListing',
              description: `List directory: ${pathMatch[1]}`,
            },
          ],
          estimatedSteps: 1,
          requiresApproval: false,
          reasoning: 'Simple directory listing',
          warnings: [],
          status: 'draft',
        };
      }
    }

    return null;
  }

  /**
   * Validate a chain plan before execution
   */
  validateChain(plan: ChainPlan, availableTools: Map<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const availableOutputKeys = new Set<string>();

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      // Check tool exists
      if (!availableTools.has(step.tool)) {
        errors.push(`Step ${i + 1}: Tool "${step.tool}" not found`);
      }

      // Check dependencies are satisfied
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!availableOutputKeys.has(dep)) {
            errors.push(`Step ${i + 1}: Depends on "${dep}" which is not produced by any earlier step`);
          }
        }
      }

      if (step.outputKey) {
        availableOutputKeys.add(step.outputKey);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Format chain plan for user review
   */
  formatPlan(plan: ChainPlan): string {
    let output = `**Execution Plan** (${plan.estimatedSteps} step${plan.estimatedSteps !== 1 ? 's' : ''})\n\n`;

    if (plan.reasoning) {
      output += `_${plan.reasoning}_\n\n`;
    }

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const status = plan.results?.[i]
        ? (plan.results[i].status === 'success' ? '[done]' : '[failed]')
        : (plan.currentStep === i ? '[running]' : '[ ]');

      output += `${status} **Step ${i + 1}:** ${step.description}\n`;
      output += `   Tool: \`${step.tool}\`\n`;

      if (step.dependsOn && step.dependsOn.length > 0) {
        output += `   Needs: ${step.dependsOn.join(', ')}\n`;
      }
    }

    if (plan.warnings.length > 0) {
      output += `\n**Warnings:**\n`;
      plan.warnings.forEach(w => { output += `- ${w}\n`; });
    }

    return output;
  }
}

// ============================================================================
// V3 TOOL DISPATCHER (Enhanced)
// ============================================================================

export class ToolDispatcher {
  private matcher: ToolMatcher;
  private inferencer: ParameterInferencer;
  private permissionManager: PermissionManager;
  private previewManager: PreviewManager;
  private disambiguator: DisambiguationEngine;
  private chainPlanner: ChainPlanner;
  private usageTracker: ToolUsageTracker;
  private config: DispatchConfig;

  constructor(
    permissionManager: PermissionManager,
    previewManager: PreviewManager,
    config?: Partial<DispatchConfig>,
    savedUsage?: Record<string, ToolUsageRecord>
  ) {
    this.config = { ...DEFAULT_DISPATCH_CONFIG, ...config };
    this.usageTracker = new ToolUsageTracker(savedUsage);
    this.matcher = new ToolMatcher(this.usageTracker, this.config);
    this.inferencer = new ParameterInferencer();
    this.permissionManager = permissionManager;
    this.previewManager = previewManager;
    this.disambiguator = new DisambiguationEngine(this.config.disambiguationThreshold);
    this.chainPlanner = new ChainPlanner(this.config.autoChainMaxSteps);
  }

  // ---------- V2-compatible API ----------

  /**
   * Create a dispatch plan from natural language (V3-enhanced)
   */
  async createDispatchPlan(
    query: string,
    availableTools: ToolManifest[],
    context?: any
  ): Promise<ToolDispatchPlan | null> {
    const candidates = this.matcher.findMatchingTools(query, availableTools, 5);

    if (candidates.length === 0) {
      return null;
    }

    // V3: Check for disambiguation
    if (this.disambiguator.needsDisambiguation(candidates)) {
      const disambiguation = this.disambiguator.generatePrompt(query, candidates);
      const bestCandidate = candidates[0];
      const input = this.inferencer.inferParameters(bestCandidate.tool, query, context);

      return {
        selectedTool: bestCandidate.tool,
        input,
        confidence: bestCandidate.confidence,
        reasoning: bestCandidate.reasoning,
        alternatives: candidates.slice(1),
        requiresConfirmation: true,
        needsDisambiguation: true,
        disambiguationPrompt: disambiguation.prompt,
      };
    }

    const bestCandidate = candidates[0];
    const input = this.inferencer.inferParameters(bestCandidate.tool, query, context);
    const requiresConfirmation = this.shouldRequireConfirmation(bestCandidate);

    return {
      selectedTool: bestCandidate.tool,
      input,
      confidence: bestCandidate.confidence,
      reasoning: bestCandidate.reasoning,
      alternatives: candidates.slice(1),
      requiresConfirmation,
    };
  }

  /**
   * Suggest relevant tools (V2-compatible)
   */
  suggestTools(context: string, availableTools: ToolManifest[], limit: number = 3): ToolCandidate[] {
    const candidates = this.matcher.findMatchingTools(context, availableTools, limit);
    return candidates.filter(c => c.confidence >= 0.3);
  }

  /**
   * Format dispatch plan for user confirmation (V2-compatible)
   */
  formatPlanForConfirmation(plan: ToolDispatchPlan): string {
    let output = `**Tool Dispatch Plan**\n\n`;
    output += `**Selected:** ${plan.selectedTool.name}\n`;
    output += `**Confidence:** ${(plan.confidence * 100).toFixed(0)}%\n`;
    output += `**Reasoning:** ${plan.reasoning}\n\n`;

    if (Object.keys(plan.input).length > 0) {
      output += `**Parameters:**\n`;
      output += JSON.stringify(plan.input, null, 2) + '\n\n';
    }

    // V3: Show disambiguation prompt if present
    if (plan.needsDisambiguation && plan.disambiguationPrompt) {
      output += `---\n${plan.disambiguationPrompt}\n\n`;
    } else if (plan.alternatives && plan.alternatives.length > 0) {
      output += `**Alternative tools:**\n`;
      plan.alternatives.forEach(alt => {
        output += `- ${alt.tool.name} (${(alt.confidence * 100).toFixed(0)}%): ${alt.reasoning}\n`;
      });
      output += '\n';
    }

    return output;
  }

  // ---------- V3 New API ----------

  /**
   * V3: Record tool usage for adaptive scoring
   */
  recordToolUsage(toolName: string, query: string, success: boolean): void {
    this.usageTracker.recordUsage(toolName, query, success);
  }

  /**
   * V3: Get serialized usage data for persistence
   */
  getUsageData(): Record<string, ToolUsageRecord> {
    return this.usageTracker.serialize();
  }

  /**
   * V3: Rank all tools by relevance to a query (returns full list with scores)
   */
  rankTools(query: string, availableTools: ToolManifest[]): ToolCandidate[] {
    return this.matcher.findMatchingTools(query, availableTools, availableTools.length);
  }

  /**
   * V3: Disambiguate between candidates — returns the disambiguation prompt
   */
  disambiguate(query: string, candidates: ToolCandidate[]): DisambiguationResult | null {
    if (!this.disambiguator.needsDisambiguation(candidates)) {
      return null;
    }
    return this.disambiguator.generatePrompt(query, candidates);
  }

  /**
   * V3: Resolve a disambiguation by user choice
   */
  resolveDisambiguation(disambiguation: DisambiguationResult, selectedIndex: number): ToolCandidate | null {
    if (selectedIndex < 0 || selectedIndex >= disambiguation.candidates.length) {
      return null;
    }
    return disambiguation.candidates[selectedIndex];
  }

  /**
   * V3: Create a chain plan from LLM output
   */
  parseChainPlan(llmResponse: string, availableTools: Map<string, any>): ChainPlan | null {
    return this.chainPlanner.parseChainFromLLM(llmResponse, availableTools);
  }

  /**
   * V3: Create a rule-based chain plan for simple patterns
   */
  buildSimpleChain(query: string, availableTools: Map<string, any>): ChainPlan | null {
    return this.chainPlanner.buildSimpleChain(query, availableTools);
  }

  /**
   * V3: Validate a chain plan
   */
  validateChain(plan: ChainPlan, availableTools: Map<string, any>): { valid: boolean; errors: string[] } {
    return this.chainPlanner.validateChain(plan, availableTools);
  }

  /**
   * V3: Format chain plan for display
   */
  formatChainPlan(plan: ChainPlan): string {
    return this.chainPlanner.formatPlan(plan);
  }

  /**
   * V3: Get dispatch config
   */
  getConfig(): DispatchConfig {
    return { ...this.config };
  }

  /**
   * V3: Update dispatch config
   */
  updateConfig(updates: Partial<DispatchConfig>): void {
    Object.assign(this.config, updates);
    this.disambiguator = new DisambiguationEngine(this.config.disambiguationThreshold);
    this.chainPlanner = new ChainPlanner(this.config.autoChainMaxSteps);
  }

  // ---------- Private ----------

  private shouldRequireConfirmation(candidate: ToolCandidate): boolean {
    // V3: Higher bar for auto-execution
    if (candidate.confidence < this.config.minConfidenceForAutoExec) {
      return true;
    }

    const permissions = candidate.tool.permissions;
    if (permissions.filesystem?.actions.includes('delete') ||
        permissions.filesystem?.actions.includes('write') ||
        permissions.process?.actions.includes('spawn')) {
      return true;
    }

    if (candidate.tool.stability !== 'stable') {
      return true;
    }

    if (candidate.tool.usesCredentials) {
      return true;
    }

    return false;
  }
}
