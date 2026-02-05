/**
 * User Memory System - V2.0
 * Opt-in learning system with user control
 */

import Store from "electron-store";

// ============================================================================
// TYPES
// ============================================================================

export type MemoryCategory = 'preference' | 'workflow' | 'project' | 'tool_integration' | 'context';

export interface Memory {
  id: string;
  category: MemoryCategory;
  key: string;
  value: any;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  tags?: string[];
  userProvided: boolean; // Was this explicitly set by user?
}

export interface MemoryContext {
  memoriesUsed: string[]; // Memory IDs used in this response
  memoriesConsidered: string[]; // Memory IDs considered but not used
}

// ============================================================================
// MEMORY MANAGER
// ============================================================================

export class MemoryManager {
  private store: Store;
  private memories: Map<string, Memory> = new Map();
  private enabled: boolean = true;

  constructor(store: Store) {
    this.store = store;
    this.loadMemories();
    this.loadSettings();
  }

  // ============================================================================
  // MEMORY CRUD
  // ============================================================================

  /**
   * Store a new memory
   */
  remember(
    category: MemoryCategory,
    key: string,
    value: any,
    options?: { tags?: string[]; userProvided?: boolean }
  ): Memory {
    const id = this.generateId(category, key);
    const existing = this.memories.get(id);

    const memory: Memory = {
      id,
      category,
      key,
      value,
      createdAt: existing?.createdAt || new Date(),
      lastUsed: existing?.lastUsed,
      usageCount: existing?.usageCount || 0,
      tags: options?.tags || existing?.tags || [],
      userProvided: options?.userProvided ?? existing?.userProvided ?? false,
    };

    this.memories.set(id, memory);
    this.persistMemories();

    return memory;
  }

  /**
   * Retrieve a memory
   */
  recall(category: MemoryCategory, key: string): Memory | null {
    const id = this.generateId(category, key);
    const memory = this.memories.get(id);

    if (memory) {
      // Update usage stats
      memory.lastUsed = new Date();
      memory.usageCount++;
      this.memories.set(id, memory);
      this.persistMemories();
    }

    return memory || null;
  }

  /**
   * Forget a memory
   */
  forget(memoryId: string): boolean {
    const deleted = this.memories.delete(memoryId);
    if (deleted) {
      this.persistMemories();
    }
    return deleted;
  }

  /**
   * Forget all memories
   */
  forgetAll(): void {
    this.memories.clear();
    this.persistMemories();
  }

  /**
   * Update a memory
   */
  update(memoryId: string, updates: Partial<Pick<Memory, 'value' | 'tags'>>): boolean {
    const memory = this.memories.get(memoryId);
    if (!memory) return false;

    if (updates.value !== undefined) memory.value = updates.value;
    if (updates.tags !== undefined) memory.tags = updates.tags;

    this.memories.set(memoryId, memory);
    this.persistMemories();
    return true;
  }

  // ============================================================================
  // QUERY
  // ============================================================================

  /**
   * List all memories
   */
  listAll(): Memory[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * List memories by category
   */
  listByCategory(category: MemoryCategory): Memory[] {
    return Array.from(this.memories.values())
      .filter(m => m.category === category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Search memories
   */
  search(query: string): Memory[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.memories.values())
      .filter(m => 
        m.key.toLowerCase().includes(lowerQuery) ||
        JSON.stringify(m.value).toLowerCase().includes(lowerQuery) ||
        m.tags?.some(t => t.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Find memories by tag
   */
  findByTag(tag: string): Memory[] {
    return Array.from(this.memories.values())
      .filter(m => m.tags?.includes(tag));
  }

  /**
   * Get most used memories
   */
  getMostUsed(limit: number = 10): Memory[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Get recently used memories
   */
  getRecentlyUsed(limit: number = 10): Memory[] {
    return Array.from(this.memories.values())
      .filter(m => m.lastUsed)
      .sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0))
      .slice(0, limit);
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR COMMON CATEGORIES
  // ============================================================================

  /**
   * Remember a user preference
   */
  rememberPreference(key: string, value: any): Memory {
    return this.remember('preference', key, value, { userProvided: true });
  }

  /**
   * Recall a user preference
   */
  recallPreference(key: string): any {
    return this.recall('preference', key)?.value;
  }

  /**
   * Remember a workflow pattern
   */
  rememberWorkflow(name: string, steps: any[]): Memory {
    return this.remember('workflow', name, steps);
  }

  /**
   * Recall a workflow
   */
  recallWorkflow(name: string): any[] | null {
    return this.recall('workflow', name)?.value || null;
  }

  /**
   * Remember project context
   */
  rememberProject(projectName: string, context: any): Memory {
    return this.remember('project', projectName, context);
  }

  /**
   * Recall project context
   */
  recallProject(projectName: string): any {
    return this.recall('project', projectName)?.value;
  }

  /**
   * Remember tool integration
   */
  rememberToolIntegration(toolName: string, config: any): Memory {
    return this.remember('tool_integration', toolName, config);
  }

  /**
   * Recall tool integration
   */
  recallToolIntegration(toolName: string): any {
    return this.recall('tool_integration', toolName)?.value;
  }

  // ============================================================================
  // CONTEXT TRACKING
  // ============================================================================

  /**
   * Create a memory context for tracking usage in responses
   */
  createContext(): MemoryContext {
    return {
      memoriesUsed: [],
      memoriesConsidered: [],
    };
  }

  /**
   * Mark a memory as used in context
   */
  markUsed(context: MemoryContext, memoryId: string): void {
    if (!context.memoriesUsed.includes(memoryId)) {
      context.memoriesUsed.push(memoryId);
    }
  }

  /**
   * Mark a memory as considered but not used
   */
  markConsidered(context: MemoryContext, memoryId: string): void {
    if (!context.memoriesConsidered.includes(memoryId)) {
      context.memoriesConsidered.push(memoryId);
    }
  }

  /**
   * Format context for display
   */
  formatContext(context: MemoryContext): string {
    if (context.memoriesUsed.length === 0) {
      return '';
    }

    const memories = context.memoriesUsed
      .map(id => this.memories.get(id))
      .filter((m): m is Memory => m !== undefined);

    if (memories.length === 0) return '';

    let output = '**Memories used in this response:**\n';
    memories.forEach(m => {
      output += `- ${m.category}: ${m.key}\n`;
    });

    return output;
  }

  // ============================================================================
  // SETTINGS
  // ============================================================================

  /**
   * Enable or disable memory system
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.store.set('memoryEnabled', enabled);
  }

  /**
   * Check if memory system is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byCategory: Record<MemoryCategory, number>;
    userProvided: number;
    aiLearned: number;
  } {
    const stats = {
      total: this.memories.size,
      byCategory: {
        preference: 0,
        workflow: 0,
        project: 0,
        tool_integration: 0,
        context: 0,
      } as Record<MemoryCategory, number>,
      userProvided: 0,
      aiLearned: 0,
    };

    this.memories.forEach(m => {
      stats.byCategory[m.category]++;
      if (m.userProvided) {
        stats.userProvided++;
      } else {
        stats.aiLearned++;
      }
    });

    return stats;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Generate consistent ID from category and key
   */
  private generateId(category: MemoryCategory, key: string): string {
    return `${category}:${key}`;
  }

  /**
   * Persist memories to store
   */
  private persistMemories(): void {
    const obj: Record<string, any> = {};
    this.memories.forEach((memory, id) => {
      obj[id] = {
        ...memory,
        createdAt: memory.createdAt.toISOString(),
        lastUsed: memory.lastUsed?.toISOString(),
      };
    });
    this.store.set('userMemories', obj);
  }

  /**
   * Load memories from store
   */
  private loadMemories(): void {
    const saved = this.store.get('userMemories', {}) as Record<string, any>;
    this.memories = new Map(
      Object.entries(saved).map(([id, m]) => [id, {
        ...m,
        createdAt: new Date(m.createdAt),
        lastUsed: m.lastUsed ? new Date(m.lastUsed) : undefined,
      }])
    );
  }

  /**
   * Load settings from store
   */
  private loadSettings(): void {
    this.enabled = this.store.get('memoryEnabled', true) as boolean;
  }
}
