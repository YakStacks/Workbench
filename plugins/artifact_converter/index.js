/**
 * Artifact to Workbench Plugin Converter
 * Converts code artifacts (React components, functions, etc.) into Workbench plugin tools
 */

module.exports.register = (api) => {
  api.registerTool({
    name: 'converter.artifactToPlugin',
    inputSchema: {
      type: 'object',
      properties: {
        artifactCode: {
          type: 'string',
          description: 'The source code of the artifact to convert'
        },
        pluginName: {
          type: 'string',
          description: 'Name for the new plugin (e.g., "intake_note_generator")'
        },
        toolName: {
          type: 'string',
          description: 'Name for the tool within the plugin (e.g., "clinical.generateIntakeNote")'
        },
        description: {
          type: 'string',
          description: 'Description of what the tool does'
        }
      },
      required: ['artifactCode', 'pluginName', 'toolName', 'description']
    },
    run: async (input) => {
      try {
        const { artifactCode, pluginName, toolName, description } = input;

        // Extract core functionality
        const analysis = analyzeArtifact(artifactCode);

        // Generate plugin code
        const pluginCode = generatePluginCode({
          toolName,
          description,
          analysis,
          originalCode: artifactCode
        });

        return {
          success: true,
          pluginName,
          toolName,
          analysis: {
            type: analysis.type,
            apiCalls: analysis.apiCalls,
            dependencies: analysis.dependencies,
            mainFunction: analysis.mainFunction
          },
          pluginCode,
          nextSteps: [
            `Save this as plugins/${pluginName}/index.js`,
            'Add any required dependencies to package.json',
            'Restart Workbench to load the plugin',
            `Test the tool by calling "${toolName}"`
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  });
};

function analyzeArtifact(code) {
  const analysis = {
    type: 'unknown',
    apiCalls: [],
    dependencies: [],
    mainFunction: null,
    hasFileHandling: false,
    hasApiKey: false
  };

  // Detect artifact type
  if (code.includes('export default function') || code.includes('export default')) {
    analysis.type = 'react-component';
  } else if (code.includes('function ') || code.includes('const ') || code.includes('async ')) {
    analysis.type = 'function';
  }

  // Extract API calls
  const fetchMatches = code.matchAll(/fetch\s*\(\s*['"]([^'"]+)['"]/g);
  for (const match of fetchMatches) {
    analysis.apiCalls.push(match[1]);
  }

  // Extract dependencies
  const importMatches = code.matchAll(/import\s+(?:{[^}]+}|[^from]+)\s+from\s+['"]([^'"]+)['"]/g);
  for (const match of importMatches) {
    if (!match[1].startsWith('.')) {
      analysis.dependencies.push(match[1]);
    }
  }

  // Check for file handling
  if (code.includes('FileReader') || code.includes('readAsDataURL')) {
    analysis.hasFileHandling = true;
  }

  // Check for API keys
  if (code.includes('api.anthropic.com') || code.includes('openai.com')) {
    analysis.hasApiKey = true;
  }

  return analysis;
}

function generatePluginCode({ toolName, description, analysis, originalCode }) {
  const hasAxios = analysis.apiCalls.length > 0;

  return `/**
 * Auto-generated Workbench plugin
 * Original artifact type: ${analysis.type}
 * Generated: ${new Date().toISOString()}
 */

${hasAxios ? "const axios = require('axios');\n" : ''}${analysis.hasFileHandling ? "const fs = require('fs');\n" : ''}
module.exports.register = (api) => {
  api.registerTool({
    name: '${toolName}',
    inputSchema: {
      type: 'object',
      properties: {
        // TODO: Define input parameters based on artifact functionality
        input: {
          type: 'string',
          description: 'Input for the tool'
        }
      },
      required: ['input']
    },
    run: async (input) => {
      try {
        // TODO: Implement core logic from artifact
        // Original artifact code is preserved below for reference

        /*
         * ORIGINAL ARTIFACT CODE:
         * ${originalCode.split('\n').map(line => `         * ${line}`).join('\n')}
         */

        return {
          success: true,
          message: 'Tool executed successfully',
          result: 'Implement core logic here'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  });
};

/*
 * CONVERSION NOTES:
 * - Artifact type: ${analysis.type}
 * - API calls detected: ${analysis.apiCalls.join(', ') || 'none'}
 * - Dependencies: ${analysis.dependencies.join(', ') || 'none'}
 * - Has file handling: ${analysis.hasFileHandling}
 * - Requires API key: ${analysis.hasApiKey}
 *
 * NEXT STEPS:
 * 1. Extract core logic from original artifact
 * 2. Define proper input schema parameters
 * 3. Implement the run() function
 * 4. Add error handling
 * 5. Test the tool
 */
`;
}
