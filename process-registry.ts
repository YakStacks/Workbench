/**
 * Process Registry - V2.0 Process Management
 * Central registry for all child processes with cleanup guarantees
 */

import { ChildProcess } from "child_process";

// ============================================================================
// TYPES
// ============================================================================

export interface ProcessInfo {
  processId: number;
  runId?: string;
  toolName?: string;
  startTime: number;
  command?: string;
  type: 'tool' | 'mcp' | 'other';
}

// ============================================================================
// PROCESS REGISTRY
// ============================================================================

export class ProcessRegistry {
  private processes: Map<number, ProcessInfo> = new Map();
  private childProcesses: Map<number, ChildProcess> = new Map();

  /**
   * Register a process
   */
  register(
    proc: ChildProcess,
    info: Omit<ProcessInfo, 'processId' | 'startTime'>
  ): void {
    if (!proc.pid) {
      console.warn('[ProcessRegistry] Cannot register process without PID');
      return;
    }

    const processInfo: ProcessInfo = {
      processId: proc.pid,
      startTime: Date.now(),
      ...info,
    };

    this.processes.set(proc.pid, processInfo);
    this.childProcesses.set(proc.pid, proc);

    console.log(`[ProcessRegistry] Registered process ${proc.pid} (${info.toolName || info.type})`);

    // Auto-cleanup when process exits
    proc.on('exit', (code, signal) => {
      console.log(`[ProcessRegistry] Process ${proc.pid} exited (code: ${code}, signal: ${signal})`);
      this.unregister(proc.pid);
    });
  }

  /**
   * Unregister a process
   */
  unregister(pid: number): void {
    this.processes.delete(pid);
    this.childProcesses.delete(pid);
    console.log(`[ProcessRegistry] Unregistered process ${pid}`);
  }

  /**
   * Get process info
   */
  getInfo(pid: number): ProcessInfo | undefined {
    return this.processes.get(pid);
  }

  /**
   * Get all processes
   */
  getAll(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get processes by run ID
   */
  getByRunId(runId: string): ProcessInfo[] {
    return Array.from(this.processes.values()).filter(p => p.runId === runId);
  }

  /**
   * Get process count
   */
  getCount(): number {
    return this.processes.size;
  }

  /**
   * Kill a specific process
   */
  kill(pid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const proc = this.childProcesses.get(pid);
    if (!proc) {
      console.warn(`[ProcessRegistry] Process ${pid} not found`);
      return false;
    }

    try {
      console.log(`[ProcessRegistry] Killing process ${pid} with signal ${signal}`);
      proc.kill(signal);
      return true;
    } catch (error: any) {
      console.error(`[ProcessRegistry] Failed to kill process ${pid}:`, error.message);
      return false;
    }
  }

  /**
   * Kill all processes for a run
   */
  killRun(runId: string, signal: NodeJS.Signals = 'SIGTERM'): number {
    const processes = this.getByRunId(runId);
    let killed = 0;

    for (const info of processes) {
      if (this.kill(info.processId, signal)) {
        killed++;
      }
    }

    console.log(`[ProcessRegistry] Killed ${killed}/${processes.length} processes for run ${runId}`);
    return killed;
  }

  /**
   * Kill all processes
   */
  killAll(signal: NodeJS.Signals = 'SIGTERM'): number {
    const pids = Array.from(this.processes.keys());
    let killed = 0;

    for (const pid of pids) {
      if (this.kill(pid, signal)) {
        killed++;
      }
    }

    console.log(`[ProcessRegistry] Killed ${killed}/${pids.length} processes`);
    return killed;
  }

  /**
   * Force kill a process (SIGKILL)
   */
  forceKill(pid: number): boolean {
    return this.kill(pid, 'SIGKILL');
  }

  /**
   * Force kill all processes
   */
  forceKillAll(): number {
    return this.killAll('SIGKILL');
  }

  /**
   * Graceful shutdown - try SIGTERM first, then SIGKILL after timeout
   */
  async gracefulShutdown(timeoutMs: number = 5000): Promise<void> {
    console.log(`[ProcessRegistry] Starting graceful shutdown (${this.processes.size} processes)`);
    
    if (this.processes.size === 0) {
      console.log('[ProcessRegistry] No processes to shut down');
      return;
    }

    // Try SIGTERM first
    const initialCount = this.processes.size;
    this.killAll('SIGTERM');

    // Wait for processes to exit
    await new Promise<void>(resolve => {
      const checkInterval = setInterval(() => {
        if (this.processes.size === 0) {
          clearInterval(checkInterval);
          clearTimeout(forceKillTimeout);
          console.log('[ProcessRegistry] All processes exited gracefully');
          resolve();
        }
      }, 100);

      // Force kill remaining processes after timeout
      const forceKillTimeout = setTimeout(() => {
        clearInterval(checkInterval);
        if (this.processes.size > 0) {
          console.warn(`[ProcessRegistry] ${this.processes.size} processes did not exit, force killing...`);
          this.forceKillAll();
        }
        resolve();
      }, timeoutMs);
    });

    console.log(`[ProcessRegistry] Shutdown complete (killed ${initialCount} processes)`);
  }

  /**
   * Get active process count grouped by type
   */
  getStatsByType(): Record<string, number> {
    const stats: Record<string, number> = { tool: 0, mcp: 0, other: 0 };
    const allProcesses = Array.from(this.processes.values());
    for (const info of allProcesses) {
      stats[info.type] = (stats[info.type] || 0) + 1;
    }
    return stats;
  }

  /**
   * Check for hung processes (no activity for X seconds)
   * Note: This requires external monitoring to update activity
   */
  getHungProcesses(inactivityMs: number = 60000): ProcessInfo[] {
    const now = Date.now();
    return Array.from(this.processes.values()).filter(
      info => (now - info.startTime) > inactivityMs
    );
  }
}
