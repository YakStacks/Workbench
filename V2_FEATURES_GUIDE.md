# Workbench V2.0 - New Features Implementation Guide

This document describes the comprehensive set of new features added to Workbench V2.0, focusing on Trust, Safety, and User Experience.

## Table of Contents

1. [F) Secrets Safety](#f-secrets-safety)
2. [G) Dry Run / Preview Mode](#g-dry-run--preview-mode)
3. [H) Tool Manifest Standard](#h-tool-manifest-standard)
4. [I) User Memory](#i-user-memory)
5. [J) Natural Language Tool Dispatch](#j-natural-language-tool-dispatch)
6. [K) Environment Detection](#k-environment-detection)

---

## F) Secrets Safety

### Overview
Workbench now includes a comprehensive secrets management system that uses OS-level encryption to store credentials securely.

### Features

#### 1. **Local Encrypted Storage**
- Uses OS keychain integration:
  - **Windows**: DPAPI (Data Protection API)
  - **macOS**: Keychain
  - **Linux**: Secret Service API
- Secrets are never stored in plain text
- Each secret gets a unique handle/ID

#### 2. **Automatic Secret Redaction**
- Built-in patterns for common secret formats:
  - API keys
  - Bearer tokens
  - AWS credentials
  - GitHub tokens
  - Password fields in JSON/query strings
- Redacts secrets from logs automatically
- Custom redaction rules can be added

#### 3. **Secrets as Handles**
- Tools receive secret handles, not actual values
- Secrets are resolved only at execution time
- UI never displays raw secret values (requires explicit reveal action)

#### 4. **Tool Credential Indicators**
- Tool manifests declare `usesCredentials: true`
- UI shows badge/warning for credential-using tools
- Users can see which tools use which secrets

### Usage Examples

#### Storing a Secret (UI)
```typescript
const result = await window.workbench.secrets.store(
  'github_api_key',           // Name
  'ghp_xxxxxxxxxxxxxxxxxxxx', // Value (will be encrypted)
  'api_key',                  // Type
  ['github', 'api']           // Tags (optional)
);
// Returns: { success: true, handle: { id: 'uuid...', name: 'github_api_key', ... } }
```

#### Listing Secrets (Metadata Only)
```typescript
const secrets = await window.workbench.secrets.list();
// Returns array of metadata (NO VALUES):
// [
//   {
//     handle: { id: 'uuid', name: 'github_api_key', type: 'api_key', ... },
//     usageCount: 5,
//     lastUsed: Date
//   }
// ]
```

#### Revealing a Secret (Requires Explicit User Action)
```typescript
const result = await window.workbench.secrets.get('secret-uuid');
if (result.success) {
  console.log(result.secret.value); // Only shown when user explicitly requests
}
```

#### Redacting Secrets from Logs
```typescript
const logMessage = "Using API key: ghp_xxxxxxxxxxxxxxxxxxxx";
const redacted = await window.workbench.secrets.redact(logMessage);
// Result: "Using API key: [REDACTED_GITHUB_TOKEN]"
```

#### Tool Integration (Plugin Side)
```javascript
// In plugin code:
module.exports.register = (api) => {
  api.registerTool({
    name: 'github.createIssue',
    description: 'Create a GitHub issue',
    usesCredentials: true,  // ← Declares that this tool uses secrets
    secretHandles: ['github_api_key'], // ← Which secrets it needs
    
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string' },
        title: { type: 'string' },
        // No 'apiKey' field - handled via secrets
      }
    },
    
    run: async (input, context) => {
      // Get secret handle from context (injected by runtime)
      const apiKey = context.secrets['github_api_key'];
      
      // Use the secret
      const response = await fetch('https://api.github.com/repos/...', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      return { success: true };
    }
  });
};
```

### Security Best Practices

1. **Never log raw secrets**: Always use redaction before logging
2. **Minimize secret lifetime**: Resolve secrets only when needed
3. **Use specific permissions**: Declare which secrets your tool needs
4. **No secrets in UI state**: Never store secrets in React state or localStorage

---

## G) Dry Run / Preview Mode

### Overview
Tools can now provide execution previews before running, showing users what will happen without actually performing actions.

### Features

#### 1. **Preview Plans**
Tools can return structured preview data showing:
- **File operations**: Which files will be created/modified/deleted, with diffs
- **Network requests**: URLs, methods, payload summaries
- **Process execution**: Commands that will be executed
- **General actions**: Any other planned operations

#### 2. **Preview → Confirm → Execute Flow**
Users can:
1. Request a preview
2. Review what will happen
3. Approve or reject
4. Execute if approved

#### 3. **Preview History**
All previews are saved with:
- Timestamp
- Inputs
- Planned steps
- Approval status
- Execution results (if executed)

### Usage Examples

#### Creating a Preview (Tool Implementation)
```javascript
const { PreviewBuilder } = require('./dry-run');

module.exports.register = (api) => {
  api.registerTool({
    name: 'file.bulkRename',
    description: 'Rename multiple files',
    supportsPreview: true, // ← Declares preview support
    
    run: async (input, context) => {
      // Check if preview mode
      if (input._preview) {
        const preview = new PreviewBuilder()
          .fileOperation('move', input.files.map(f => f.oldPath))
          .warning('This operation cannot be undone')
          .duration('~2 seconds')
          .build('file.bulkRename', input);
        
        return { mode: 'preview', preview };
      }
      
      // Actual execution
      input.files.forEach(f => {
        fs.renameSync(f.oldPath, f.newPath);
      });
      
      return { mode: 'execute', result: { renamed: input.files.length } };
    }
  });
};
```

#### Requesting a Preview (UI)
```typescript
// Request preview
const result = await window.workbench.runTool('file.bulkRename', {
  _preview: true, // ← Request preview mode
  files: [...],
});

if (result.mode === 'preview') {
  // Display preview to user
  const formatted = await window.workbench.preview.format(result.preview);
  console.log(formatted);
  
  // User approves? Execute for real
  if (userApproved) {
    const execResult = await window.workbench.runTool('file.bulkRename', {
      _preview: false,
      files: [...],
    });
  }
}
```

#### Preview Format Example
```
**Preview: file.bulkRename**

⏱️ Estimated duration: ~2 seconds

**⚠️ Warnings:**
- This operation cannot be undone

**Steps:**
1. 📁 MOVE: /path/file1.txt, /path/file2.txt
2. 📁 WRITE: /path/manifest.json
   Diff:
   + "renamed": ["file1_new.txt", "file2_new.txt"]
```

### Tool Types Supporting Preview

- **File operations**: Show diffs, paths affected
- **Network requests**: Show endpoints, methods, payload summaries (not full payloads if sensitive)
- **Process execution**: Show commands to be run
- **Database operations**: Show SQL queries, affected rows
- **Multi-step workflows**: Show entire pipeline

---

## H) Tool Manifest Standard

### Overview
A standardized metadata schema for all tools, enabling better discoverability, compatibility checking, and ecosystem hygiene.

### Manifest Schema

```typescript
interface ToolManifest {
  // Basic info
  name: string;                   // 'category.toolName'
  version: string;                // Semver: '1.0.0'
  author: string | {              // Author info
    name: string;
    email?: string;
    url?: string;
  };
  description: string;            // Brief description
  tags?: string[];                // ['api', 'github', 'automation']

  // Permissions (required)
  permissions: ToolPermissions;   // Declarative permissions

  // System requirements
  supportedOS?: ('win32' | 'darwin' | 'linux')[];
  supportedArch?: ('x64' | 'arm64')[];
  requiredDependencies?: string[]; // ['node >= 16', 'python >= 3.8']

  // Stability
  stability: 'experimental' | 'beta' | 'stable';

  // Transport
  transport: 'local' | 'http' | 'mcp' | 'plugin';
  entrypoint?: string;            // File path for local tools

  // Capabilities
  icon?: string;                  // Emoji or icon identifier
  usesCredentials?: boolean;      // Does this tool use secrets?
  secretHandles?: string[];       // Which secrets does it need?
  supportsPreview?: boolean;      // Can this tool do dry-run?
  isIdempotent?: boolean;         // Safe to run multiple times?

  // Links
  homepage?: string;
  repository?: string;
  license?: string;
}
```

### Usage Examples

#### Creating a Manifest (Fluent Builder)
```typescript
import { ManifestBuilder } from './tool-manifest';

const manifest = new ManifestBuilder()
  .name('github.createIssue')
  .version('1.0.0')
  .author({ name: 'John Doe', email: 'john@example.com' })
  .description('Create GitHub issues via API')
  .tags('github', 'api', 'issues')
  .permissions({
    network: { actions: ['outbound'] }
  })
  .stability('stable')
  .transport('plugin')
  .usesCredentials(['github_api_key'])
  .supportsPreview()
  .supportedOS('win32', 'darwin', 'linux')
  .build();

// Register manifest
await window.workbench.manifest.register(manifest);
```

#### Checking Compatibility
```typescript
const compat = await window.workbench.manifest.checkCompatibility('github.createIssue');

if (!compat.compatible) {
  console.error('Tool not compatible!');
  compat.errors.forEach(err => console.error(err));
} else if (compat.warnings.length > 0) {
  console.warn('Warnings:');
  compat.warnings.forEach(w => console.warn(w));
}
```

#### Getting Tool Info
```typescript
const info = await window.workbench.manifest.getToolInfo('github.createIssue');
console.log(info);
// Output:
// **github.createIssue** v1.0.0
// By John Doe
//
// Create GitHub issues via API
//
// **Tags:** github, api, issues
// **Stability:** stable
// **Transport:** plugin
// **⚠️ Uses Credentials**
// **✓ Supports Preview Mode**
```

### Manifest Validation

The system automatically validates manifests and provides clear error messages:
```typescript
const result = await window.workbench.manifest.register(invalidManifest);
if (!result.success) {
  result.errors.forEach(err => console.error(err));
  // Output:
  // - Missing required field: version
  // - Invalid stability: production (expected: experimental, beta, stable)
}
```

---

## I) User Memory

### Overview
An opt-in learning system that allows Workbench to remember user preferences, workflows, and context across sessions.

### Features

#### 1. **Explicit "Remember This?" UX**
- No automatic memory
- User must approve each memory
- Clear indication when memories are being used

#### 2. **Memory Categories**
- **Preferences**: User settings, UI preferences
- **Workflows**: Commonly used tool sequences
- **Projects**: Project-specific context
- **Tool Integrations**: Tool-specific configurations

#### 3. **Memory Management Panel**
Users can:
- List all memories
- Edit/update memories
- Delete individual memories
- Clear all memories

#### 4. **Usage Tracking**
- "Used in this response" indicator shows which memories influenced AI output
- Usage statistics (how often each memory is recalled)

### Usage Examples

#### Remembering a Preference
```typescript
// User sets a preference via UI
await window.workbench.memory.rememberPreference('default_model', 'gpt-4');

// Later, recall it
const model = await window.workbench.memory.recallPreference('default_model');
// Returns: 'gpt-4'
```

#### Remembering a Workflow
```typescript
// User performs a common sequence
const workflow = [
  { tool: 'github.listIssues', input: { repo: 'myrepo' } },
  { tool: 'github.createComment', input: { issue: 1 } }
];

await window.workbench.memory.remember(
  'workflow',
  'daily_standup_report',
  workflow,
  { tags: ['github', 'daily'], userProvided: true }
);

// Later, recall it
const recalled = await window.workbench.memory.recall('workflow', 'daily_standup_report');
// Returns: Memory object with value = workflow array
```

#### Memory Search
```typescript
const results = await window.workbench.memory.search('github');
// Returns all memories related to GitHub
```

#### Memory Statistics
```typescript
const stats = await window.workbench.memory.getStats();
// Returns:
// {
//   total: 42,
//   byCategory: { preference: 15, workflow: 10, project: 12, tool_integration: 5 },
//   userProvided: 30,
//   aiLearned: 12
// }
```

#### Listing Memories
```typescript
const allMemories = await window.workbench.memory.listAll();
// Returns array of Memory objects

const preferences = await window.workbench.memory.listByCategory('preference');
// Returns only preference memories

const mostUsed = await window.workbench.memory.getMostUsed(10);
// Returns top 10 most frequently used memories
```

#### Forgetting
```typescript
// Forget a specific memory
await window.workbench.memory.forget('memory-id');

// Forget ALL memories
await window.workbench.memory.forgetAll();
```

### Privacy & Safety

1. **No sensitive data**: System automatically avoids storing sensitive information
2. **No secrets in memory**: Secrets are stored in the separate secrets system
3. **User control**: All memories can be viewed, edited, or deleted
4. **Explicit opt-in**: Memory system can be disabled entirely
5. **Transparent usage**: UI shows which memories influenced each response

---

## J) Natural Language Tool Dispatch

### Overview
AI-powered tool selection and parameter inference from natural language queries.

### Features

#### 1. **Natural Language → Tool Selection**
Users can describe what they want in plain English, and the system suggests appropriate tools.

#### 2. **Confidence Scoring**
Each tool suggestion includes a confidence score (0-1) based on:
- Name matches
- Description relevance
- Tag matches
- Keyword overlap

#### 3. **Parameter Inference**
The system attempts to extract parameters from the natural language query:
- Quoted strings → query parameters
- File paths → path parameters
- URLs → url parameters
- Numbers → numeric parameters

#### 4. **Confirmation Flow**
- Shows proposed tool + parameters
- Displays confidence level
- Lists alternative tools
- Requires user approval before execution (unless confidence is very high and tool is safe)

#### 5. **Tool Suggestions**
Even when not explicitly asked, the system can suggest relevant tools based on conversation context.

### Usage Examples

#### Creating a Dispatch Plan
```typescript
const plan = await window.workbench.dispatch.createPlan(
  'Find all issues in my-repo that mention "bug"',
  context // Optional: current conversation context
);

// Returns:
// {
//   selectedTool: { name: 'github.searchIssues', ... },
//   input: { repo: 'my-repo', query: 'bug' },
//   confidence: 0.85,
//   reasoning: 'Tool name contains "issues"; description matches query',
//   alternatives: [
//     { tool: { name: 'github.listIssues' }, confidence: 0.60, ... }
//   ],
//   requiresConfirmation: false
// }
```

#### Formatting for User Confirmation
```typescript
const formatted = await window.workbench.dispatch.formatPlan(plan);
console.log(formatted);

// Output:
// **Tool Dispatch Plan**
//
// **Selected:** github.searchIssues
// **Confidence:** 85%
// **Reasoning:** Tool name contains "issues"; description matches query
//
// **Parameters:**
// {
//   "repo": "my-repo",
//   "query": "bug"
// }
//
// **Alternative tools:**
// - github.listIssues (60%): Description match
```

#### Getting Tool Suggestions
```typescript
const suggestions = await window.workbench.dispatch.suggest(
  'I need to check the weather and then send a notification',
  3 // Limit to top 3 suggestions
);

// Returns:
// [
//   { tool: { name: 'weather.current' }, confidence: 0.75, ... },
//   { tool: { name: 'notification.send' }, confidence: 0.70, ... }
// ]
```

### Integration with Permission System

The dispatcher automatically checks:
- If tool is destructive → requires confirmation
- If tool uses credentials → requires confirmation
- If tool is experimental/beta → requires confirmation
- If confidence < 70% → requires confirmation

---

## K) Environment Detection

### Overview
Comprehensive system environment detection with clear messaging for supported/unsupported platforms and corporate lockdown scenarios.

### Features

#### 1. **Supported Platforms**
- **Supported**: Windows (x64), macOS (x64/arm64), Linux (x64)
- Clear messaging for unsupported configurations

#### 2. **Capability Detection**
Checks for:
- Secure storage availability
- Internet access
- Process execution capability
- Filesystem write access

#### 3. **Lockdown Detection**
Detects corporate/restrictive environments:
- Network restrictions
- PowerShell execution policies
- Filesystem permissions
- Process execution limitations

#### 4. **Environment Risks**
Categorizes issues:
- **Info**: Non-critical informational messages
- **Warning**: May affect some features
- **Error**: Critical compatibility issues

### Usage Examples

#### Getting Environment Info
```typescript
const envInfo = await window.workbench.environment.getInfo();

// Returns:
// {
//   platform: 'win32',
//   arch: 'x64',
//   osVersion: '10.0.19044',
//   nodeVersion: 'v18.0.0',
//   electronVersion: '29.0.0',
//   totalMemory: 17179869184,
//   freeMemory: 8589934592,
//   cpuCores: 8,
//   supported: true,
//   risks: [],
//   capabilities: [
//     { name: 'Secure Storage', available: true, reason: 'OS-level encryption available' },
//     { name: 'Network Access', available: true, reason: 'Internet accessible' },
//     { name: 'Process Execution', available: true, reason: 'Can spawn child processes' }
//   ]
// }
```

#### Displaying Environment Info
```typescript
const formatted = await window.workbench.environment.format(envInfo);
console.log(formatted);

// Output:
// **Environment Information**
//
// **System:**
// - Platform: win32
// - Architecture: x64
// - OS Version: 10.0.19044
// - Node: v18.0.0
// - Electron: 29.0.0
//
// **Resources:**
// - CPU Cores: 8
// - Total Memory: 16.00 GB
// - Free Memory: 8.00 GB
//
// **Status:** ✅ Supported
//
// **Capabilities:**
// ✅ Secure Storage - OS-level encryption available
// ✅ Network Access - Internet accessible
// ✅ Process Execution - Can spawn child processes
```

#### Handling Unsupported Environment
```typescript
if (!envInfo.supported) {
  const message = await window.workbench.environment.getUnsupportedMessage(envInfo);
  console.log(message);
  
  // Output:
  // **⚠️ Unsupported Environment Detected**
  //
  // Workbench may not function properly on this system.
  //
  // **Issues:**
  // - Platform arm is not officially supported
  //   Use Windows, macOS, or Linux
  //
  // **Supported Platforms:** Windows (x64), macOS (x64/arm64), Linux (x64)
  //
  // You can continue, but some features may not work as expected.
}
```

#### Detecting Corporate Lockdown
```typescript
const lockdownWarning = await window.workbench.environment.getLockdownWarning(envInfo);

if (lockdownWarning) {
  console.log(lockdownWarning);
  
  // Output:
  // **🔒 Corporate Environment Detected**
  //
  // Some restrictions have been detected on this system:
  //
  // - Limited or no internet access detected
  // - PowerShell execution policy is restrictive: Restricted
  //
  // These restrictions may limit certain features. Check with your IT
  // department if you need additional access.
}
```

#### Integration with Doctor
The environment detection is automatically integrated with the Doctor system:
```typescript
const report = await window.workbench.doctor.run();

// Doctor report now includes:
// - Environment compatibility check
// - Capability assessment
// - Lockdown detection
// - Recommended actions
```

---

## Integration Guide

### How These Features Work Together

1. **Tool Registration Flow**:
   ```
   Plugin loads → Manifest registered → Permissions declared → 
   Secrets linked → Added to dispatch registry
   ```

2. **Tool Execution Flow**:
   ```
   Natural language query → Dispatch plan created → 
   Permissions checked → Preview generated (if supported) → 
   User confirms → Secrets resolved → Tool executes → 
   Results logged (with redaction) → Memory updated (if opted in)
   ```

3. **Startup Flow**:
   ```
   App starts → Environment detection → Capabilities check → 
   Show warnings if needed → Load memories → Load secrets → 
   Register tools → Ready
   ```

### Best Practices

1. **Tool Development**:
   - Always provide a manifest
   - Declare all permissions explicitly
   - Support preview mode when possible
   - Use secrets manager for credentials
   - Provide clear error messages

2. **Security**:
   - Never log raw secrets
   - Use redaction for all output
   - Minimize secret lifetime
   - Check permissions before execution

3. **UX**:
   - Show previews before destructive operations
   - Provide clear confirmation dialogs
   - Use dispatch for natural language interfaces
   - Let users control memory

4. **Compatibility**:
   - Test on all supported platforms
   - Declare required dependencies
   - Handle graceful degradation
   - Provide fallbacks for locked-down environments

---

## Migration Guide

### For Existing Plugins

1. **Add Manifest**:
   ```javascript
   // Before: just register tool
   api.registerTool({ name: 'mytool', ... });
   
   // After: register tool + manifest
   const manifest = {
     name: 'mytool',
     version: '1.0.0',
     author: 'Your Name',
     description: 'Tool description',
     permissions: { /* declare permissions */ },
     stability: 'stable',
     transport: 'plugin'
   };
   api.registerManifest(manifest);
   api.registerTool({ name: 'mytool', ... });
   ```

2. **Declare Permissions**:
   ```javascript
   permissions: {
     filesystem: { actions: ['read', 'write'] },
     network: { actions: ['outbound'] }
   }
   ```

3. **Add Preview Support** (optional but recommended):
   ```javascript
   run: async (input, context) => {
     if (input._preview) {
       return createPreview(input);
     }
     return executeActual(input);
   }
   ```

4. **Use Secrets Manager**:
   ```javascript
   // Before: API key in input
   run: async (input) => {
     const apiKey = input.apiKey;
     ...
   }
   
   // After: API key from secrets
   run: async (input, context) => {
     const apiKey = context.secrets['api_key_name'];
     ...
   }
   ```

---

## API Reference

See the individual TypeScript files for detailed API documentation:
- `secrets-manager.ts` - Secrets Management API
- `tool-manifest.ts` - Manifest Schema & Registry
- `dry-run.ts` - Preview/Dry-Run API
- `memory-manager.ts` - User Memory API
- `tool-dispatch.ts` - Natural Language Dispatch API
- `environment-detection.ts` - Environment Detection API

---

## Testing

Each system includes example usage. To test:

1. **Build**: `npm run build`
2. **Run**: `npm start`
3. **Test features via UI**: All features are accessible through `window.workbench.*` API

---

## Future Enhancements

Potential future additions:
- Remote secret storage (cloud sync)
- AI-powered preview generation
- Manifest marketplace/discovery
- Memory export/import
- Advanced dispatch with LLM integration
- Environment auto-configuration

---

## Support

For issues or questions:
- GitHub Issues: [Workbench Repository](https://github.com/YakStacks/Workbench)
- Documentation: See individual feature files
- Examples: Check `plugins/` directory for sample implementations
