/**
 * Asset Manager - V2.0 Trust Core
 * File upload system with MIME validation, sandbox storage, and CRUD operations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import Store from 'electron-store';

// ============================================================================
// TYPES
// ============================================================================

export interface AssetMetadata {
  asset_id: string;
  filename: string;
  mime_type: string;
  size: number;
  sha256: string;
  created_at: string;
  session_id: string;
  original_path?: string;
}

export interface AssetListResult {
  assets: AssetMetadata[];
  total: number;
}

// ============================================================================
// MIME TYPE DETECTION
// ============================================================================

const MIME_SIGNATURES: Array<{ bytes: number[]; offset: number; mime: string }> = [
  // PDF
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mime: 'application/pdf' },
  // PNG
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, mime: 'image/png' },
  // JPEG
  { bytes: [0xFF, 0xD8, 0xFF], offset: 0, mime: 'image/jpeg' },
  // GIF
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, mime: 'image/gif' },
  // WebP
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mime: 'image/webp' },
  // BMP
  { bytes: [0x42, 0x4D], offset: 0, mime: 'image/bmp' },
  // ZIP (also .xlsx, .docx)
  { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, mime: 'application/zip' },
  // WAV
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mime: 'audio/wav' },
  // MP3
  { bytes: [0x49, 0x44, 0x33], offset: 0, mime: 'audio/mpeg' },
];

const EXTENSION_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.md': 'text/markdown',
  '.log': 'text/plain',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.toml': 'text/plain',
  '.ini': 'text/plain',
  '.cfg': 'text/plain',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/html',
  'text/yaml',
  'application/json',
  'application/xml',
  'audio/wav',
  'audio/mpeg',
  'audio/ogg',
]);

// ============================================================================
// ASSET MANAGER
// ============================================================================

export class AssetManager {
  private store: Store;
  private sandboxDir: string;
  private sessionId: string;
  private maxFileSizeBytes: number;

  constructor(store: Store, sandboxDir: string, sessionId?: string) {
    this.store = store;
    this.sandboxDir = sandboxDir;
    this.sessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.maxFileSizeBytes = 50 * 1024 * 1024; // 50MB default

    // Ensure sandbox directory exists
    if (!fs.existsSync(this.sandboxDir)) {
      fs.mkdirSync(this.sandboxDir, { recursive: true });
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Ingest a file from a source path into the sandbox
   */
  async ingest(sourcePath: string): Promise<AssetMetadata> {
    // Validate source file exists
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    const stat = fs.statSync(sourcePath);

    // Validate file size
    if (stat.size > this.maxFileSizeBytes) {
      throw new Error(
        `File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB exceeds limit of ${(this.maxFileSizeBytes / 1024 / 1024).toFixed(0)}MB`
      );
    }

    if (stat.size === 0) {
      throw new Error('Cannot ingest empty file');
    }

    // Detect MIME type from content (don't trust extension)
    const mimeType = this.detectMimeType(sourcePath);

    // Validate MIME type is allowed
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(`File type not allowed: ${mimeType}`);
    }

    // Generate asset ID and compute hash
    const assetId = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const sha256 = await this.computeSha256(sourcePath);
    const ext = path.extname(sourcePath);
    const sandboxFilename = `${assetId}${ext}`;
    const sandboxPath = path.join(this.sandboxDir, sandboxFilename);

    // Copy file to sandbox (read-only)
    fs.copyFileSync(sourcePath, sandboxPath);
    try {
      fs.chmodSync(sandboxPath, 0o444); // Read-only
    } catch {
      // chmod may not work on all platforms
    }

    const metadata: AssetMetadata = {
      asset_id: assetId,
      filename: path.basename(sourcePath),
      mime_type: mimeType,
      size: stat.size,
      sha256,
      created_at: new Date().toISOString(),
      session_id: this.sessionId,
      original_path: sourcePath,
    };

    // Store metadata
    this.saveAssetMetadata(metadata);

    return metadata;
  }

  /**
   * Ingest from a Buffer (for drag & drop from renderer)
   */
  async ingestBuffer(buffer: Buffer, filename: string): Promise<AssetMetadata> {
    // Validate size
    if (buffer.length > this.maxFileSizeBytes) {
      throw new Error(
        `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB exceeds limit of ${(this.maxFileSizeBytes / 1024 / 1024).toFixed(0)}MB`
      );
    }

    if (buffer.length === 0) {
      throw new Error('Cannot ingest empty file');
    }

    // Detect MIME from buffer
    const mimeType = this.detectMimeFromBuffer(buffer, filename);

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(`File type not allowed: ${mimeType}`);
    }

    const assetId = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const ext = path.extname(filename);
    const sandboxFilename = `${assetId}${ext}`;
    const sandboxPath = path.join(this.sandboxDir, sandboxFilename);

    fs.writeFileSync(sandboxPath, buffer);
    try {
      fs.chmodSync(sandboxPath, 0o444);
    } catch { /* platform may not support */ }

    const metadata: AssetMetadata = {
      asset_id: assetId,
      filename,
      mime_type: mimeType,
      size: buffer.length,
      sha256,
      created_at: new Date().toISOString(),
      session_id: this.sessionId,
    };

    this.saveAssetMetadata(metadata);
    return metadata;
  }

  /**
   * List all assets
   */
  list(): AssetListResult {
    const assets = this.loadAllAssetMetadata();
    return { assets, total: assets.length };
  }

  /**
   * Get asset metadata by ID
   */
  get(assetId: string): AssetMetadata | null {
    const assets = this.loadAllAssetMetadata();
    return assets.find(a => a.asset_id === assetId) || null;
  }

  /**
   * Resolve the safe sandbox path for an asset
   */
  resolvePath(assetId: string): string | null {
    const meta = this.get(assetId);
    if (!meta) return null;

    // Find the file in sandbox
    const files = fs.readdirSync(this.sandboxDir);
    const match = files.find(f => f.startsWith(assetId));
    if (!match) return null;

    return path.join(this.sandboxDir, match);
  }

  /**
   * Read asset content
   */
  open(assetId: string): { metadata: AssetMetadata; content: Buffer } | null {
    const meta = this.get(assetId);
    if (!meta) return null;

    const filePath = this.resolvePath(assetId);
    if (!filePath || !fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath);
    return { metadata: meta, content };
  }

  /**
   * Delete an asset (confirmation should be handled by caller)
   */
  delete(assetId: string): boolean {
    const filePath = this.resolvePath(assetId);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.chmodSync(filePath, 0o644); // Make writable before delete
      } catch { /* may fail on some platforms */ }
      fs.unlinkSync(filePath);
    }

    // Remove metadata
    const assets = this.loadAllAssetMetadata();
    const filtered = assets.filter(a => a.asset_id !== assetId);
    this.store.set('assets', filtered);

    return true;
  }

  /**
   * Export an asset to a destination path
   */
  export(assetId: string, destination: string): boolean {
    const filePath = this.resolvePath(assetId);
    if (!filePath || !fs.existsSync(filePath)) return false;

    fs.copyFileSync(filePath, destination);
    return true;
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  private detectMimeType(filePath: string): string {
    // Try magic bytes first
    try {
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(16);
      fs.readSync(fd, buf, 0, 16, 0);
      fs.closeSync(fd);

      for (const sig of MIME_SIGNATURES) {
        let match = true;
        for (let i = 0; i < sig.bytes.length; i++) {
          if (buf[sig.offset + i] !== sig.bytes[i]) {
            match = false;
            break;
          }
        }
        if (match) return sig.mime;
      }
    } catch { /* fallback to extension */ }

    // Fall back to extension
    const ext = path.extname(filePath).toLowerCase();
    return EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
  }

  private detectMimeFromBuffer(buffer: Buffer, filename: string): string {
    // Check magic bytes
    for (const sig of MIME_SIGNATURES) {
      if (buffer.length < sig.offset + sig.bytes.length) continue;
      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (buffer[sig.offset + i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) return sig.mime;
    }

    // Fall back to extension
    const ext = path.extname(filename).toLowerCase();
    return EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
  }

  private async computeSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private saveAssetMetadata(metadata: AssetMetadata): void {
    const assets = this.loadAllAssetMetadata();
    assets.push(metadata);
    this.store.set('assets', assets);
  }

  private loadAllAssetMetadata(): AssetMetadata[] {
    return (this.store.get('assets') as AssetMetadata[] | undefined) || [];
  }
}
