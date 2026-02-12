/**
 * Sessions Manager
 * Manages isolated session containers with their own state, history, and context
 */

import { app } from 'electron';
import Store from 'electron-store';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Session data structure
export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  chatHistory: any[];
  assets: string[]; // Asset IDs
  toolRuns: any[];
  model: string;
  mode: 'read' | 'propose' | 'execute';
  provider: string;
  environmentContext: {
    workingDirectory?: string;
    [key: string]: any;
  };
}

// Session metadata (stored in main store)
export interface SessionMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export class SessionsManager {
  private store: Store;
  private sessionsDir: string;
  private currentSessionId: string | null = null;

  constructor(store: Store) {
    this.store = store;
    this.sessionsDir = path.join(app.getPath('userData'), 'sessions');

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
  private migrateOldChatHistory() {
    const oldHistory = this.store.get('chatHistory') as any[];
    if (oldHistory && oldHistory.length > 0) {
      const sessions = this.getAllSessionMetadata();

      // Only migrate if no sessions exist yet
      if (sessions.length === 0) {
        console.log('[SessionsManager] Migrating old chat history to new session');
        const session = this.createSession('Previous Chat');
        session.chatHistory = oldHistory;
        this.saveSession(session);
        this.setCurrentSession(session.id);

        // Clear old history
        this.store.delete('chatHistory');
      }
    }
  }

  /**
   * Get all session metadata (for sidebar list)
   */
  getAllSessionMetadata(): SessionMetadata[] {
    return (this.store.get('sessions', []) as SessionMetadata[])
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Create a new session
   */
  createSession(name: string = 'New Session'): Session {
    const session: Session = {
      id: uuidv4(),
      name,
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
    const sessions = this.getAllSessionMetadata();
    sessions.push({
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    });
    this.store.set('sessions', sessions);

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | null {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(sessionPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`[SessionsManager] Error loading session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Save a session
   */
  saveSession(session: Session): void {
    session.updatedAt = Date.now();

    const sessionPath = path.join(this.sessionsDir, `${session.id}.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf-8');

    // Update metadata in store
    const sessions = this.getAllSessionMetadata();
    const index = sessions.findIndex(s => s.id === session.id);

    if (index >= 0) {
      sessions[index].name = session.name;
      sessions[index].updatedAt = session.updatedAt;
    } else {
      sessions.push({
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      });
    }

    this.store.set('sessions', sessions);
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const sessionPath = path.join(this.sessionsDir, `${sessionId}.json`);

    try {
      if (fs.existsSync(sessionPath)) {
        fs.unlinkSync(sessionPath);
      }

      // Remove from metadata
      const sessions = this.getAllSessionMetadata();
      const filtered = sessions.filter(s => s.id !== sessionId);
      this.store.set('sessions', filtered);

      // If this was the current session, clear it
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
      }

      return true;
    } catch (error) {
      console.error(`[SessionsManager] Error deleting session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Rename a session
   */
  renameSession(sessionId: string, newName: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.name = newName;
    this.saveSession(session);
    return true;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    if (!this.currentSessionId) {
      this.currentSessionId = this.store.get('currentSessionId') as string || null;
    }
    return this.currentSessionId;
  }

  /**
   * Set current session
   */
  setCurrentSession(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    this.currentSessionId = sessionId;
    this.store.set('currentSessionId', sessionId);
    return true;
  }

  /**
   * Get current session (or create one if none exists)
   */
  getCurrentSession(): Session {
    let sessionId = this.getCurrentSessionId();

    if (!sessionId) {
      // No current session, create a default one
      const session = this.createSession('Main Session');
      this.setCurrentSession(session.id);
      return session;
    }

    const session = this.getSession(sessionId);

    if (!session) {
      // Session was deleted, create a new one
      const newSession = this.createSession('Main Session');
      this.setCurrentSession(newSession.id);
      return newSession;
    }

    return session;
  }

  /**
   * Update session chat history
   */
  updateChatHistory(sessionId: string, history: any[]): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.chatHistory = history;
    this.saveSession(session);
    return true;
  }

  /**
   * Add asset to session
   */
  addAsset(sessionId: string, assetId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    if (!session.assets.includes(assetId)) {
      session.assets.push(assetId);
      this.saveSession(session);
    }
    return true;
  }

  /**
   * Remove asset from session
   */
  removeAsset(sessionId: string, assetId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.assets = session.assets.filter(id => id !== assetId);
    this.saveSession(session);
    return true;
  }

  /**
   * Update session mode
   */
  updateMode(sessionId: string, mode: 'read' | 'propose' | 'execute'): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.mode = mode;
    this.saveSession(session);
    return true;
  }

  /**
   * Update session model
   */
  updateModel(sessionId: string, model: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.model = model;
    this.saveSession(session);
    return true;
  }

  /**
   * Update session provider
   */
  updateProvider(sessionId: string, provider: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    session.provider = provider;
    this.saveSession(session);
    return true;
  }
}
