/**
 * Secrets Manager - V2.0 Secure Credential Storage
 * Handles encrypted credential storage with OS-level keychain integration
 */

import Store from "electron-store";
import { safeStorage } from "electron";
import crypto from "crypto";

// ============================================================================
// TYPES
// ============================================================================

export interface SecretHandle {
  id: string;
  name: string;
  type: 'api_key' | 'token' | 'password' | 'oauth' | 'custom';
  createdAt: Date;
  tags?: string[];
  toolsUsing?: string[];  // Which tools reference this secret
}

export interface SecretMetadata {
  handle: SecretHandle;
  usageCount: number;
  lastUsed?: Date;
}

export interface SecretValue {
  handle: SecretHandle;
  value: string;
}

export interface RedactionRule {
  pattern: RegExp;
  replacement: string;
}

// ============================================================================
// SECRETS MANAGER
// ============================================================================

export class SecretsManager {
  private store: Store;
  private handles: Map<string, SecretHandle> = new Map();
  private usageStats: Map<string, { count: number; lastUsed?: Date }> = new Map();
  
  // Built-in redaction patterns
  private redactionRules: RedactionRule[] = [
    // API keys (various formats)
    { pattern: /\b[A-Za-z0-9]{32,}\b/g, replacement: '[REDACTED_KEY]' },
    // Bearer tokens
    { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
    // Basic auth
    { pattern: /Basic\s+[A-Za-z0-9+/]+=*/gi, replacement: 'Basic [REDACTED_AUTH]' },
    // AWS keys
    { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
    // GitHub tokens
    { pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
    // Generic secrets in key=value format
    { pattern: /(password|secret|token|key|apikey|api_key)=[^\s&]+/gi, replacement: '$1=[REDACTED]' },
    // JSON-like secrets
    { pattern: /("[^"]*(?:password|secret|token|key|apikey|api_key)[^"]*":\s*)"[^"]+"/gi, replacement: '$1"[REDACTED]"' },
  ];

  constructor(store: Store) {
    this.store = store;
    this.loadHandles();
    this.loadUsageStats();
  }

  // ============================================================================
  // SECRET STORAGE
  // ============================================================================

  /**
   * Store a new secret securely
   */
  async storeSecret(name: string, value: string, type: SecretHandle['type'] = 'custom', tags: string[] = []): Promise<SecretHandle> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is not available on this system');
    }

    const id = crypto.randomUUID();
    const handle: SecretHandle = {
      id,
      name,
      type,
      createdAt: new Date(),
      tags,
      toolsUsing: [],
    };

    // Encrypt the secret using OS keychain (Windows DPAPI, macOS Keychain, Linux Secret Service)
    const encrypted = safeStorage.encryptString(value);
    
    // Store encrypted value with base64 encoding
    this.store.set(`secrets.${id}`, encrypted.toString('base64'));
    
    // Store metadata separately (not encrypted)
    this.handles.set(id, handle);
    this.persistHandles();

    return handle;
  }

  /**
   * Retrieve a secret by ID (returns decrypted value)
   */
  async getSecret(secretId: string): Promise<SecretValue | null> {
    const handle = this.handles.get(secretId);
    if (!handle) {
      return null;
    }

    const encrypted = this.store.get(`secrets.${secretId}`) as string;
    if (!encrypted) {
      return null;
    }

    try {
      // Decrypt using OS keychain
      const buffer = Buffer.from(encrypted, 'base64');
      const decrypted = safeStorage.decryptString(buffer);
      
      // Update usage stats
      this.recordUsage(secretId);

      return {
        handle,
        value: decrypted,
      };
    } catch (error) {
      console.error(`[SecretsManager] Failed to decrypt secret ${secretId}:`, error);
      return null;
    }
  }

  /**
   * Delete a secret permanently
   */
  async deleteSecret(secretId: string): Promise<boolean> {
    const handle = this.handles.get(secretId);
    if (!handle) {
      return false;
    }

    // Remove encrypted value
    this.store.delete(`secrets.${secretId}`);
    
    // Remove metadata
    this.handles.delete(secretId);
    this.usageStats.delete(secretId);
    
    this.persistHandles();
    this.persistUsageStats();

    return true;
  }

  /**
   * Update secret metadata (not the value)
   */
  updateSecretMetadata(secretId: string, updates: Partial<Pick<SecretHandle, 'name' | 'tags' | 'toolsUsing'>>): boolean {
    const handle = this.handles.get(secretId);
    if (!handle) {
      return false;
    }

    if (updates.name) handle.name = updates.name;
    if (updates.tags) handle.tags = updates.tags;
    if (updates.toolsUsing) handle.toolsUsing = updates.toolsUsing;

    this.handles.set(secretId, handle);
    this.persistHandles();
    return true;
  }

  /**
   * Associate a tool with a secret
   */
  associateToolWithSecret(secretId: string, toolName: string): boolean {
    const handle = this.handles.get(secretId);
    if (!handle) {
      return false;
    }

    if (!handle.toolsUsing) {
      handle.toolsUsing = [];
    }

    if (!handle.toolsUsing.includes(toolName)) {
      handle.toolsUsing.push(toolName);
      this.handles.set(secretId, handle);
      this.persistHandles();
    }

    return true;
  }

  // ============================================================================
  // QUERY & LISTING
  // ============================================================================

  /**
   * List all secret handles (no values)
   */
  listSecrets(): SecretMetadata[] {
    return Array.from(this.handles.values()).map(handle => {
      const stats = this.usageStats.get(handle.id) || { count: 0 };
      return {
        handle,
        usageCount: stats.count,
        lastUsed: stats.lastUsed,
      };
    });
  }

  /**
   * Get secret handle by ID
   */
  getSecretHandle(secretId: string): SecretHandle | null {
    return this.handles.get(secretId) || null;
  }

  /**
   * Find secrets by name
   */
  findSecretsByName(name: string): SecretHandle[] {
    return Array.from(this.handles.values()).filter(h => 
      h.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  /**
   * Find secrets used by a tool
   */
  findSecretsByTool(toolName: string): SecretHandle[] {
    return Array.from(this.handles.values()).filter(h => 
      h.toolsUsing?.includes(toolName)
    );
  }

  // ============================================================================
  // REDACTION
  // ============================================================================

  /**
   * Redact secrets from any string (for logging)
   */
  redactSecrets(text: string): string {
    let redacted = text;
    
    // Apply all redaction rules
    for (const rule of this.redactionRules) {
      redacted = redacted.replace(rule.pattern, rule.replacement);
    }

    return redacted;
  }

  /**
   * Redact secrets from object (deep)
   */
  redactSecretsFromObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.redactSecrets(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactSecretsFromObject(item));
    }

    if (obj && typeof obj === 'object') {
      const redacted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Redact keys that look like sensitive fields
        if (/password|secret|token|key|apikey|api_key|credential/i.test(key)) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = this.redactSecretsFromObject(value);
        }
      }
      return redacted;
    }

    return obj;
  }

  /**
   * Add custom redaction rule
   */
  addRedactionRule(pattern: RegExp, replacement: string): void {
    this.redactionRules.push({ pattern, replacement });
  }

  // ============================================================================
  // ENVIRONMENT INJECTION
  // ============================================================================

  /**
   * Create environment variables from secret handles
   * Tools should receive env vars like: SECRET_<NAME>=<handle-id>
   * The actual value is injected at runtime, not visible in UI
   */
  createEnvFromHandles(secretIds: string[]): Record<string, string> {
    const env: Record<string, string> = {};
    
    for (const id of secretIds) {
      const handle = this.handles.get(id);
      if (handle) {
        // Use handle ID as reference, not actual secret
        const envKey = `SECRET_${handle.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
        env[envKey] = id; // Store handle ID, not actual secret
      }
    }

    return env;
  }

  /**
   * Resolve secret handles in environment to actual values
   * This should only be called right before tool execution
   */
  async resolveSecretsInEnv(env: Record<string, string>): Promise<Record<string, string>> {
    const resolved: Record<string, string> = { ...env };
    
    for (const [key, value] of Object.entries(env)) {
      if (key.startsWith('SECRET_')) {
        // Value is a handle ID, resolve it
        const secret = await this.getSecret(value);
        if (secret) {
          resolved[key] = secret.value;
        }
      }
    }

    return resolved;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Check if secure storage is available
   */
  isSecureStorageAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Get storage backend info
   */
  getStorageBackend(): string {
    if (process.platform === 'win32') return 'Windows DPAPI';
    if (process.platform === 'darwin') return 'macOS Keychain';
    if (process.platform === 'linux') return 'Linux Secret Service';
    return 'Unknown';
  }

  /**
   * Record secret usage
   */
  private recordUsage(secretId: string): void {
    const stats = this.usageStats.get(secretId) || { count: 0 };
    stats.count++;
    stats.lastUsed = new Date();
    this.usageStats.set(secretId, stats);
    this.persistUsageStats();
  }

  /**
   * Persist handles to store
   */
  private persistHandles(): void {
    const obj: Record<string, SecretHandle> = {};
    this.handles.forEach((handle, id) => {
      obj[id] = handle;
    });
    this.store.set('secretHandles', obj);
  }

  /**
   * Load handles from store
   */
  private loadHandles(): void {
    const saved = this.store.get('secretHandles', {}) as Record<string, any>;
    this.handles = new Map(
      Object.entries(saved).map(([id, h]) => [id, {
        ...h,
        createdAt: new Date(h.createdAt),
      }])
    );
  }

  /**
   * Persist usage stats
   */
  private persistUsageStats(): void {
    const obj: Record<string, any> = {};
    this.usageStats.forEach((stats, id) => {
      obj[id] = {
        count: stats.count,
        lastUsed: stats.lastUsed?.toISOString(),
      };
    });
    this.store.set('secretUsageStats', obj);
  }

  /**
   * Load usage stats
   */
  private loadUsageStats(): void {
    const saved = this.store.get('secretUsageStats', {}) as Record<string, any>;
    this.usageStats = new Map(
      Object.entries(saved).map(([id, stats]) => [id, {
        count: stats.count || 0,
        lastUsed: stats.lastUsed ? new Date(stats.lastUsed) : undefined,
      }])
    );
  }
}
