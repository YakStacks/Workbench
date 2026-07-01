/**
 * Dry Run / Preview Mode - V2.0
 * Allows tools to show execution plans before running
 */

// ============================================================================
// TYPES
// ============================================================================

export type PreviewType = 'file' | 'network' | 'process' | 'general';

export interface FilePreview {
  type: 'file';
  operation: 'create' | 'read' | 'write' | 'delete' | 'move' | 'copy';
  paths: string[];
  diff?: string; // For write operations, show diff
  summary?: string;
}

export interface NetworkPreview {
  type: 'network';
  method?: string; // 'GET', 'POST', etc.
  url: string;
  headers?: Record<string, string>;
  payloadSummary?: string; // Don't show full payload if sensitive
  summary?: string;
}

export interface ProcessPreview {
  type: 'process';
  command: string;
  args?: string[];
  cwd?: string;
  summary?: string;
}

export interface GeneralPreview {
  type: 'general';
  action: string;
  details: string;
  summary?: string;
}

export type Preview = FilePreview | NetworkPreview | ProcessPreview | GeneralPreview;

export interface PreviewPlan {
  toolName: string;
  input: any;
  steps: Preview[];
  estimatedDuration?: string;
  warnings?: string[];
  timestamp: Date;
}

export interface PreviewResult {
  preview: PreviewPlan;
  approved?: boolean;
  executed?: boolean;
  result?: any;
}

// ============================================================================
// PREVIEW BUILDER
// ============================================================================

export class PreviewBuilder {
  private steps: Preview[] = [];
  private warnings: string[] = [];
  private estimatedDuration?: string;

  /**
   * Add a file operation preview
   */
  fileOperation(
    operation: FilePreview['operation'],
    paths: string[],
    options?: { diff?: string; summary?: string }
  ): this {
    this.steps.push({
      type: 'file',
      operation,
      paths,
      diff: options?.diff,
      summary: options?.summary || `${operation} ${paths.length} file(s)`,
    });
    return this;
  }

  /**
   * Add a network request preview
   */
  networkRequest(
    url: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      payloadSummary?: string;
      summary?: string;
    }
  ): this {
    this.steps.push({
      type: 'network',
      method: options?.method || 'GET',
      url,
      headers: options?.headers,
      payloadSummary: options?.payloadSummary,
      summary: options?.summary || `${options?.method || 'GET'} ${url}`,
    });
    return this;
  }

  /**
   * Add a process execution preview
   */
  processExecution(
    command: string,
    options?: {
      args?: string[];
      cwd?: string;
      summary?: string;
    }
  ): this {
    this.steps.push({
      type: 'process',
      command,
      args: options?.args,
      cwd: options?.cwd,
      summary: options?.summary || `Execute: ${command}`,
    });
    return this;
  }

  /**
   * Add a general action preview
   */
  generalAction(action: string, details: string, summary?: string): this {
    this.steps.push({
      type: 'general',
      action,
      details,
      summary: summary || action,
    });
    return this;
  }

  /**
   * Add a warning
   */
  warning(message: string): this {
    this.warnings.push(message);
    return this;
  }

  /**
   * Set estimated duration
   */
  duration(duration: string): this {
    this.estimatedDuration = duration;
    return this;
  }

  /**
   * Build the preview plan
   */
  build(toolName: string, input: any): PreviewPlan {
    return {
      toolName,
      input,
      steps: this.steps,
      estimatedDuration: this.estimatedDuration,
      warnings: this.warnings.length > 0 ? this.warnings : undefined,
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// PREVIEW MANAGER
// ============================================================================

export class PreviewManager {
  private history: PreviewResult[] = [];
  private maxHistorySize = 100;

  /**
   * Store a preview plan
   */
  storePreview(preview: PreviewPlan): string {
    const id = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.history.push({
      preview,
      approved: false,
      executed: false,
    });

    // Trim history
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    return id;
  }

  /**
   * Approve and execute a preview
   */
  approvePreview(previewIndex: number): boolean {
    if (previewIndex >= 0 && previewIndex < this.history.length) {
      this.history[previewIndex].approved = true;
      return true;
    }
    return false;
  }

  /**
   * Mark preview as executed
   */
  markExecuted(previewIndex: number, result: any): boolean {
    if (previewIndex >= 0 && previewIndex < this.history.length) {
      this.history[previewIndex].executed = true;
      this.history[previewIndex].result = result;
      return true;
    }
    return false;
  }

  /**
   * Get preview history
   */
  getHistory(limit?: number): PreviewResult[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Get a specific preview
   */
  getPreview(index: number): PreviewResult | null {
    return this.history[index] || null;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Format preview for display
   */
  formatPreview(preview: PreviewPlan): string {
    let output = `**Preview: ${preview.toolName}**\n\n`;

    if (preview.estimatedDuration) {
      output += `⏱️ Estimated duration: ${preview.estimatedDuration}\n\n`;
    }

    if (preview.warnings && preview.warnings.length > 0) {
      output += `**⚠️ Warnings:**\n`;
      preview.warnings.forEach(w => {
        output += `- ${w}\n`;
      });
      output += '\n';
    }

    output += `**Steps:**\n`;
    preview.steps.forEach((step, i) => {
      output += `${i + 1}. `;
      
      switch (step.type) {
        case 'file':
          output += `📁 ${step.operation.toUpperCase()}: ${step.paths.join(', ')}\n`;
          if (step.diff) {
            output += `   Diff:\n${step.diff.split('\n').map(l => '   ' + l).join('\n')}\n`;
          }
          break;

        case 'network':
          output += `🌐 ${step.method} ${step.url}\n`;
          if (step.payloadSummary) {
            output += `   Payload: ${step.payloadSummary}\n`;
          }
          break;

        case 'process':
          output += `⚙️ Execute: ${step.command}`;
          if (step.args && step.args.length > 0) {
            output += ` ${step.args.join(' ')}`;
          }
          output += '\n';
          if (step.cwd) {
            output += `   Working directory: ${step.cwd}\n`;
          }
          break;

        case 'general':
          output += `${step.action}\n`;
          output += `   ${step.details}\n`;
          break;
      }
    });

    return output;
  }
}

// ============================================================================
// TOOL WRAPPER FOR PREVIEW
// ============================================================================

export interface PreviewableToolResult {
  mode: 'execute' | 'preview';
  preview?: PreviewPlan;
  result?: any;
}

/**
 * Wrapper to make tools support preview mode
 */
export async function withPreview<T>(
  toolName: string,
  input: any,
  previewMode: boolean,
  executeFunc: () => Promise<T>,
  previewFunc: () => PreviewPlan
): Promise<PreviewableToolResult> {
  if (previewMode) {
    return {
      mode: 'preview',
      preview: previewFunc(),
    };
  } else {
    const result = await executeFunc();
    return {
      mode: 'execute',
      result,
    };
  }
}
