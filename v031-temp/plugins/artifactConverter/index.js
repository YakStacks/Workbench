// Workbench Artifact Converter Tool
// Converts React/Claude artifacts into Workbench-compatible tool definitions

module.exports.register = (api) => {
  api.registerTool({
    name: "workbench.convertArtifact",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The React/Claude artifact or code block to convert",
        },
        toolName: {
          type: "string",
          description: "Desired tool name (e.g., clinical.noteGenerator)",
        },
        description: {
          type: "string",
          description: "Brief description of what the tool should do",
        },
      },
      required: ["code"],
    },
    run: async (input) => {
      const { code, toolName, description } = input;

      // Generate a suggested tool name if not provided
      const suggestedName = toolName || "custom.generatedTool";

      const prompt = `You are a senior TypeScript engineer. Convert the following code artifact into a Workbench-compatible tool definition.

## Workbench Tool Requirements

1. **Structure**: CommonJS module exporting \`register(api)\` that calls \`api.registerTool(toolDefinition)\`
2. **NO direct LLM/API calls**: Tools must NOT call external LLM APIs directly. Instead, return \`{ prompt, metadata }\` so Workbench routes the call centrally.
3. **Input schema**: JSON Schema format with \`type\`, \`properties\`, and \`required\`
4. **Output format**: \`{ prompt: string, metadata: object }\`

## Template

\`\`\`javascript
module.exports.register = (api) => {
  api.registerTool({
    name: '${suggestedName}',
    inputSchema: {
      type: 'object',
      properties: {
        // Extract input parameters from the artifact
      },
      required: []
    },
    run: async (input) => {
      // Transform input into a prompt
      // DO NOT make API calls - just build the prompt
      
      const prompt = \`Your prompt here using \${input.field}\`;
      
      return {
        prompt,
        metadata: {
          // Include relevant metadata for Workbench routing
        }
      };
    }
  });
};
\`\`\`

## Code to Convert

${description ? `**Description**: ${description}\n\n` : ""}\`\`\`
${code}
\`\`\`

## Instructions

1. Analyze what the code does (UI, API calls, data transformation)
2. Extract the core functionality that should become a tool
3. Identify input parameters from props, state, or function arguments
4. Identify any prompts or LLM interactions - these become the \`prompt\` output
5. Generate a complete, working \`index.js\` file

**Output only the JavaScript code, no explanations.**`;

      return {
        prompt,
        metadata: {
          suggestedRole: "coder_cheap",
          outputFormat: "javascript",
          inputCodeLength: code.length,
          suggestedToolName: suggestedName,
          hasDescription: !!description,
        },
      };
    },
  });
};
