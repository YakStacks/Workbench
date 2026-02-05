/**
 * Natural Language Tool Dispatch - V2.0
 * AI-powered tool selection and parameter inference
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
}

export interface ToolDispatchPlan {
  selectedTool: ToolManifest;
  input: any;
  confidence: number;
  reasoning: string;
  alternatives?: ToolCandidate[];
  requiresConfirmation: boolean;
  preview?: PreviewPlan;
}

export interface DispatchResult {
  plan: ToolDispatchPlan;
  approved: boolean;
  executed: boolean;
  result?: any;
  error?: string;
}

// ============================================================================
// TOOL MATCHER
// ============================================================================

export class ToolMatcher {
  /**
   * Score a tool based on query keywords and tool metadata
   */
  scoreToolMatch(tool: ToolManifest, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Exact name match (highest score)
    if (tool.name.toLowerCase() === queryLower) {
      score += 100;
    } else if (tool.name.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    // Description match
    if (tool.description.toLowerCase().includes(queryLower)) {
      score += 30;
    }

    // Tag matches
    if (tool.tags) {
      for (const tag of tool.tags) {
        if (queryLower.includes(tag.toLowerCase()) || tag.toLowerCase().includes(queryLower)) {
          score += 20;
        }
      }
    }

    // Category extraction from name
    const toolCategory = tool.name.split('.')[0];
    if (queryLower.includes(toolCategory.toLowerCase())) {
      score += 15;
    }

    // Keywords matching
    const keywords = this.extractKeywords(query);
    const toolKeywords = this.extractKeywords(tool.description);
    
    const matchingKeywords = keywords.filter(k => toolKeywords.includes(k));
    score += matchingKeywords.length * 10;

    return score;
  }

  /**
   * Find best matching tools for a natural language query
   */
  findMatchingTools(query: string, availableTools: ToolManifest[], limit: number = 5): ToolCandidate[] {
    const candidates: ToolCandidate[] = [];

    for (const tool of availableTools) {
      const score = this.scoreToolMatch(tool, query);
      
      if (score > 0) {
        candidates.push({
          tool,
          confidence: Math.min(score / 100, 1),
          reasoning: this.generateReasoning(tool, query, score),
        });
      }
    }

    // Sort by confidence and limit
    return candidates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction (lowercase, remove common words)
    const commonWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                                  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
                                  'can', 'could', 'may', 'might', 'must', 'to', 'from', 'in', 'on', 'at',
                                  'for', 'with', 'about', 'as', 'by', 'of', 'or', 'and']);
    
    return text.toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 2 && !commonWords.has(w));
  }

  /**
   * Generate reasoning for why a tool was selected
   */
  private generateReasoning(tool: ToolManifest, query: string, score: number): string {
    const reasons: string[] = [];

    if (tool.name.toLowerCase().includes(query.toLowerCase())) {
      reasons.push(`Tool name contains "${query}"`);
    }

    if (tool.description.toLowerCase().includes(query.toLowerCase())) {
      reasons.push('Description matches query');
    }

    if (tool.tags) {
      const matchingTags = tool.tags.filter(t => 
        query.toLowerCase().includes(t.toLowerCase())
      );
      if (matchingTags.length > 0) {
        reasons.push(`Matching tags: ${matchingTags.join(', ')}`);
      }
    }

    if (reasons.length === 0) {
      reasons.push('Keyword match');
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
    
    // This is a simplified version - in production, you'd use an LLM or more sophisticated NLP
    
    // Extract quoted strings (could be file paths, search queries, etc.)
    const quotedMatches = query.match(/"([^"]+)"/g);
    if (quotedMatches) {
      // Assume first quoted string is the main parameter
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

    return input;
  }
}

// ============================================================================
// TOOL DISPATCHER
// ============================================================================

export class ToolDispatcher {
  private matcher: ToolMatcher;
  private inferencer: ParameterInferencer;
  private permissionManager: PermissionManager;
  private previewManager: PreviewManager;

  constructor(permissionManager: PermissionManager, previewManager: PreviewManager) {
    this.matcher = new ToolMatcher();
    this.inferencer = new ParameterInferencer();
    this.permissionManager = permissionManager;
    this.previewManager = previewManager;
  }

  /**
   * Create a dispatch plan from natural language
   */
  async createDispatchPlan(
    query: string,
    availableTools: ToolManifest[],
    context?: any
  ): Promise<ToolDispatchPlan | null> {
    // Find matching tools
    const candidates = this.matcher.findMatchingTools(query, availableTools, 5);
    
    if (candidates.length === 0) {
      return null;
    }

    const bestCandidate = candidates[0];
    
    // Infer parameters
    const input = this.inferencer.inferParameters(bestCandidate.tool, query, context);

    // Check if confirmation is needed
    const requiresConfirmation = this.shouldRequireConfirmation(bestCandidate);

    // Create dispatch plan
    const plan: ToolDispatchPlan = {
      selectedTool: bestCandidate.tool,
      input,
      confidence: bestCandidate.confidence,
      reasoning: bestCandidate.reasoning,
      alternatives: candidates.slice(1),
      requiresConfirmation,
    };

    return plan;
  }

  /**
   * Suggest relevant tools even when not explicitly asked
   */
  suggestTools(context: string, availableTools: ToolManifest[], limit: number = 3): ToolCandidate[] {
    // Light matching - don't be too aggressive
    const candidates = this.matcher.findMatchingTools(context, availableTools, limit);
    
    // Only suggest tools with reasonable confidence
    return candidates.filter(c => c.confidence >= 0.3);
  }

  /**
   * Determine if confirmation is needed
   */
  private shouldRequireConfirmation(candidate: ToolCandidate): boolean {
    // Always confirm if confidence is low
    if (candidate.confidence < 0.7) {
      return true;
    }

    // Check if tool is destructive
    const permissions = candidate.tool.permissions;
    if (permissions.filesystem?.actions.includes('delete') || 
        permissions.filesystem?.actions.includes('write') ||
        permissions.process?.actions.includes('spawn')) {
      return true;
    }

    // Experimental/beta tools need confirmation
    if (candidate.tool.stability !== 'stable') {
      return true;
    }

    // Tools that use credentials need confirmation
    if (candidate.tool.usesCredentials) {
      return true;
    }

    return false;
  }

  /**
   * Format dispatch plan for user confirmation
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

    if (plan.alternatives && plan.alternatives.length > 0) {
      output += `**Alternative tools:**\n`;
      plan.alternatives.forEach(alt => {
        output += `- ${alt.tool.name} (${(alt.confidence * 100).toFixed(0)}%): ${alt.reasoning}\n`;
      });
      output += '\n';
    }

    return output;
  }
}
