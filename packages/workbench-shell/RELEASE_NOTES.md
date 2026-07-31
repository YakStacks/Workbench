# Workbench Shell — Release Notes

## v0.1.0-rc.1 (Internal RC)

**What's new:**
- Full workspace system: create, persist, and switch between Butler / Maestro / Pipewrench workspaces
- LLM chat with streaming (OpenAI + Anthropic); context controls with pinned messages and summaries
- Tool Pegboard: register, monitor, and control tool lifecycle (COLD → WARM → HOT)
- Command Palette (Ctrl+K): configure API keys, run diagnostics, copy logs, show version
- Crash capture: unhandled errors written to `~/.workbench/crash.log`; recovery note shown on next launch
- Context Preview modal: inspect the exact message array sent to the LLM before sending

**How to set API keys:**
1. Press **Ctrl+K** to open the Command Palette
2. Search **"Set key"** and select your provider (OpenAI or Anthropic)
3. Enter your API key when prompted (`sk-…` for OpenAI, `sk-ant-…` for Anthropic)

**Known limitations:**
- No built-in LLM key rotation or expiry detection
- Crash log is append-only; manual cleanup required if it grows large (`~/.workbench/crash.log`)
- Context token counts are estimates (1 token ≈ 4 characters)
- MCP server reconnect is manual via the main-process config
