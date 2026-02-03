// Hello World Tool - A minimal example plugin
module.exports.register = (api) => {
  api.registerTool({
    name: 'example.helloWorld',
    description: 'A simple hello world tool that echoes your name',
    inputSchema: {
      type: 'object',
      properties: {
        name: { 
          type: 'string', 
          description: 'Your name' 
        }
      },
      required: ['name']
    },
    run: async (input) => {
      // Return standardized format: { content, metadata?, error? }
      return {
        content: `Hello, ${input.name}! Welcome to Workbench. 🚀`,
        metadata: {
          timestamp: new Date().toISOString(),
          inputLength: input.name.length
        }
      };
    }
  });
};
