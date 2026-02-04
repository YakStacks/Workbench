# MCP Known Issues (Deferred to V2)

## Issue Summary
Model Context Protocol (MCP) server integration fails when spawned from Electron on Windows, despite working correctly in standalone Node.js tests.

## Root Cause
Electron's stdio pipe handling on Windows has fundamental incompatibility with MCP servers:
- MCP servers receive messages correctly (confirmed via stderr output)
- stdin writes complete successfully (confirmed via write callbacks)
- stdout becomes readable but never emits data events
- Servers timeout after 30 seconds without sending responses

## What Works
- ✅ Standalone Node.js test (`test-line-delimited.mjs`) successfully connects to MCP servers
- ✅ Line-delimited JSON protocol format verified
- ✅ Direct `node` command spawning (not Electron's process)
- ✅ Message framing and serialization correct

## What Doesn't Work
- ❌ Same MCP servers spawned from within Electron process
- ❌ Both `concurrently` and direct Electron launch modes fail
- ❌ Tested with multiple spawn configurations (shell, detached, env vars)
- ❌ Both Content-Length and line-delimited formats fail in Electron context

## Attempted Fixes
1. ❌ Content-Length framing → Line-delimited JSON
2. ❌ npx wrapper → Direct Node.js spawn
3. ❌ .cmd wrappers → Direct dist/index.js paths
4. ❌ process.execPath with ELECTRON_RUN_AS_NODE → Plain `node` command
5. ❌ Environment variable cleanup (NODE_CHANNEL_FD, etc.)
6. ❌ Spawn options variations (shell, detached, windowsHide)
7. ❌ concurrently nested launch → Direct electron launch

## V2 Plan
Consider alternative approaches:
- Use Electron IPC bridge to external Node.js process
- Implement MCP via HTTP transport instead of stdio
- Wait for Electron stdio fixes in future releases
- Use native Node.js child_process.fork() in separate process

## For Now
MCP tab remains in UI but shows "No MCP servers configured". Users can still use all built-in tools and plugins.
