# Workbench Plugin API

## Standard Tool Response Format

All tools in Workbench **MUST** return responses in this standardized format:

```typescript
interface ToolResponse {
  content: string | Array<{ type: string; text: string }>;
  metadata?: Record<string, any>;
  error?: string;
}
```

### Fields

- **`content`** (required): The main result of the tool
  - Can be a plain string
  - Or an array of content blocks (MCP-style): `[{ type: "text", text: "..." }]`
  
- **`metadata`** (optional): Additional data about the result
  - Use for structured data, statistics, or context
  - Will be available in the tool output but not displayed as main content
  
- **`error`** (optional): Error message if something went wrong
  - Tool should still return an object even on error
  - The `content` field should contain a user-friendly error message
  - The `error` field can contain the technical error details

### Examples

#### Simple text response:
```javascript
return {
  content: "The temperature is 72°F"
};
```

#### Structured response with metadata:
```javascript
return {
  content: "Current temperature in Mount Sterling: 29°F (-2°C) - Overcast",
  metadata: {
    temperature: 29,
    feelsLike: 19,
    humidity: 61,
    windSpeed: 12
  }
};
```

#### Error response:
```javascript
return {
  content: "Could not fetch temperature for InvalidCity",
  error: "City not found",
  metadata: { attempted: "InvalidCity" }
};
```

#### Multiple content blocks:
```javascript
return {
  content: [
    { type: "text", text: "Weather Report:" },
    { type: "text", text: "Temperature: 72°F" },
    { type: "text", text: "Humidity: 65%" }
  ]
};
```

## Auto-Normalization

Workbench automatically normalizes tool outputs that don't follow the standard:

- **Plain strings** → Wrapped in `{ content: string }`
- **Objects with `error` field** → Converted to error response
- **Any other object** → JSON stringified into `content` with object in `metadata`

However, **it's best practice to return the correct format** rather than relying on auto-normalization.

## Plugin Structure

```javascript
module.exports.register = (api) => {
  api.registerTool({
    name: 'category.toolName',
    description: 'Brief description of what this tool does',
    inputSchema: {
      type: 'object',
      properties: {
        param: { type: 'string', description: 'Parameter description' }
      },
      required: ['param']
    },
    run: async (input) => {
      try {
        // Your tool logic here
        const result = doSomething(input.param);
        
        // Return standardized format
        return {
          content: result,
          metadata: {
            processedAt: new Date().toISOString()
          }
        };
      } catch (error) {
        // Return error in standardized format
        return {
          content: `Failed to process: ${error.message}`,
          error: error.message,
          metadata: { input }
        };
      }
    }
  });
};
```

## Plugin File Structure

Each plugin should live in its own folder under `plugins/`:

```
plugins/
  your_plugin_name/
    index.js          # Main plugin code
    package.json      # Must contain: { "type": "commonjs" }
```

The `package.json` is required and must specify `"type": "commonjs"` for the plugin to load correctly.

## Minimal "Hello World" Plugin

Create `plugins/hello_world/index.js`:

```javascript
module.exports.register = (api) => {
  api.registerTool({
    name: 'example.helloWorld',
    description: 'A simple hello world tool',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Your name' }
      },
      required: ['name']
    },
    run: async (input) => {
      return {
        content: `Hello, ${input.name}! Welcome to Workbench.`
      };
    }
  });
};
```

Create `plugins/hello_world/package.json`:

```json
{
  "type": "commonjs"
}
```

Then restart Workbench to load your plugin!

## Tool Naming Convention

Tools are namespaced by category prefix:
- `builtin.*` - Built-in system tools (reserved)
- `mcp.*` - MCP server tools (reserved)
- `example.*` - Example/demo tools
- `weather.*` - Weather tools
- `web.*` - Web/internet tools
- `system.*` - System utilities
- Your custom categories

Choose a meaningful prefix for your tools.

## Plugin Loading

Plugins are loaded automatically from the `plugins/` directory at startup. To reload plugins without restarting:
1. Go to the **Tools** tab
2. Click the **Refresh** button

Or ask the AI to reload tools from the Chat tab.

## Best Practices

1. **Always return the standard format** - Don't rely on auto-normalization
2. **Handle errors gracefully** - Catch exceptions and return friendly error messages
3. **Use meaningful tool names** - Follow the `category.toolName` convention
4. **Add good descriptions** - Help users understand what your tool does
5. **Validate inputs** - Check for required parameters
6. **Keep tools focused** - One tool = one task
7. **Test locally first** - Try your tool in the Tools tab before using in Chat

## Input Schema

The `inputSchema` follows JSON Schema format:

```javascript
inputSchema: {
  type: 'object',
  properties: {
    // String parameter
    city: { 
      type: 'string', 
      description: 'City name' 
    },
    // Number parameter
    temperature: { 
      type: 'number', 
      description: 'Temperature in Fahrenheit' 
    },
    // Boolean parameter
    includeDetails: { 
      type: 'boolean', 
      description: 'Include detailed information' 
    },
    // Enum parameter
    format: {
      type: 'string',
      enum: ['json', 'text', 'csv'],
      description: 'Output format'
    }
  },
  required: ['city']  // Which parameters are mandatory
}
```

## API Reference

The `api` object passed to `register()` provides:

### `api.registerTool(config)`

Registers a new tool with Workbench.

**Parameters:**
- `config.name` (string, required) - Tool identifier (e.g., 'weather.temperature')
- `config.description` (string, optional) - Human-readable description
- `config.inputSchema` (object, required) - JSON Schema for input validation
- `config.run` (function, required) - Async function that executes the tool

**Example:**
```javascript
api.registerTool({
  name: 'math.add',
  description: 'Adds two numbers',
  inputSchema: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' }
    },
    required: ['a', 'b']
  },
  run: async (input) => {
    return {
      content: `${input.a} + ${input.b} = ${input.a + input.b}`,
      metadata: { result: input.a + input.b }
    };
  }
});
```

## Troubleshooting

**Plugin not loading?**
- Check that `package.json` exists with `"type": "commonjs"`
- Verify your plugin folder is directly under `plugins/`
- Check the console for error messages
- Try refreshing plugins from the Tools tab

**Tool not showing up?**
- Make sure you called `api.registerTool()`
- Check that the tool name is unique
- Refresh the tools list

**Errors when running?**
- Check your tool's `run()` function for exceptions
- Ensure you're returning the correct format
- Look at the error message in the UI

## Why Standardize?

1. **Predictable behavior** - Frontend always knows how to display results
2. **Better error handling** - Errors are handled consistently
3. **Metadata support** - Additional context without cluttering main content
4. **MCP compatibility** - Works with Model Context Protocol format
5. **Tool chaining** - Consistent format enables reliable chaining
6. **No more drift** - One format to rule them all!
