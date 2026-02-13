/**
 * Run Manager - V2.0 Execution Tracking
 * Centralized tracking of all tool executions with state management
 */

import Store from "electron-store";
import { BrowserWindow } from "electron";

// ============================================================================
// TYPES
// ============================================================================

export type RunState = 
  | 'queued' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'killed' 
  | 'timed-out';

export type TriggerSource = 'user' | 'chat' | 'chain' | 'schedule';

export interface RunMetadata {
  runId: string;
  toolName: string;
  toolInput: any;
  state: RunState;
  triggerSource: TriggerSource;
  startTime: number;
  endTime?: number;
  duration?: number;
  output?: any;
  error?: string;
  processId?: number;
  lastOutputSnippet?: string;
  // V2 Observability fields
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  arguments?: Record<string, any>;
  riskLevel?: 'low' | 'medium' | 'high';
  approvedBy?: 'user' | 'session_policy' | 'permanent_policy';
}

export interface RunStats {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  killed: number;
  timedOut: number;
}

// ============================================================================
// RUN MANAGER
// ============================================================================

export class RunManager {
  private store: Store;
  private window: BrowserWindow | null;
  private runs: Map<string, RunMetadata> = new Map();
  private maxHistorySize: number = 100;
  private runHistory: RunMetadata[] = [];

  constructor(store: Store, window: BrowserWindow | null = null) {
    this.store = store;
    this.window = window;
    this.loadState();
  }

  /**
   * Set the main window for IPC events
   */
  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  /**
   * Generate a unique run ID
   */
  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Create a new run
   */
  createRun(
    toolName: string, 
    toolInput: any, 
    triggerSource: TriggerSource = 'user'
  ): string {
    const runId = this.generateRunId();
    const run: RunMetadata = {
      runId,
      toolName,
      toolInput,
      state: 'queued',
      triggerSource,
      startTime: Date.now(),
    };

    this.runs.set(runId, run);
    this.emitUpdate(runId);
    this.persistState();
    return runId;
  }

  /**
   * Start a run (transition from queued to running)
   */
  startRun(runId: string, processId?: number): void {
    const run = this.runs.get(runId);
    if (!run) return;

    run.state = 'running';
    run.startTime = Date.now(); // Update start time when actually started
    if (processId) run.processId = processId;

    this.emitUpdate(runId);
    this.persistState();
  }

  /**
   * Complete a run successfully
   */
  completeRun(runId: string, output: any, lastSnippet?: string): void {
    const run = this.runs.get(runId);
    if (!run) return;

    run.state = 'completed';
    run.endTime = Date.now();
    run.duration = run.endTime - run.startTime;
    run.output = output;
    if (lastSnippet) run.lastOutputSnippet = lastSnippet;

    this.moveToHistory(runId);
    this.emitUpdate(run);
    this.persistState();
  }

  /**
   * Mark run as failed
   */
  failRun(runId: string, error: string): void {
    const run = this.runs.get(runId);
    if (!run) return;

    run.state = 'failed';
    run.endTime = Date.now();
    run.duration = run.endTime - run.startTime;
    run.error = error;

    this.moveToHistory(runId);
    this.emitUpdate(run);
    this.persistState();
  }

  /**
   * Mark run as killed by user
   */
  killRun(runId: string): void {
    const run = this.runs.get(runId);
    if (!run) return;

    run.state = 'killed';
    run.endTime = Date.now();
    run.duration = run.endTime - run.startTime;

    this.moveToHistory(runId);
    this.emitUpdate(run);
    this.persistState();
  }

  /**
   * Mark run as timed out
   */
  timeoutRun(runId: string): void {
    const run = this.runs.get(runId);
    if (!run) return;

    run.state = 'timed-out';
    run.endTime = Date.now();
    run.duration = run.endTime - run.startTime;

    this.moveToHistory(runId);
    this.emitUpdate(run);
    this.persistState();
  }

  /**
   * Update last output snippet for a running tool
   */
  updateOutputSnippet(runId: string, snippet: string): void {
    const run = this.runs.get(runId);
    if (!run || run.state !== 'running') return;

    run.lastOutputSnippet = snippet;
    this.emitUpdate(runId);
    // Don't persist on every snippet update - too frequent
  }

  /**
   * Update stdout/stderr/exitCode for observability
   */
  updateObservability(runId: string, data: {
    stdout?: string;
    stderr?: string;
    exitCode?: number | null;
  }): void {
    const run = this.runs.get(runId);
    if (!run) {
      // Check history
      const histRun = this.runHistory.find(r => r.runId === runId);
      if (histRun) {
        if (data.stdout !== undefined) histRun.stdout = data.stdout;
        if (data.stderr !== undefined) histRun.stderr = data.stderr;
        if (data.exitCode !== undefined) histRun.exitCode = data.exitCode;
        this.persistState();
      }
      return;
    }

    if (data.stdout !== undefined) run.stdout = data.stdout;
    if (data.stderr !== undefined) run.stderr = data.stderr;
    if (data.exitCode !== undefined) run.exitCode = data.exitCode;
    // Don't persist on every update for perf
  }

  /**
   * Set risk level and approval info for a run
   */
  setApprovalInfo(runId: string, riskLevel: 'low' | 'medium' | 'high', approvedBy: 'user' | 'session_policy' | 'permanent_policy'): void {
    const run = this.runs.get(runId);
    if (!run) return;
    run.riskLevel = riskLevel;
    run.approvedBy = approvedBy;
  }

  /**
   * Attach/update process ID for an active run
   */
  setProcessId(runId: string, processId: number): void {
    const run = this.runs.get(runId);
    if (!run) return;
    run.processId = processId;
    this.persistState();
  }

  /**
   * Get a specific run
   */
  getRun(runId: string): RunMetadata | undefined {
    return this.runs.get(runId);
  }

  /**
   * Get all active runs (queued or running)
   */
  getActiveRuns(): RunMetadata[] {
    return Array.from(this.runs.values()).filter(
      r => r.state === 'queued' || r.state === 'running'
    );
  }

  /**
   * Get all runs (active + history)
   */
  getAllRuns(): RunMetadata[] {
    return [...Array.from(this.runs.values()), ...this.runHistory];
  }

  /**
   * Get run history
   */
  getHistory(limit?: number): RunMetadata[] {
    const history = [...this.runHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get run statistics
   */
  getStats(): RunStats {
    const allRuns = this.getAllRuns();
    return {
      total: allRuns.length,
      queued: allRuns.filter(r => r.state === 'queued').length,
      running: allRuns.filter(r => r.state === 'running').length,
      completed: allRuns.filter(r => r.state === 'completed').length,
      failed: allRuns.filter(r => r.state === 'failed').length,
      killed: allRuns.filter(r => r.state === 'killed').length,
      timedOut: allRuns.filter(r => r.state === 'timed-out').length,
    };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.runHistory = [];
    this.persistState();
  }

  /**
   * Clear all (active + history)
   */
  clearAll(): void {
    this.runs.clear();
    this.runHistory = [];
    this.persistState();
    this.emitStatsUpdate();
  }

  /**
   * Move completed run to history
   */
  private moveToHistory(runId: string): void {
    const run = this.runs.get(runId);
    if (!run) return;

    this.runs.delete(runId);
    this.runHistory.push(run);

    // Trim history if too large
    if (this.runHistory.length > this.maxHistorySize) {
      this.runHistory = this.runHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Emit run update event to renderer
   */
  private emitUpdate(runOrId: RunMetadata | string): void {
    const run =
      typeof runOrId === 'string' ? this.runs.get(runOrId) : runOrId;
    if (!run || !this.window) return;

    try {
      this.window.webContents.send('run:update', run);
      this.emitStatsUpdate();
    } catch (error) {
      console.error('[RunManager] Failed to emit update:', error);
    }
  }

  /**
   * Emit stats update event
   */
  private emitStatsUpdate(): void {
    if (!this.window) return;

    try {
      const stats = this.getStats();
      this.window.webContents.send('run:stats', stats);
    } catch (error) {
      console.error('[RunManager] Failed to emit stats:', error);
    }
  }

  /**
   * Persist state to electron-store
   */
  private persistState(): void {
    try {
      const activeRuns = Array.from(this.runs.values());
      const history = this.runHistory;

      this.store.set('runManager', {
        activeRuns,
        history,
        lastSaved: Date.now(),
      });
    } catch (error) {
      console.error('[RunManager] Failed to persist state:', error);
    }
  }

  /**
   * Load state from electron-store
   */
  private loadState(): void {
    try {
      const saved = this.store.get('runManager') as any;
      if (!saved) return;

      // Restore active runs
      if (saved.activeRuns && Array.isArray(saved.activeRuns)) {
        saved.activeRuns.forEach((run: RunMetadata) => {
          // Mark interrupted runs as failed on load
          if (run.state === 'running' || run.state === 'queued') {
            run.state = 'failed';
            run.error = 'Interrupted by app restart';
            const endTime = saved.lastSaved || Date.now();
            run.endTime = endTime;
            run.duration = endTime - run.startTime;
          }
          this.runs.set(run.runId, run);
        });
      }

      // Restore history
      if (saved.history && Array.isArray(saved.history)) {
        this.runHistory = saved.history;
      }

      console.log(`[RunManager] Loaded ${this.runs.size} active runs, ${this.runHistory.length} history`);
    } catch (error) {
      console.error('[RunManager] Failed to load state:', error);
    }
  }

  /**
   * Check if there were interrupted runs (for crash recovery)
   */
  hasInterruptedRuns(): boolean {
    return Array.from(this.runs.values()).some(
      r => r.error === 'Interrupted by app restart'
    );
  }

  /**
   * Get interrupted runs
   */
  getInterruptedRuns(): RunMetadata[] {
    return Array.from(this.runs.values()).filter(
      r => r.error === 'Interrupted by app restart'
    );
  }

  /**
   * Clear interrupted runs
   */
  clearInterruptedRuns(): void {
    const interrupted = this.getInterruptedRuns();
    interrupted.forEach(run => {
      this.runs.delete(run.runId);
      this.runHistory.push(run);
    });
    this.persistState();
  }
}
