// Workbench Artifact Converter Tool
// Converts React/Claude artifacts into Workbench-compatible tool definitions

const fs = require('fs').promises;
const path = require('path');

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
      required: ["code", "toolName"],
    },
    run: async (input) => {
      const { code, toolName, description } = input;

      // Extract parameters from the code
      const params = extractParameters(code);
      
      // Generate the tool file content
      const toolCode = generateToolCode(toolName, description || "Generated tool", params, code);
      
      // Create the plugin directory
      const pluginDir = path.join(process.cwd(), 'plugins', toolName.replace('.', '_'));
      await fs.mkdir(pluginDir, { recursive: true });
      
      // Write the index.js file
      const indexPath = path.join(pluginDir, 'index.js');
      await fs.writeFile(indexPath, toolCode, 'utf-8');
      
      // Write the package.json file
      const packageJson = {
        type: "commonjs"
      };
      const packagePath = path.join(pluginDir, 'package.json');
      await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2), 'utf-8');
      
      return {
        content: [{
          type: "text",
          text: `✅ Tool created successfully!\n\nLocation: ${pluginDir}\nTool name: ${toolName}\n\nThe tool has been generated and saved. Restart the application to load the new plugin.`
        }]
      };
    },
  });
};

function extractParameters(code) {
  const params = [];
  
  // Extract React props
  const propsMatch = code.match(/interface\s+\w+Props\s*{([^}]+)}/s) || 
                     code.match(/type\s+\w+Props\s*=\s*{([^}]+)}/s);
  
  if (propsMatch) {
    const propsContent = propsMatch[1];
    const propLines = propsContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
    
    propLines.forEach(line => {
      const match = line.match(/(\w+)(\?)?\s*:\s*([^;,]+)/);
      if (match) {
        const [, name, optional, type] = match;
        params.push({
          name: name.trim(),
          type: mapTypeToJsonSchema(type.trim()),
          required: !optional
        });
      }
    });
  }
  
  // Extract function parameters
  const funcMatch = code.match(/function\s+\w+\s*\(([^)]+)\)/) ||
                    code.match(/const\s+\w+\s*=\s*\(([^)]+)\)\s*=>/);
  
  if (funcMatch && params.length === 0) {
    const paramsStr = funcMatch[1];
    const paramList = paramsStr.split(',').map(p => p.trim()).filter(p => p);
    
    paramList.forEach(param => {
      const match = param.match(/(\w+)(\?)?\s*:\s*([^=]+)/);
      if (match) {
        const [, name, optional, type] = match;
        params.push({
          name: name.trim(),
          type: mapTypeToJsonSchema(type.trim()),
          required: !optional
        });
      } else {
        const name = param.split(/[=:]/, 1)[0].trim();
        if (name) {
          params.push({
            name,
            type: 'string',
            required: true
          });
        }
      }
    });
  }
  
  return params;
}

function mapTypeToJsonSchema(type) {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('string')) return 'string';
  if (lowerType.includes('number')) return 'number';
  if (lowerType.includes('boolean')) return 'boolean';
  if (lowerType.includes('array') || lowerType.includes('[]')) return 'array';
  if (lowerType.includes('object')) return 'object';
  return 'string'; // default
}

function generateToolCode(toolName, description, params, originalCode) {
  const properties = {};
  const required = [];
  
  params.forEach(param => {
    properties[param.name] = {
      type: param.type,
      description: `${param.name} parameter`
    };
    if (param.required) {
      required.push(param.name);
    }
  });
  
  // If no params found, create a generic input parameter
  if (params.length === 0) {
    properties.input = {
      type: 'string',
      description: 'Input data'
    };
    required.push('input');
  }
  
  const inputSchemaStr = JSON.stringify({ type: 'object', properties, required }, null, 6).replace(/^/gm, '    ');
  
  // Build prompt using input parameters
  const paramNames = Object.keys(properties);
  const promptInputs = paramNames.map(name => `\${input.${name}}`).join(', ');
  
  return `// Generated tool: ${toolName}
// ${description}

module.exports.register = (api) => {
  api.registerTool({
    name: '${toolName}',
    inputSchema: ${inputSchemaStr},
    run: async (input) => {
      // Build the prompt from the input parameters
      const prompt = \`Process the following data: ${promptInputs}\`;
      
      return {
        prompt,
        metadata: {
          toolName: '${toolName}',
          originalInputs: input
        }
      };
    }
  });
};

// Original code reference:
/*
${originalCode}
*/
`;
}
