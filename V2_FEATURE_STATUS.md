# V2 Feature Status Analysis

Generated: February 5, 2026
Branch: v2-dev

## Overview
This document analyzes the current implementation status of V2 features against the roadmap.

---

## B) Declarative Permissions (metadata-based, not full sandbox)

### ✅ IMPLEMENTED
- [x] **Permission types defined** - `permissions.ts` has complete type system
  - `PermissionCategory`: filesystem, network, process
  - `FilesystemAction`: read, write, delete
  - `NetworkAction`: outbound, localhost
  - `ProcessAction`: spawn
  
- [x] **PermissionManager class** - Full implementation exists
  - `registerToolPermissions()` - Register tool permissions
  - `checkPermission()` - Check if action is allowed
  - `grantPermission()` / `denyPermission()` - Grant/deny permissions
  - `isDestructive()` - Identify high-risk tools
  - Risk assessment system (low/medium/high)
  
- [x] **IPC handlers** - All permission APIs exposed to renderer
  - `permissions:register`
  - `permissions:check`
  - `permissions:grant`
  - `permissions:deny`
  - `permissions:getPolicy`
  - `permissions:resetPolicy`

- [x] **UI permission prompts** - `PermissionPrompt` component exists in App.tsx
  - Shows tool name and permission request
  - Allow/Deny buttons

### ⚠️ PARTIALLY IMPLEMENTED
- [ ] **Tool manifest declarations** - Need to add `permissions` field to plugin package.json
  - Example structure needed
  - Loader needs to read and register permissions
  
- [ ] **Workbench UI displays permissions before first run**
  - Basic prompt exists but doesn't show detailed permission breakdown
  - Missing: formatted permission list with icons and risk levels
  - Missing: "Always allow" checkbox for permanent grants
  
- [ ] **Per-run confirmation for destructive actions**
  - `isDestructive()` exists but not enforced at runtime
  - No special handling for write/delete/spawn per-invocation

### ❌ NOT IMPLEMENTED
- [ ] **"Always allow this tool" option (per permission category)**
  - Backend supports `permanent: boolean` parameter
  - Frontend doesn't provide checkbox in UI
  
- [ ] **Clear "running with elevated privileges" warning**
  - No detection of elevated/admin mode
  - No UI warning when running as admin
  
- [ ] **Policy defaults: safest reasonable defaults**
  - Currently defaults to "unrestricted" for tools without declared permissions
  - Should default to "ask" or "deny" for safety

**Status: 60% Complete** - Core system exists, needs UI polish and enforcement

---

## C) Process Control (must never fail)

### ⚠️ PARTIALLY IMPLEMENTED
- [x] **Timeout support** - Individual commands have timeout parameter
  - `spawn()` calls use `timeout` option
  - Default: 30 seconds for most operations
  
- [x] **Basic process spawning** - `spawn()` used for shell commands and MCP servers
  - MCP servers tracked in `mcpServers` map
  - Store reference to `ChildProcess` objects

### ❌ NOT IMPLEMENTED  
- [ ] **Always-visible Stop / Kill control**
  - No UI to show running processes
  - No stop/kill buttons in interface
  
- [ ] **Hard timeout support (per tool + global default)**
  - Timeouts exist but not configurable per-tool
  - No global timeout setting
  
- [ ] **Hung detection ("no output for X seconds")**
  - No monitoring of process output
  - No detection of hung/frozen tools
  
- [ ] **Guaranteed cleanup of child processes (no orphans)**
  - MCP servers can be killed individually
  - No comprehensive child process tracking
  - No cleanup on app shutdown
  
- [ ] **Concurrency caps (avoid spawning 50 processes accidentally)**
  - No limits on concurrent tool execution
  - No queue system
  
- [ ] **Clear tool run states: queued / running / completed / failed / killed / timed out**
  - No state tracking infrastructure
  - No run history persistence

**Status: 15% Complete** - Basic spawning works, but no control infrastructure

---

## D) Visibility Dashboard (what's running + why)

### ❌ NOT IMPLEMENTED
- [ ] **"Running" panel shows:**
  - [ ] Tool name + version
  - [ ] Start time + elapsed time
  - [ ] Trigger source (user / chat / schedule)
  - [ ] Current status
  - [ ] Last output snippet
  
- [ ] **Full logs view per run (stdout/stderr separated)**
  - Currently only chat messages are logged
  - No persistent log storage
  
- [ ] **"Copy logs" button (sanitized)**
  - No log export functionality
  
- [ ] **Run history list (last N runs)**
  - No run history tracking
  
- [ ] **"Open run in detail view" (timeline optional in V2.0)**
  - No detail view

**Status: 0% Complete** - Not started

---

## E) Crash Recovery + State Persistence

### ⚠️ PARTIALLY IMPLEMENTED
- [x] **electron-store used for persistence**
  - Config stored: `store.set('toolPolicies', ...)`
  - MCP servers: `store.set('mcpServers', ...)`
  - Chain presets: `store.set('chainPresets', ...)`
  
- [x] **Chat history in memory**
  - `chatHistory` state exists in App.tsx
  - Updated during conversation

### ❌ NOT IMPLEMENTED
- [ ] **Persist chat history (survives restart)**
  - Not saved to electron-store
  - Lost on app close
  
- [ ] **Persist active runs (metadata + last known state)**
  - No run tracking at all
  
- [ ] **Persist tool outputs / log pointers**
  - Outputs only in memory (chatHistory)
  
- [ ] **On restart:**
  - [ ] Show "Workbench crashed / closed unexpectedly"
  - [ ] List interrupted runs
  - [ ] Offer: mark as failed / cleanup / retry
  
- [ ] **Corruption-safe storage (atomic writes)**
  - electron-store may handle this, needs verification
  
- [ ] **"Reset Workbench data" recovery option (last resort)**
  - No UI to clear all data

**Status: 20% Complete** - Some persistence exists, but critical data not saved

---

## V2.0 Definition of Done - Current Status

| Requirement | Status |
|-------------|--------|
| ✅ Users can tell what's running and why | ❌ No dashboard or visibility |
| ✅ Users can stop anything immediately | ❌ No stop/kill controls |
| ✅ Workbench warns before destructive actions | ⚠️ Partial - permissions exist but not enforced |
| ✅ Failures produce actionable diagnoses | ⚠️ Doctor engine exists for system diagnostics only |
| ✅ Crashes don't cause "where did my work go?" | ❌ Chat history not persisted |
| ✅ Chat history persists across restarts | ❌ Not implemented |

**Overall V2 Completion: ~25%**

---

## Recommended Implementation Order

### Phase 1: Core Infrastructure (Foundation)
1. **Run State Tracking System**
   - Create `RunManager` class to track all tool executions
   - States: queued, running, completed, failed, killed, timed-out
   - Store run metadata: tool name, start time, trigger source, status
   
2. **Process Registry**
   - Track all child processes centrally
   - Map process IDs to tool runs
   - Implement `killProcess()` and `killAll()` methods
   - Cleanup handler on app shutdown

3. **Log Capture System**
   - Capture stdout/stderr for all tool runs
   - Store logs in structured format (JSON or text)
   - Implement log rotation/cleanup policies

### Phase 2: UI & Control (Visibility)
4. **Running Panel Component**
   - New tab/panel showing active runs
   - Real-time status updates via IPC events
   - Stop/Kill buttons per run
   - Elapsed time display
   
5. **Run History View**
   - List last N runs with status
   - Filter by status, tool, date
   - View full logs modal
   - Copy/export logs functionality

6. **Permission Prompt Enhancement**
   - Show detailed permission breakdown with icons
   - "Always allow" checkbox
   - Display risk level colors
   - Show if running with elevated privileges

### Phase 3: Persistence & Recovery (Reliability)
7. **State Persistence**
   - Save chat history to electron-store on every message
   - Save active runs metadata periodically
   - Atomic write wrapper for critical data
   
8. **Crash Recovery UI**
   - Detect unexpected shutdown (flag in store)
   - Show recovery modal on restart
   - List interrupted runs
   - Offer cleanup/retry options
   
9. **Reset/Recovery Tools**
   - "Clear all data" button in Settings
   - Export diagnostic report (already exists via Doctor)
   - Import/export configuration

### Phase 4: Polish & Hardening (Safety)
10. **Concurrency & Timeouts**
    - Configurable per-tool timeouts in manifest
    - Global concurrency limit setting
    - Queue system for excess runs
    - Hung detection monitor
    
11. **Permission Enforcement**
    - Hook permission checks into all tool execution paths
    - Block unauthorized actions
    - Default to "ask" for undeclared permissions
    - Show elevated privileges warning on startup

---

## Quick Wins (Easy Improvements)

1. **Persist chat history** - One electron-store call, big UX improvement
2. **Show tool execution count** - Add counter to UI, no backend needed
3. **Add "Clear chat" button** - Simple state reset
4. **Process cleanup on shutdown** - Add `app.on('before-quit')` handler
5. **Default permission policy** - Change line in permissions.ts

---

## Breaking Changes / Migration Notes

- **Tool manifests need update**: All plugins should add `permissions` field
- **Backward compatibility**: Tools without permissions = unrestricted (warn in logs)
- **Storage format**: May need to migrate if changing electron-store schema

---

## Testing Priorities

1. ✅ Permission system works (grant/deny/persist)
2. ✅ Process cleanup (no orphans after kill/crash)
3. ✅ Chat history survives restart
4. ✅ Hung process detection triggers timeout
5. ✅ Stop button kills immediately
6. ✅ Recovery modal shows after crash
7. ✅ Concurrency cap enforced

---

## Next Steps

**For immediate V2 development:**

1. **Start with Phase 1, Item #1**: Build the `RunManager` class
   - This is the foundation everything else builds on
   - Define the run state machine
   - Create IPC events for run updates
   
2. **Then Phase 2, Item #4**: Build the Running Panel UI
   - Makes progress visible immediately
   - Provides testing ground for RunManager
   
3. **Then Phase 3, Item #7**: Persist chat history
   - Low effort, high user value
   - Tests persistence infrastructure

Would you like me to start implementing any of these features?
