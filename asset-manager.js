"use strict";
/**
 * Asset Manager - V2.0 Trust Core
 * File upload system with MIME validation, sandbox storage, and CRUD operations
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetManager = void 0;
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var crypto = __importStar(require("crypto"));
// ============================================================================
// MIME TYPE DETECTION
// ============================================================================
var MIME_SIGNATURES = [
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
var EXTENSION_MIME_MAP = {
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
var ALLOWED_MIME_TYPES = new Set([
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
var AssetManager = /** @class */ (function () {
    function AssetManager(store, sandboxDir, sessionId) {
        this.store = store;
        this.sandboxDir = sandboxDir;
        this.sessionId = sessionId || "session_".concat(Date.now(), "_").concat(Math.random().toString(36).slice(2, 7));
        this.maxFileSizeBytes = 50 * 1024 * 1024; // 50MB default
        // Ensure sandbox directory exists
        if (!fs.existsSync(this.sandboxDir)) {
            fs.mkdirSync(this.sandboxDir, { recursive: true });
        }
    }
    AssetManager.prototype.getSessionId = function () {
        return this.sessionId;
    };
    /**
     * Ingest a file from a source path into the sandbox
     */
    AssetManager.prototype.ingest = function (sourcePath) {
        return __awaiter(this, void 0, void 0, function () {
            var stat, mimeType, assetId, sha256, ext, sandboxFilename, sandboxPath, metadata;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Validate source file exists
                        if (!fs.existsSync(sourcePath)) {
                            throw new Error("Source file not found: ".concat(sourcePath));
                        }
                        stat = fs.statSync(sourcePath);
                        // Validate file size
                        if (stat.size > this.maxFileSizeBytes) {
                            throw new Error("File too large: ".concat((stat.size / 1024 / 1024).toFixed(1), "MB exceeds limit of ").concat((this.maxFileSizeBytes / 1024 / 1024).toFixed(0), "MB"));
                        }
                        if (stat.size === 0) {
                            throw new Error('Cannot ingest empty file');
                        }
                        mimeType = this.detectMimeType(sourcePath);
                        // Validate MIME type is allowed
                        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
                            throw new Error("File type not allowed: ".concat(mimeType));
                        }
                        assetId = "asset_".concat(Date.now(), "_").concat(Math.random().toString(36).slice(2, 9));
                        return [4 /*yield*/, this.computeSha256(sourcePath)];
                    case 1:
                        sha256 = _a.sent();
                        ext = path.extname(sourcePath);
                        sandboxFilename = "".concat(assetId).concat(ext);
                        sandboxPath = path.join(this.sandboxDir, sandboxFilename);
                        // Copy file to sandbox (read-only)
                        fs.copyFileSync(sourcePath, sandboxPath);
                        try {
                            fs.chmodSync(sandboxPath, 292); // Read-only
                        }
                        catch (_b) {
                            // chmod may not work on all platforms
                        }
                        metadata = {
                            asset_id: assetId,
                            filename: path.basename(sourcePath),
                            mime_type: mimeType,
                            size: stat.size,
                            sha256: sha256,
                            created_at: new Date().toISOString(),
                            session_id: this.sessionId,
                            original_path: sourcePath,
                        };
                        // Store metadata
                        this.saveAssetMetadata(metadata);
                        return [2 /*return*/, metadata];
                }
            });
        });
    };
    /**
     * Ingest from a Buffer (for drag & drop from renderer)
     */
    AssetManager.prototype.ingestBuffer = function (buffer, filename) {
        return __awaiter(this, void 0, void 0, function () {
            var mimeType, assetId, sha256, ext, sandboxFilename, sandboxPath, metadata;
            return __generator(this, function (_a) {
                // Validate size
                if (buffer.length > this.maxFileSizeBytes) {
                    throw new Error("File too large: ".concat((buffer.length / 1024 / 1024).toFixed(1), "MB exceeds limit of ").concat((this.maxFileSizeBytes / 1024 / 1024).toFixed(0), "MB"));
                }
                if (buffer.length === 0) {
                    throw new Error('Cannot ingest empty file');
                }
                mimeType = this.detectMimeFromBuffer(buffer, filename);
                if (!ALLOWED_MIME_TYPES.has(mimeType)) {
                    throw new Error("File type not allowed: ".concat(mimeType));
                }
                assetId = "asset_".concat(Date.now(), "_").concat(Math.random().toString(36).slice(2, 9));
                sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
                ext = path.extname(filename);
                sandboxFilename = "".concat(assetId).concat(ext);
                sandboxPath = path.join(this.sandboxDir, sandboxFilename);
                fs.writeFileSync(sandboxPath, buffer);
                try {
                    fs.chmodSync(sandboxPath, 292);
                }
                catch ( /* platform may not support */_b) { /* platform may not support */ }
                metadata = {
                    asset_id: assetId,
                    filename: filename,
                    mime_type: mimeType,
                    size: buffer.length,
                    sha256: sha256,
                    created_at: new Date().toISOString(),
                    session_id: this.sessionId,
                };
                this.saveAssetMetadata(metadata);
                return [2 /*return*/, metadata];
            });
        });
    };
    /**
     * List all assets
     */
    AssetManager.prototype.list = function () {
        var assets = this.loadAllAssetMetadata();
        return { assets: assets, total: assets.length };
    };
    /**
     * Get asset metadata by ID
     */
    AssetManager.prototype.get = function (assetId) {
        var assets = this.loadAllAssetMetadata();
        return assets.find(function (a) { return a.asset_id === assetId; }) || null;
    };
    /**
     * Resolve the safe sandbox path for an asset
     */
    AssetManager.prototype.resolvePath = function (assetId) {
        var meta = this.get(assetId);
        if (!meta)
            return null;
        // Find the file in sandbox
        var files = fs.readdirSync(this.sandboxDir);
        var match = files.find(function (f) { return f.startsWith(assetId); });
        if (!match)
            return null;
        return path.join(this.sandboxDir, match);
    };
    /**
     * Read asset content
     */
    AssetManager.prototype.open = function (assetId) {
        var meta = this.get(assetId);
        if (!meta)
            return null;
        var filePath = this.resolvePath(assetId);
        if (!filePath || !fs.existsSync(filePath))
            return null;
        var content = fs.readFileSync(filePath);
        return { metadata: meta, content: content };
    };
    /**
     * Delete an asset (confirmation should be handled by caller)
     */
    AssetManager.prototype.delete = function (assetId) {
        var filePath = this.resolvePath(assetId);
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.chmodSync(filePath, 420); // Make writable before delete
            }
            catch ( /* may fail on some platforms */_a) { /* may fail on some platforms */ }
            fs.unlinkSync(filePath);
        }
        // Remove metadata
        var assets = this.loadAllAssetMetadata();
        var filtered = assets.filter(function (a) { return a.asset_id !== assetId; });
        this.store.set('assets', filtered);
        return true;
    };
    /**
     * Export an asset to a destination path
     */
    AssetManager.prototype.export = function (assetId, destination) {
        var filePath = this.resolvePath(assetId);
        if (!filePath || !fs.existsSync(filePath))
            return false;
        fs.copyFileSync(filePath, destination);
        return true;
    };
    // --------------------------------------------------------------------------
    // PRIVATE HELPERS
    // --------------------------------------------------------------------------
    AssetManager.prototype.detectMimeType = function (filePath) {
        // Try magic bytes first
        try {
            var fd = fs.openSync(filePath, 'r');
            var buf = Buffer.alloc(16);
            fs.readSync(fd, buf, 0, 16, 0);
            fs.closeSync(fd);
            for (var _i = 0, MIME_SIGNATURES_1 = MIME_SIGNATURES; _i < MIME_SIGNATURES_1.length; _i++) {
                var sig = MIME_SIGNATURES_1[_i];
                var match = true;
                for (var i = 0; i < sig.bytes.length; i++) {
                    if (buf[sig.offset + i] !== sig.bytes[i]) {
                        match = false;
                        break;
                    }
                }
                if (match)
                    return sig.mime;
            }
        }
        catch ( /* fallback to extension */_a) { /* fallback to extension */ }
        // Fall back to extension
        var ext = path.extname(filePath).toLowerCase();
        return EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
    };
    AssetManager.prototype.detectMimeFromBuffer = function (buffer, filename) {
        // Check magic bytes
        for (var _i = 0, MIME_SIGNATURES_2 = MIME_SIGNATURES; _i < MIME_SIGNATURES_2.length; _i++) {
            var sig = MIME_SIGNATURES_2[_i];
            if (buffer.length < sig.offset + sig.bytes.length)
                continue;
            var match = true;
            for (var i = 0; i < sig.bytes.length; i++) {
                if (buffer[sig.offset + i] !== sig.bytes[i]) {
                    match = false;
                    break;
                }
            }
            if (match)
                return sig.mime;
        }
        // Fall back to extension
        var ext = path.extname(filename).toLowerCase();
        return EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
    };
    AssetManager.prototype.computeSha256 = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var hash = crypto.createHash('sha256');
                        var stream = fs.createReadStream(filePath);
                        stream.on('data', function (chunk) { return hash.update(chunk); });
                        stream.on('end', function () { return resolve(hash.digest('hex')); });
                        stream.on('error', reject);
                    })];
            });
        });
    };
    AssetManager.prototype.saveAssetMetadata = function (metadata) {
        var assets = this.loadAllAssetMetadata();
        assets.push(metadata);
        this.store.set('assets', assets);
    };
    AssetManager.prototype.loadAllAssetMetadata = function () {
        return this.store.get('assets') || [];
    };
    return AssetManager;
}());
exports.AssetManager = AssetManager;
