# Workbench Shell — Changelog

## 0.1.0-rc.1

### Shell & Workspaces
- Multi-workspace tab bar with per-workspace inner tabs (Chat / Artifacts / Runs / Context)
- Workspace templates (Butler, Maestro, Pipewrench) via template registry
- Workspace persistence to disk (`~/.workbench/workspaces.v1.json`)
- Auto-bootstrap: creates a default Butler workspace on first clean launch

### Runtime & Tools
- Tool registry with COLD → WARM → HOT lifecycle states
- Pegboard panel for mounting, monitoring, and stopping tools
- Built-in tool manifests with doctor checks (flakiness, timeouts, latency)
- MCP server integration via Electron main process

### Chat, Artifacts, Runs
- Per-workspace chat timeline with streaming LLM responses (80ms backpressure buffer)
- Slash commands: `/doctor`, `/tool <name> [json]`, `/help`
- Artifact store with workspace isolation and ArtifactList view
- RunsList view filtered from shell log events
- Tab labels show live artifact and run counts

### LLM + Context Controls
- OpenAI and Anthropic clients; configurable model, temperature, maxTokens, streaming
- `buildLLMContext` with token budget, pinned messages, workspace summary, explicit includes
- Context Preview modal: preview the exact message array sent to the LLM with token estimate
- "Pin implies include" — pinning a message auto-adds it to `includeMessageIds`
- Summary generation via LLM (M8); deterministic fallback when provider is mock

### Supervisor + Suggestions
- `generateSuggestions` produces context-aware clickable chips after each LLM response
- Confirm modal for suggestions with `requiresConfirm: true`
- Runtime-aware suggestions using last 10 tool messages (L+3)
- Dismiss button clears all suggestions for a message

### Persistence + Stability
- Atomic writes using tmp-then-rename pattern with fsync (best effort)
- 150ms per-key write debounce; `flushAll()` on `beforeunload`
- Corruption recovery: corrupt files renamed to `.corrupt.<ts>.json`; recovery note shown in chat
- `{version: 1, data}` wrapper written to all storage files for forward-compatible migrations
- `context` storage key fixed in Electron IPC allowlist (was silently failing since Phase M)

### Command Palette
- Ctrl+K palette with scope prefixes: `>` commands, `#` templates, `@` workspaces, `!` artifacts
- Focus save/restore on open/close
- Built-in commands: Set LLM provider/key/model, Run Doctor, Toggle Log Drawer, Test LLM
- RC commands: Copy Diagnostics, Copy Recent Logs, Show Version

### RC Plumbing
- Crash capture: `uncaughtException` / `unhandledRejection` logged to `~/.workbench/crash.log`
- Renderer errors forwarded via IPC (Electron) or localStorage ring buffer (Vite dev mode)
- Recovery message shown in Butler chat if a crash occurred within the last 24 hours
- `buildDiagnostics()` produces a shareable snapshot with no secrets
- `npm run rc:check` script validates version, CHANGELOG, RELEASE_NOTES
