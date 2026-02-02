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

## Why Standardize?

1. **Predictable behavior** - Frontend always knows how to display results
2. **Better error handling** - Errors are handled consistently
3. **Metadata support** - Additional context without cluttering main content
4. **MCP compatibility** - Works with Model Context Protocol format
5. **No more drift** - One format to rule them all!
