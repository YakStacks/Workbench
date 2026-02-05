# Workbench V2.0 - Quick Reference

Quick reference for the new V2.0 features. For detailed documentation, see [V2_FEATURES_GUIDE.md](./V2_FEATURES_GUIDE.md).

## New Systems at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    WORKBENCH V2.0                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Secrets    │  │   Preview    │  │   Manifest      │   │
│  │  Manager    │  │   Mode       │  │   Registry      │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Memory    │  │    Tool      │  │  Environment    │   │
│  │  Manager    │  │  Dispatcher  │  │   Detector      │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Quick Code Examples

### 🔐 Secrets Management

```typescript
// Store a secret
await window.workbench.secrets.store('api_key', 'secret-value', 'api_key');

// List secrets (metadata only)
const secrets = await window.workbench.secrets.list();

// Get secret value (requires user action)
const secret = await window.workbench.secrets.get('secret-id');

// Redact secrets from logs
const clean = await window.workbench.secrets.redact(logString);
```

### 👁️ Preview Mode

```typescript
// Request preview
const result = await window.workbench.runTool('tool.name', {
  _preview: true,
  ...params
});

if (result.mode === 'preview') {
  // Show preview to user
  const formatted = await window.workbench.preview.format(result.preview);
  // User approves? Execute for real
}
```

### 📋 Tool Manifest

```typescript
// Create manifest
const manifest = {
  name: 'mytool',
  version: '1.0.0',
  author: 'Your Name',
  description: 'Description',
  permissions: {
    filesystem: { actions: ['read'] },
    network: { actions: ['outbound'] }
  },
  stability: 'stable',
  transport: 'plugin',
  usesCredentials: true,
  supportsPreview: true
};

// Register
await window.workbench.manifest.register(manifest);

// Check compatibility
const compat = await window.workbench.manifest.checkCompatibility('mytool');
```

### 🧠 User Memory

```typescript
// Remember preference
await window.workbench.memory.rememberPreference('theme', 'dark');

// Recall preference
const theme = await window.workbench.memory.recallPreference('theme');

// Search memories
const results = await window.workbench.memory.search('github');

// List all
const all = await window.workbench.memory.listAll();

// Forget all
await window.workbench.memory.forgetAll();
```

### 🎯 Natural Language Dispatch

```typescript
// Create dispatch plan from natural language
const plan = await window.workbench.dispatch.createPlan(
  'Create a GitHub issue about the bug'
);

// Plan contains:
// - selectedTool
// - input (inferred parameters)
// - confidence score
// - alternatives

// Format for user confirmation
const formatted = await window.workbench.dispatch.formatPlan(plan);
```

### 🌍 Environment Detection

```typescript
// Get environment info
const env = await window.workbench.environment.getInfo();

// Check if supported
if (!env.supported) {
  const msg = await window.workbench.environment.getUnsupportedMessage(env);
}

// Check for lockdown
const warning = await window.workbench.environment.getLockdownWarning(env);
```

## Plugin Development Template

```javascript
// plugin/index.js
const { ManifestBuilder } = require('../tool-manifest');
const { PreviewBuilder } = require('../dry-run');

module.exports.register = (api) => {
  // 1. Create manifest
  const manifest = new ManifestBuilder()
    .name('category.toolname')
    .version('1.0.0')
    .author('Your Name')
    .description('What this tool does')
    .tags('tag1', 'tag2')
    .permissions({
      filesystem: { actions: ['read'] }
    })
    .stability('stable')
    .transport('plugin')
    .supportsPreview()
    .build();
  
  // 2. Register manifest (if available)
  if (api.registerManifest) {
    api.registerManifest(manifest);
  }
  
  // 3. Register tool
  api.registerTool({
    name: 'category.toolname',
    description: 'What this tool does',
    
    inputSchema: {
      type: 'object',
      properties: {
        param: { type: 'string', description: 'Parameter description' }
      },
      required: ['param']
    },
    
    // Declare permissions
    permissions: {
      filesystem: { actions: ['read'] }
    },
    
    // Uses credentials?
    usesCredentials: false,
    
    // Run function
    run: async (input, context) => {
      // Preview mode?
      if (input._preview) {
        const preview = new PreviewBuilder()
          .fileOperation('read', [input.path])
          .duration('1 second')
          .build('category.toolname', input);
        
        return { mode: 'preview', preview };
      }
      
      // Get secrets if needed
      const apiKey = context?.secrets?.['api_key_name'];
      
      // Execute tool logic
      const result = doSomething(input.param);
      
      // Return standard format
      return {
        content: result,
        metadata: { timestamp: new Date() }
      };
    }
  });
};
```

## Key Concepts

### 🔑 Secret Handles vs Values
- **Handle**: ID/reference to a secret (safe to show in UI)
- **Value**: Actual secret (never shown, only resolved at execution)

### 🎭 Preview vs Execute
- **Preview**: Show what *would* happen (no side effects)
- **Execute**: Actually do it (with side effects)

### 📜 Manifest = Tool Metadata
- Required for ecosystem hygiene
- Enables compatibility checking
- Powers natural language dispatch

### 🧠 Memory = User Context
- Opt-in only (never automatic)
- Explicit "Remember this?" UX
- Full user control (view/edit/delete)

### 🎯 Dispatch = Natural Language → Tool
- Match user intent to tools
- Infer parameters from query
- Confidence-based confirmation

### 🌍 Environment = Platform Compatibility
- Detect supported/unsupported platforms
- Warn about corporate lockdown
- Graceful degradation

## Tool Execution Flow

```
User Input (Natural Language)
         ↓
    [Dispatcher]
    Creates plan
         ↓
   [Permissions]
   Check allowed?
         ↓
     [Preview]  ← (if supported)
   Show what will happen
         ↓
   User Confirms
         ↓
    [Secrets]
   Resolve handles
         ↓
  [Tool Executes]
         ↓
    [Redaction]
   Clean output
         ↓
     [Memory]  ← (if opted in)
  Remember context
         ↓
    User Sees Result
```

## Permission Categories

```typescript
permissions: {
  filesystem: { 
    actions: ['read', 'write', 'delete'] 
  },
  network: { 
    actions: ['localhost', 'outbound'] 
  },
  process: { 
    actions: ['spawn'] 
  }
}
```

## Stability Levels

- `experimental`: May have bugs, breaking changes expected
- `beta`: Mostly stable, minor changes possible
- `stable`: Production-ready, semver guarantees

## Transport Types

- `plugin`: Local JavaScript plugin
- `local`: Local executable
- `http`: HTTP/REST API
- `mcp`: Model Context Protocol

## Memory Categories

- `preference`: User settings (theme, default model, etc.)
- `workflow`: Common tool sequences
- `project`: Project-specific context
- `tool_integration`: Tool-specific configs

## Common Patterns

### Pattern: Safe Tool Execution
```typescript
async function safeExecute(toolName, input) {
  // 1. Check permissions
  const perms = await window.workbench.permissions.check(toolName, 'filesystem', 'write');
  
  if (perms.needsPrompt) {
    const approved = await askUser(`Allow ${toolName} to write files?`);
    if (!approved) return;
    await window.workbench.permissions.grant(toolName, 'filesystem', false);
  }
  
  // 2. Get preview if available
  const preview = await window.workbench.runTool(toolName, { ...input, _preview: true });
  
  if (preview.mode === 'preview') {
    const formatted = await window.workbench.preview.format(preview.preview);
    const approved = await askUser(`\n${formatted}\n\nProceed?`);
    if (!approved) return;
  }
  
  // 3. Execute
  const result = await window.workbench.runTool(toolName, input);
  
  // 4. Redact sensitive data from logs
  const clean = await window.workbench.secrets.redact(JSON.stringify(result));
  console.log(clean);
  
  return result;
}
```

### Pattern: Tool with Secrets
```javascript
module.exports.register = (api) => {
  api.registerTool({
    name: 'api.call',
    usesCredentials: true,
    secretHandles: ['api_key'],
    
    run: async (input, context) => {
      // Get secret from context (resolved at runtime)
      const apiKey = context.secrets['api_key'];
      
      // Use it
      const response = await fetch(input.url, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      return { content: await response.json() };
    }
  });
};
```

### Pattern: Multi-step Preview
```javascript
const preview = new PreviewBuilder()
  .fileOperation('read', ['/path/input.txt'])
  .networkRequest('https://api.example.com/process', {
    method: 'POST',
    payloadSummary: 'Processing input file'
  })
  .fileOperation('write', ['/path/output.txt'], {
    diff: '+ processed content'
  })
  .warning('This will consume API credits')
  .duration('~30 seconds')
  .build('processor.run', input);
```

### Pattern: Memory-Aware Tool
```javascript
run: async (input, context) => {
  // Check for remembered preference
  let model = input.model;
  if (!model) {
    model = await window.workbench.memory.recallPreference('default_model');
  }
  
  // Do work with model
  const result = processWithModel(model, input.prompt);
  
  // Offer to remember
  if (input.rememberModel && input.model) {
    await window.workbench.memory.rememberPreference('default_model', input.model);
  }
  
  return result;
}
```

## Debugging Tips

### Enable Verbose Logging
```typescript
// In main.ts or tool code
console.log('[ToolName]', 'Debug info:', data);
```

### Check Permissions
```typescript
const perms = await window.workbench.permissions.getToolPermissions('tool.name');
console.log('Permissions:', perms);
```

### View Secrets (Metadata Only)
```typescript
const secrets = await window.workbench.secrets.list();
console.log('Secrets:', secrets.map(s => s.handle.name));
```

### Check Environment
```typescript
const env = await window.workbench.environment.getInfo();
console.log('Platform:', env.platform, 'Supported:', env.supported);
console.log('Capabilities:', env.capabilities);
console.log('Risks:', env.risks);
```

## Error Handling

### Permission Denied
```typescript
try {
  await window.workbench.runTool('tool.name', input);
} catch (error) {
  if (error.message.includes('permission denied')) {
    // Prompt user to grant permission
    await window.workbench.permissions.grant('tool.name', 'filesystem', false);
    // Retry
  }
}
```

### Secret Not Found
```typescript
const secrets = await window.workbench.secrets.findByTool('tool.name');
if (secrets.length === 0) {
  // Prompt user to configure secret
  console.log('Please configure API key in Settings → Secrets');
}
```

### Unsupported Environment
```typescript
const env = await window.workbench.environment.getInfo();
if (!env.supported) {
  const msg = await window.workbench.environment.getUnsupportedMessage(env);
  console.warn(msg);
  // Show warning to user but allow continuation
}
```

## Testing Checklist

Before shipping a tool:

- [ ] Manifest created and registered
- [ ] Permissions declared correctly
- [ ] Preview mode implemented (if applicable)
- [ ] Secrets handled via manager (not hardcoded)
- [ ] Error messages are clear
- [ ] Works on all supported platforms
- [ ] Tested in locked-down environment
- [ ] Logs are redacted
- [ ] Documentation added

## Migration Checklist

Upgrading existing tool:

- [ ] Add manifest
- [ ] Declare permissions
- [ ] Move API keys to secrets manager
- [ ] Add preview support (optional)
- [ ] Update error handling
- [ ] Test with new permission system
- [ ] Update documentation

## Resources

- **Full Guide**: [V2_FEATURES_GUIDE.md](./V2_FEATURES_GUIDE.md)
- **Plugin API**: [PLUGIN_API.md](./PLUGIN_API.md)
- **Examples**: `plugins/` directory
- **Source**: `*.ts` files in project root
- **Issues**: GitHub Issues

---

**Need Help?**

1. Check [V2_FEATURES_GUIDE.md](./V2_FEATURES_GUIDE.md) for detailed examples
2. Look at existing plugins in `plugins/` directory
3. Open an issue on GitHub
4. Read the source code (it's well-commented!)
