/**
 * Permissions System - V2.0 Trust Core
 * Declarative, metadata-based permissions for tool execution
 */

import Store from "electron-store";

// ============================================================================
// TYPES
// ============================================================================

export type PermissionCategory = 'filesystem' | 'network' | 'process';

export type FilesystemAction = 'read' | 'write' | 'delete';
export type NetworkAction = 'outbound' | 'localhost';
export type ProcessAction = 'spawn';

export type PermissionAction = FilesystemAction | NetworkAction | ProcessAction;

export interface FilesystemPermission {
  actions: FilesystemAction[];
  paths?: string[];  // Optional path restrictions (regex patterns)
}

export interface NetworkPermission {
  actions: NetworkAction[];
  hosts?: string[];  // Optional host restrictions
}

export interface ProcessPermission {
  actions: ProcessAction[];
}

export interface ToolPermissions {
  filesystem?: FilesystemPermission;
  network?: NetworkPermission;
  process?: ProcessPermission;
}

export type PolicyDecision = 'allow' | 'deny' | 'ask';

export interface ToolPolicy {
  filesystem?: PolicyDecision;
  network?: PolicyDecision;
  process?: PolicyDecision;
}

export interface PermissionRequest {
  toolName: string;
  permissions: ToolPermissions;
  isDestructive: boolean;
}

export interface PermissionCheckResult {
  allowed: boolean;
  needsPrompt: boolean;
  category?: PermissionCategory;
  action?: PermissionAction;
}

// ============================================================================
// RISK ASSESSMENT
// ============================================================================

const ACTION_RISK_LEVELS: Record<PermissionAction, 'low' | 'medium' | 'high'> = {
  // Filesystem
  read: 'low',
  write: 'medium',
  delete: 'high',
  // Network
  localhost: 'low',
  outbound: 'medium',
  // Process
  spawn: 'high',
};

const CATEGORY_ICONS: Record<PermissionCategory, string> = {
  filesystem: '📁',
  network: '🌐',
  process: '⚙️',
};

const ACTION_DESCRIPTIONS: Record<PermissionAction, string> = {
  read: 'Read files from disk',
  write: 'Create or modify files',
  delete: 'Delete files',
  localhost: 'Connect to local services',
  outbound: 'Connect to external servers',
  spawn: 'Execute shell commands',
};

// ============================================================================
// PERMISSION MANAGER
// ============================================================================

export class PermissionManager {
  private store: Store;
  private toolPermissions: Map<string, ToolPermissions> = new Map();
  private policies: Map<string, ToolPolicy> = new Map();
  private tempPermissions: Map<string, Set<PermissionCategory>> = new Map();

  constructor(store: Store) {
    this.store = store;
    this.loadPolicies();
  }

  // ... (methods) ...

  /**
   * Register a tool's declared permissions
   */
  registerToolPermissions(toolName: string, permissions: ToolPermissions): void {
    this.toolPermissions.set(toolName, permissions);
  }

  /**
   * Get a tool's declared permissions
   */
  getToolPermissions(toolName: string): ToolPermissions | undefined {
    return this.toolPermissions.get(toolName);
  }

  /**
   * Check if a tool has permission for a specific action
   * Returns whether action is allowed and whether UI prompt is needed
   */
  checkPermission(toolName: string, category: PermissionCategory, action: PermissionAction): PermissionCheckResult {
    const permissions = this.toolPermissions.get(toolName);
    const policy = this.policies.get(toolName);

    // No permissions declared = deny by default
    if (!permissions) {
      return { allowed: false, needsPrompt: false };
    }

    // Check if tool declares this category
    const categoryPerms = permissions[category];
    if (!categoryPerms) {
      // Tool doesn't use this category - deny by default for safety
      return { allowed: false, needsPrompt: false };
    }

    // Check if action is declared
    const actions = categoryPerms.actions as PermissionAction[];
    if (!actions.includes(action)) {
      return { allowed: false, needsPrompt: false };
    }

    // Check temporary permissions
    const tempPerms = this.tempPermissions.get(toolName);
    if (tempPerms && tempPerms.has(category)) {
      return { allowed: true, needsPrompt: false };
    }

    // Check policy
    const categoryPolicy = policy?.[category];
    if (categoryPolicy === 'allow') {
      return { allowed: true, needsPrompt: false };
    }
    if (categoryPolicy === 'deny') {
      return { allowed: false, needsPrompt: false };
    }

    // No policy set - needs prompt
    return { allowed: false, needsPrompt: true, category, action };
  }

  /**
   * Grant permission for a specific category
   */
  grantPermission(toolName: string, category: PermissionCategory, permanent: boolean = false): void {
    if (permanent) {
      let policy = this.policies.get(toolName) || {};
      policy[category] = 'allow';
      this.policies.set(toolName, policy);
      this.persistPolicies();
    } else {
      let perms = this.tempPermissions.get(toolName);
      if (!perms) {
        perms = new Set();
        this.tempPermissions.set(toolName, perms);
      }
      perms.add(category);
    }
  }

  /**
   * Deny permission for a specific category
   */
  denyPermission(toolName: string, category: PermissionCategory, permanent: boolean = false): void {
    if (permanent) {
      // ... same ...
      let policy = this.policies.get(toolName) || {};
      policy[category] = 'deny';
      this.policies.set(toolName, policy);
      this.persistPolicies();
    }
    // No temporary deny needed - default is prompt/deny
  }

  /**
   * Reset all policies for a tool
   */
  resetToolPolicy(toolName: string): void {
    this.policies.delete(toolName);
    this.persistPolicies();
  }

  /**
   * Reset all policies
   */
  resetAllPolicies(): void {
    this.policies.clear();
    this.persistPolicies();
  }

  /**
   * Get policy for a tool
   */
  getToolPolicy(toolName: string): ToolPolicy | undefined {
    return this.policies.get(toolName);
  }

  /**
   * Check if a tool requires elevated/destructive permissions
   */
  isDestructive(toolName: string): boolean {
    const permissions = this.toolPermissions.get(toolName);
    if (!permissions) return false;

    // Check for high-risk actions
    if (permissions.filesystem?.actions.includes('delete')) return true;
    if (permissions.process?.actions.includes('spawn')) return true;

    return false;
  }

  /**
   * Get risk level for a permission
   */
  getRiskLevel(action: PermissionAction): 'low' | 'medium' | 'high' {
    return ACTION_RISK_LEVELS[action] || 'medium';
  }

  /**
   * Get human-readable description for a permission
   */
  getActionDescription(action: PermissionAction): string {
    return ACTION_DESCRIPTIONS[action] || action;
  }

  /**
   * Get icon for a category
   */
  getCategoryIcon(category: PermissionCategory): string {
    return CATEGORY_ICONS[category] || '❓';
  }

  /**
   * Format permissions for display
   */
  formatPermissionsForDisplay(permissions: ToolPermissions): {
    category: PermissionCategory;
    icon: string;
    actions: { action: PermissionAction; description: string; risk: 'low' | 'medium' | 'high' }[];
  }[] {
    const result: any[] = [];

    const categories: PermissionCategory[] = ['filesystem', 'network', 'process'];
    
    for (const cat of categories) {
      const perms = permissions[cat];
      if (perms && perms.actions.length > 0) {
        result.push({
          category: cat,
          icon: this.getCategoryIcon(cat),
          actions: perms.actions.map((a: PermissionAction) => ({
            action: a,
            description: this.getActionDescription(a),
            risk: this.getRiskLevel(a),
          })),
        });
      }
    }

    return result;
  }

  /**
   * Persist policies to store
   */
  private persistPolicies(): void {
    const obj: Record<string, ToolPolicy> = {};
    this.policies.forEach((policy, toolName) => {
      obj[toolName] = policy;
    });
    this.store.set('toolPolicies', obj);
  }

  /**
   * Load policies from store
   */
  private loadPolicies(): void {
    const saved = this.store.get('toolPolicies', {}) as Record<string, ToolPolicy>;
    this.policies = new Map(Object.entries(saved));
  }
}
