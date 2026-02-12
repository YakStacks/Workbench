"use strict";
/**
 * Sessions Manager
 * Manages isolated session containers with their own state, history, and context
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsManager = void 0;
var electron_1 = require("electron");
var path = __importStar(require("path"));
var fs = __importStar(require("fs"));
var uuid_1 = require("uuid");
var SessionsManager = /** @class */ (function () {
    function SessionsManager(store) {
        this.currentSessionId = null;
        this.store = store;
        this.sessionsDir = path.join(electron_1.app.getPath('userData'), 'sessions');
        // Ensure sessions directory exists
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
        // Migrate old chat history if exists
        this.migrateOldChatHistory();
    }
    /**
     * Migrate old single chat history to first session
     */
    SessionsManager.prototype.migrateOldChatHistory = function () {
        var oldHistory = this.store.get('chatHistory');
        if (oldHistory && oldHistory.length > 0) {
            var sessions = this.getAllSessionMetadata();
            // Only migrate if no sessions exist yet
            if (sessions.length === 0) {
                console.log('[SessionsManager] Migrating old chat history to new session');
                var session = this.createSession('Previous Chat');
                session.chatHistory = oldHistory;
                this.saveSession(session);
                this.setCurrentSession(session.id);
                // Clear old history
                this.store.delete('chatHistory');
            }
        }
    };
    /**
     * Get all session metadata (for sidebar list)
     */
    SessionsManager.prototype.getAllSessionMetadata = function () {
        return this.store.get('sessions', [])
            .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    };
    /**
     * Create a new session
     */
    SessionsManager.prototype.createSession = function (name) {
        if (name === void 0) { name = 'New Session'; }
        var session = {
            id: (0, uuid_1.v4)(),
            name: name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            chatHistory: [],
            assets: [],
            toolRuns: [],
            model: 'claude-sonnet-4-20250514',
            mode: 'execute',
            provider: 'anthropic',
            environmentContext: {}
        };
        // Save session data to file
        this.saveSession(session);
        // Add metadata to store
        var sessions = this.getAllSessionMetadata();
        sessions.push({
            id: session.id,
            name: session.name,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
        });
        this.store.set('sessions', sessions);
        return session;
    };
    /**
     * Get a session by ID
     */
    SessionsManager.prototype.getSession = function (sessionId) {
        var sessionPath = path.join(this.sessionsDir, "".concat(sessionId, ".json"));
        if (!fs.existsSync(sessionPath)) {
            return null;
        }
        try {
            var data = fs.readFileSync(sessionPath, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            console.error("[SessionsManager] Error loading session ".concat(sessionId, ":"), error);
            return null;
        }
    };
    /**
     * Save a session
     */
    SessionsManager.prototype.saveSession = function (session) {
        session.updatedAt = Date.now();
        var sessionPath = path.join(this.sessionsDir, "".concat(session.id, ".json"));
        fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
        // Update metadata in store
        var sessions = this.getAllSessionMetadata();
        var index = sessions.findIndex(function (s) { return s.id === session.id; });
        if (index >= 0) {
            sessions[index].name = session.name;
            sessions[index].updatedAt = session.updatedAt;
        }
        else {
            sessions.push({
                id: session.id,
                name: session.name,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt
            });
        }
        this.store.set('sessions', sessions);
    };
    /**
     * Delete a session
     */
    SessionsManager.prototype.deleteSession = function (sessionId) {
        var sessionPath = path.join(this.sessionsDir, "".concat(sessionId, ".json"));
        try {
            if (fs.existsSync(sessionPath)) {
                fs.unlinkSync(sessionPath);
            }
            // Remove from metadata
            var sessions = this.getAllSessionMetadata();
            var filtered = sessions.filter(function (s) { return s.id !== sessionId; });
            this.store.set('sessions', filtered);
            // If this was the current session, clear it
            if (this.currentSessionId === sessionId) {
                this.currentSessionId = null;
            }
            return true;
        }
        catch (error) {
            console.error("[SessionsManager] Error deleting session ".concat(sessionId, ":"), error);
            return false;
        }
    };
    /**
     * Rename a session
     */
    SessionsManager.prototype.renameSession = function (sessionId, newName) {
        var session = this.getSession(sessionId);
        if (!session)
            return false;
        session.name = newName;
        this.saveSession(session);
        return true;
    };
    /**
     * Get current session ID
     */
    SessionsManager.prototype.getCurrentSessionId = function () {
        if (!this.currentSessionId) {
            this.currentSessionId = this.store.get('currentSessionId') || null;
        }
        return this.currentSessionId;
    };
    /**
     * Set current session
     */
    SessionsManager.prototype.setCurrentSession = function (sessionId) {
        var session = this.getSession(sessionId);
        if (!session)
            return false;
        this.currentSessionId = sessionId;
        this.store.set('currentSessionId', sessionId);
        return true;
    };
    /**
     * Get current session (or create one if none exists)
     */
    SessionsManager.prototype.getCurrentSession = function () {
        var sessionId = this.getCurrentSessionId();
        if (!sessionId) {
            // No current session, create a default one
            var session_1 = this.createSession('Main Session');
            this.setCurrentSession(session_1.id);
            return session_1;
        }
        var session = this.getSession(sessionId);
        if (!session) {
            // Session was deleted, create a new one
            var newSession = this.createSession('Main Session');
            this.setCurrentSession(newSession.id);
            return newSession;
        }
        return session;
    };
    /**
     * Update session chat history
     */
    SessionsManager.prototype.updateChatHistory = function (sessionId, history) {
        var session = this.getSession(sessionId);
        if (!session)
            return false;
        session.chatHistory = history;
        this.saveSession(session);
        return true;
    };
    /**
     * Add asset to session
     */
    SessionsManager.prototype.addAsset = function (sessionId, assetId) {
        var session = this.getSession(sessionId);
        if (!session)
            return false;
        if (!session.assets.includes(assetId)) {
            session.assets.push(assetId);
            this.saveSession(session);
        }
        return true;
    };
    /**
     * Remove asset from session
     */
    SessionsManager.prototype.removeAsset = function (sessionId, assetId) {
        var session = this.getSession(sessionId);
        if (!session)
            return false;
        session.assets = session.assets.filter(function (id) { return id !== assetId; });
        this.saveSession(session);
        return true;
    };
    /**
     * Update session mode
     */
    SessionsManager.prototype.updateMode = function (sessionId, mode) {
        var session = this.getSession(sessionId);
        if (!session)
            return false;
        session.mode = mode;
        this.saveSession(session);
        return true;
    };
    /**
     * Update session model
     */
    SessionsManager.prototype.updateModel = function (sessionId, model) {
        var session = this.getSession(sessionId);
        if (!session)
            return false;
        session.model = model;
        this.saveSession(session);
        return true;
    };
    /**
     * Update session provider
     */
    SessionsManager.prototype.updateProvider = function (sessionId, provider) {
        var session = this.getSession(sessionId);
        if (!session)
            return false;
        session.provider = provider;
        this.saveSession(session);
        return true;
    };
    return SessionsManager;
}());
exports.SessionsManager = SessionsManager;
