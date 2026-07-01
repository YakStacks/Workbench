# Workbench V1 → V2 Migration Guide

This guide helps you migrate existing Workbench plugins and integrations from V1 to V2.

## Overview of Changes

V2.0 introduces new systems that improve security, user experience, and ecosystem health. Most V1 plugins will continue to work, but you should update them to take advantage of new features.

## Backward Compatibility

✅ **What Still Works**:
- Basic tool registration
- Standard tool response format
- Input schemas
- Existing IPC handlers

⚠️ **What Needs Updates**:
- Tools that use API keys/credentials → should use secrets manager
- Tools with destructive operations → should add preview support
- All tools → should add manifest

## Step-by-Step Migration

### 1. Add a Tool Manifest

**Before (V1)**:
```javascript
module.exports.register = (api) => {
  api.registerTool({
    name: 'github.createIssue',
    description: 'Create a GitHub issue',
    inputSchema: { ... },
    run: async (input) => { ... }
  });
};
```

**After (V2)**:
```javascript
module.exports.register = (api) => {
  // Add manifest
  const manifest = {
    name: 'github.createIssue',
    version: '1.0.0',
    author: 'Your Name',
    description: 'Create a GitHub issue via API',
    permissions: {
      network: { actions: ['outbound'] }
    },
    stability: 'stable',
    transport: 'plugin',
    usesCredentials: true,
    tags: ['github', 'api', 'issues']
  };
  
  if (api.registerManifest) {
    api.registerManifest(manifest);
  }
  
  // Register tool (same as before)
  api.registerTool({
    name: 'github.createIssue',
    description: 'Create a GitHub issue',
    permissions: manifest.permissions, // Add this
    usesCredentials: true, // Add this
    inputSchema: { ... },
    run: async (input) => { ... }
  });
};
```

### 2. Declare Permissions

All tools must declare their permissions explicitly.

**Common Patterns**:

```javascript
// File operations
permissions: {
  filesystem: { actions: ['read', 'write'] }
}

// Network requests
permissions: {
  network: { actions: ['outbound'] }
}

// Execute commands
permissions: {
  process: { actions: ['spawn'] }
}

// Multiple categories
permissions: {
  filesystem: { actions: ['read'] },
  network: { actions: ['outbound'] }
}
```

### 3. Migrate API Keys to Secrets Manager

**Before (V1)** - API key in input:
```javascript
api.registerTool({
  name: 'weather.current',
  inputSchema: {
    type: 'object',
    properties: {
      location: { type: 'string' },
      apiKey: { type: 'string' } // ← BAD: API key exposed
    },
    required: ['location', 'apiKey']
  },
  run: async (input) => {
    const response = await fetch(`https://api.weather.com?key=${input.apiKey}`);
    return { content: await response.text() };
  }
});
```

**After (V2)** - API key from secrets:
```javascript
api.registerTool({
  name: 'weather.current',
  usesCredentials: true,
  secretHandles: ['weather_api_key'],
  inputSchema: {
    type: 'object',
    properties: {
      location: { type: 'string' }
      // No apiKey field!
    },
    required: ['location']
  },
  run: async (input, context) => {
    // Get API key from context (resolved at runtime)
    const apiKey = context.secrets['weather_api_key'];
    
    const response = await fetch(`https://api.weather.com?key=${apiKey}`);
    return { content: await response.text() };
  }
});
```

**User Experience**:
1. User goes to Settings → Secrets
2. Adds "weather_api_key" with their actual key
3. Tool receives resolved key at runtime
4. Key is never logged or shown in UI

### 4. Add Preview Support (Recommended)

For any tool that modifies data, add preview mode.

**Before (V1)**:
```javascript
run: async (input) => {
  // Just do it
  fs.unlinkSync(input.path);
  return { content: 'File deleted' };
}
```

**After (V2)** - with preview:
```javascript
run: async (input, context) => {
  // Check if preview mode
  if (input._preview) {
    const { PreviewBuilder } = require('../dry-run');
    
    const preview = new PreviewBuilder()
      .fileOperation('delete', [input.path])
      .warning('This operation cannot be undone')
      .build('file.delete', input);
    
    return { mode: 'preview', preview };
  }
  
  // Actual execution
  fs.unlinkSync(input.path);
  return { content: 'File deleted' };
}
```

### 5. Update Error Handling

**Before (V1)**:
```javascript
run: async (input) => {
  try {
    const result = await doSomething(input);
    return result;
  } catch (error) {
    throw error; // ← May expose sensitive data
  }
}
```

**After (V2)** - with redaction:
```javascript
run: async (input, context) => {
  try {
    const result = await doSomething(input);
    return result;
  } catch (error) {
    // Use secrets manager to redact any sensitive data
    const cleanMessage = await context.redact(error.message);
    
    return {
      content: `Error: ${cleanMessage}`,
      error: cleanMessage
    };
  }
}
```

### 6. Use Standard Response Format

V2 enforces the standard response format more strictly.

**Correct (V1 & V2)**:
```javascript
return {
  content: "Operation completed",
  metadata: { filesProcessed: 5 }
};
```

**Still Works (auto-normalized in V2)**:
```javascript
return "Simple string"; // Auto-wrapped in { content: "..." }
```

**Incorrect**:
```javascript
return { success: true, data: "..." }; // No 'content' field
// V2 will auto-normalize, but better to use correct format
```

## Common Migration Patterns

### Pattern 1: File Tool with Preview

```javascript
module.exports.register = (api) => {
  const manifest = {
    name: 'file.bulkRename',
    version: '1.0.0',
    author: 'Your Name',
    description: 'Rename multiple files at once',
    permissions: {
      filesystem: { actions: ['read', 'write'] }
    },
    stability: 'stable',
    transport: 'plugin',
    supportsPreview: true
  };
  
  if (api.registerManifest) api.registerManifest(manifest);
  
  api.registerTool({
    name: 'file.bulkRename',
    description: 'Rename multiple files at once',
    permissions: manifest.permissions,
    supportsPreview: true,
    
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              oldPath: { type: 'string' },
              newPath: { type: 'string' }
            }
          }
        }
      },
      required: ['files']
    },
    
    run: async (input, context) => {
      const { PreviewBuilder } = require('../dry-run');
      const fs = require('fs');
      
      // Preview mode
      if (input._preview) {
        const preview = new PreviewBuilder();
        
        input.files.forEach(f => {
          preview.fileOperation('move', [f.oldPath, f.newPath]);
        });
        
        preview
          .warning('This operation cannot be undone')
          .duration(`~${input.files.length} seconds`);
        
        return {
          mode: 'preview',
          preview: preview.build('file.bulkRename', input)
        };
      }
      
      // Execute
      const results = [];
      for (const file of input.files) {
        try {
          fs.renameSync(file.oldPath, file.newPath);
          results.push({ path: file.newPath, success: true });
        } catch (error) {
          results.push({ path: file.oldPath, success: false, error: error.message });
        }
      }
      
      return {
        content: `Renamed ${results.filter(r => r.success).length} of ${results.length} files`,
        metadata: { results }
      };
    }
  });
};
```

### Pattern 2: API Tool with Secrets

```javascript
module.exports.register = (api) => {
  const manifest = {
    name: 'api.sendEmail',
    version: '1.0.0',
    author: 'Your Name',
    description: 'Send email via API',
    permissions: {
      network: { actions: ['outbound'] }
    },
    stability: 'stable',
    transport: 'plugin',
    usesCredentials: true,
    secretHandles: ['email_api_key']
  };
  
  if (api.registerManifest) api.registerManifest(manifest);
  
  api.registerTool({
    name: 'api.sendEmail',
    description: 'Send email via API',
    permissions: manifest.permissions,
    usesCredentials: true,
    secretHandles: ['email_api_key'],
    
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' }
      },
      required: ['to', 'subject', 'body']
    },
    
    run: async (input, context) => {
      // Get API key from secrets
      const apiKey = context.secrets['email_api_key'];
      
      if (!apiKey) {
        return {
          content: 'Email API key not configured. Please add it in Settings → Secrets.',
          error: 'Missing credential'
        };
      }
      
      try {
        const response = await fetch('https://api.emailservice.com/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: input.to,
            subject: input.subject,
            body: input.body
          })
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        return {
          content: `Email sent to ${input.to}`,
          metadata: { messageId: (await response.json()).id }
        };
      } catch (error) {
        // Redact any sensitive data
        const clean = await context.redact(error.message);
        
        return {
          content: `Failed to send email: ${clean}`,
          error: clean
        };
      }
    }
  });
};
```

### Pattern 3: Process Execution Tool

```javascript
module.exports.register = (api) => {
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);
  
  const manifest = {
    name: 'system.runCommand',
    version: '1.0.0',
    author: 'Your Name',
    description: 'Execute system command',
    permissions: {
      process: { actions: ['spawn'] }
    },
    stability: 'beta',
    transport: 'plugin',
    supportsPreview: true
  };
  
  if (api.registerManifest) api.registerManifest(manifest);
  
  api.registerTool({
    name: 'system.runCommand',
    description: 'Execute system command',
    permissions: manifest.permissions,
    supportsPreview: true,
    
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' }
      },
      required: ['command']
    },
    
    run: async (input, context) => {
      const { PreviewBuilder } = require('../dry-run');
      
      // Preview mode
      if (input._preview) {
        const preview = new PreviewBuilder()
          .processExecution(input.command, {
            summary: `Execute: ${input.command}`
          })
          .warning('Command execution can be dangerous')
          .build('system.runCommand', input);
        
        return { mode: 'preview', preview };
      }
      
      // Execute
      try {
        const { stdout, stderr } = await execAsync(input.command, {
          timeout: 30000 // 30 second timeout
        });
        
        return {
          content: stdout || stderr || 'Command completed',
          metadata: {
            command: input.command,
            exitCode: 0
          }
        };
      } catch (error) {
        return {
          content: `Command failed: ${error.message}`,
          error: error.message,
          metadata: {
            command: input.command,
            exitCode: error.code || 1
          }
        };
      }
    }
  });
};
```

## Testing Your Migration

### 1. Test Permissions
```javascript
// In browser console:
const perms = await window.workbench.permissions.getToolPermissions('your.tool');
console.log('Permissions:', perms);
```

### 2. Test Manifest
```javascript
const manifest = await window.workbench.manifest.get('your.tool');
console.log('Manifest:', manifest);

const compat = await window.workbench.manifest.checkCompatibility('your.tool');
console.log('Compatible:', compat.compatible);
console.log('Warnings:', compat.warnings);
```

### 3. Test Preview Mode
```javascript
const preview = await window.workbench.runTool('your.tool', {
  _preview: true,
  ...params
});
console.log('Preview:', preview);
```

### 4. Test with Secrets
1. Add a test secret: Settings → Secrets → Add Secret
2. Run your tool
3. Verify it receives the secret via context

## Breaking Changes

### Removed/Deprecated

- ❌ **Direct API key inputs**: Migrate to secrets manager
- ❌ **Unstructured tool responses**: Use standard format
- ⚠️ **Tools without permissions**: Will work but show warnings

### New Requirements

- ✅ **Manifest**: Strongly recommended (will be required in V2.1)
- ✅ **Permissions**: Required for new tools
- ✅ **Secrets for credentials**: Required for tools using API keys

## Troubleshooting

### "Permission denied" errors
→ Add permission declarations to your tool

### "Secret not found" errors
→ User needs to configure secret in Settings → Secrets

### Preview not showing
→ Ensure `supportsPreview: true` in manifest and check `input._preview`

### Tool not appearing in dispatch
→ Add manifest with good description and tags

## Migration Checklist

For each tool:

- [ ] Add manifest with all required fields
- [ ] Declare permissions
- [ ] Move API keys to secrets manager
- [ ] Add preview support (if tool is destructive)
- [ ] Update error handling with redaction
- [ ] Test on all supported platforms
- [ ] Update documentation

## Need Help?

1. **Full Guide**: [V2_FEATURES_GUIDE.md](./V2_FEATURES_GUIDE.md)
2. **Quick Reference**: [V2_QUICK_REFERENCE.md](./V2_QUICK_REFERENCE.md)
3. **Examples**: Check `plugins/` directory
4. **Issues**: GitHub Issues

## Timeline

- **V2.0 (Current)**: Manifest and permissions recommended
- **V2.1 (Future)**: Manifest required for all tools
- **V3.0 (Future)**: Legacy formats deprecated

Migration is gradual - take your time!
