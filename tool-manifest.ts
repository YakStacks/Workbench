/**
 * Tool Manifest Standard - V2.0 Ecosystem Hygiene
 * Standardized metadata schema for tool registration
 */

import { ToolPermissions } from "./permissions";

// ============================================================================
// TYPES
// ============================================================================

export type ToolStability = 'experimental' | 'beta' | 'stable';
export type ToolTransport = 'local' | 'http' | 'mcp' | 'plugin';

export interface ToolAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface ToolManifest {
  // Basic info
  name: string;
  version: string;
  author: ToolAuthor | string;
  description: string;
  tags?: string[];

  // Permissions
  permissions: ToolPermissions;

  // System requirements
  supportedOS?: ('win32' | 'darwin' | 'linux')[];
  supportedArch?: ('x64' | 'arm64')[];
  requiredDependencies?: string[]; // e.g., ['node >= 16', 'python >= 3.8']

  // Stability & maturity
  stability: ToolStability;

  // Transport details
  transport: ToolTransport;
  entrypoint?: string; // File path for local tools

  // Icon & branding
  icon?: string; // Emoji or icon identifier

  // Security
  usesCredentials?: boolean; // Does this tool access secrets?
  secretHandles?: string[]; // Which secrets does it need?

  // Capabilities
  supportsPreview?: boolean; // Can this tool do dry-run?
  isIdempotent?: boolean; // Safe to run multiple times?

  // Execution limits
  timeoutMs?: number; // Per-tool timeout override (default: 30000)

  // Metadata
  homepage?: string;
  repository?: string;
  license?: string;
}

export interface ToolCompatibilityResult {
  compatible: boolean;
  warnings: string[];
  errors: string[];
}

// ============================================================================
// MANIFEST VALIDATOR
// ============================================================================

export class ToolManifestValidator {
  /**
   * Validate a tool manifest
   */
  validate(manifest: Partial<ToolManifest>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!manifest.name) errors.push('Missing required field: name');
    if (!manifest.version) errors.push('Missing required field: version');
    if (!manifest.author) errors.push('Missing required field: author');
    if (!manifest.description) errors.push('Missing required field: description');
    if (!manifest.permissions) errors.push('Missing required field: permissions');
    if (!manifest.stability) errors.push('Missing required field: stability');
    if (!manifest.transport) errors.push('Missing required field: transport');

    // Version format
    if (manifest.version && !this.isValidVersion(manifest.version)) {
      errors.push(`Invalid version format: ${manifest.version} (expected semver)`);
    }

    // Stability
    if (manifest.stability && !['experimental', 'beta', 'stable'].includes(manifest.stability)) {
      errors.push(`Invalid stability: ${manifest.stability}`);
    }

    // Transport
    if (manifest.transport && !['local', 'http', 'mcp', 'plugin'].includes(manifest.transport)) {
      errors.push(`Invalid transport: ${manifest.transport}`);
    }

    // Entrypoint required for local tools
    if (manifest.transport === 'local' && !manifest.entrypoint) {
      errors.push('Local tools must specify an entrypoint');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check compatibility with current environment
   */
  checkCompatibility(manifest: ToolManifest): ToolCompatibilityResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    let compatible = true;

    // OS compatibility
    if (manifest.supportedOS && !manifest.supportedOS.includes(process.platform as any)) {
      errors.push(`Tool does not support ${process.platform} (supports: ${manifest.supportedOS.join(', ')})`);
      compatible = false;
    }

    // Architecture compatibility
    if (manifest.supportedArch && !manifest.supportedArch.includes(process.arch as any)) {
      errors.push(`Tool does not support ${process.arch} architecture (supports: ${manifest.supportedArch.join(', ')})`);
      compatible = false;
    }

    // Dependency checks (basic)
    if (manifest.requiredDependencies) {
      for (const dep of manifest.requiredDependencies) {
        // Parse "node >= 16" style requirements
        const match = dep.match(/^(\w+)\s*(>=|<=|>|<|=)\s*(.+)$/);
        if (match) {
          const [, depName, operator, version] = match;
          // TODO: Implement actual version checking
          warnings.push(`Required dependency: ${dep} (check not implemented)`);
        }
      }
    }

    // Stability warnings
    if (manifest.stability === 'experimental') {
      warnings.push('This tool is experimental and may have bugs or breaking changes');
    } else if (manifest.stability === 'beta') {
      warnings.push('This tool is in beta - use with caution');
    }

    // Credential warnings
    if (manifest.usesCredentials) {
      warnings.push('This tool requires credentials/secrets');
    }

    return { compatible, warnings, errors };
  }

  /**
   * Validate semver version string
   */
  private isValidVersion(version: string): boolean {
    // Simple semver regex
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version);
  }
}

// ============================================================================
// MANIFEST REGISTRY
// ============================================================================

export class ToolManifestRegistry {
  private manifests: Map<string, ToolManifest> = new Map();
  private validator: ToolManifestValidator;

  constructor() {
    this.validator = new ToolManifestValidator();
  }

  /**
   * Register a tool manifest
   */
  register(manifest: ToolManifest): { success: boolean; errors: string[] } {
    const validation = this.validator.validate(manifest);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    this.manifests.set(manifest.name, manifest);
    return { success: true, errors: [] };
  }

  /**
   * Get manifest for a tool
   */
  get(toolName: string): ToolManifest | undefined {
    return this.manifests.get(toolName);
  }

  /**
   * List all registered manifests
   */
  list(): ToolManifest[] {
    return Array.from(this.manifests.values());
  }

  /**
   * Check if tool is compatible with environment
   */
  checkCompatibility(toolName: string): ToolCompatibilityResult | null {
    const manifest = this.manifests.get(toolName);
    if (!manifest) return null;

    return this.validator.checkCompatibility(manifest);
  }

  /**
   * Find tools by tag
   */
  findByTag(tag: string): ToolManifest[] {
    return Array.from(this.manifests.values()).filter(m =>
      m.tags?.includes(tag)
    );
  }

  /**
   * Find tools by stability level
   */
  findByStability(stability: ToolStability): ToolManifest[] {
    return Array.from(this.manifests.values()).filter(m =>
      m.stability === stability
    );
  }

  /**
   * Get tool info for display
   */
  getToolInfo(toolName: string): string | null {
    const manifest = this.manifests.get(toolName);
    if (!manifest) return null;

    const compatibility = this.validator.checkCompatibility(manifest);
    const author = typeof manifest.author === 'string' ? manifest.author : manifest.author.name;

    let info = `**${manifest.name}** v${manifest.version}\n`;
    info += `By ${author}\n\n`;
    info += `${manifest.description}\n\n`;
    
    if (manifest.tags && manifest.tags.length > 0) {
      info += `**Tags:** ${manifest.tags.join(', ')}\n`;
    }

    info += `**Stability:** ${manifest.stability}\n`;
    info += `**Transport:** ${manifest.transport}\n`;

    if (manifest.supportedOS) {
      info += `**OS:** ${manifest.supportedOS.join(', ')}\n`;
    }

    if (manifest.usesCredentials) {
      info += `**⚠️ Uses Credentials**\n`;
    }

    if (manifest.supportsPreview) {
      info += `**✓ Supports Preview Mode**\n`;
    }

    if (compatibility.warnings.length > 0) {
      info += `\n**Warnings:**\n${compatibility.warnings.map(w => `- ${w}`).join('\n')}\n`;
    }

    if (compatibility.errors.length > 0) {
      info += `\n**Errors:**\n${compatibility.errors.map(e => `- ${e}`).join('\n')}\n`;
    }

    return info;
  }
}

// ============================================================================
// MANIFEST BUILDER (Helper)
// ============================================================================

export class ManifestBuilder {
  private manifest: Partial<ToolManifest> = {};

  name(name: string): this {
    this.manifest.name = name;
    return this;
  }

  version(version: string): this {
    this.manifest.version = version;
    return this;
  }

  author(author: ToolAuthor | string): this {
    this.manifest.author = author;
    return this;
  }

  description(description: string): this {
    this.manifest.description = description;
    return this;
  }

  tags(...tags: string[]): this {
    this.manifest.tags = tags;
    return this;
  }

  permissions(permissions: ToolPermissions): this {
    this.manifest.permissions = permissions;
    return this;
  }

  stability(stability: ToolStability): this {
    this.manifest.stability = stability;
    return this;
  }

  transport(transport: ToolTransport): this {
    this.manifest.transport = transport;
    return this;
  }

  entrypoint(entrypoint: string): this {
    this.manifest.entrypoint = entrypoint;
    return this;
  }

  icon(icon: string): this {
    this.manifest.icon = icon;
    return this;
  }

  usesCredentials(secretHandles?: string[]): this {
    this.manifest.usesCredentials = true;
    this.manifest.secretHandles = secretHandles;
    return this;
  }

  supportsPreview(): this {
    this.manifest.supportsPreview = true;
    return this;
  }

  isIdempotent(): this {
    this.manifest.isIdempotent = true;
    return this;
  }

  supportedOS(...os: ('win32' | 'darwin' | 'linux')[]): this {
    this.manifest.supportedOS = os;
    return this;
  }

  build(): ToolManifest {
    if (!this.manifest.name || !this.manifest.version || !this.manifest.author ||
        !this.manifest.description || !this.manifest.permissions || 
        !this.manifest.stability || !this.manifest.transport) {
      throw new Error('Missing required manifest fields');
    }

    return this.manifest as ToolManifest;
  }
}
