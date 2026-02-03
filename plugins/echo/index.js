// Echo Tool - Simple text echoing utility
module.exports.register = (api) => {
  api.registerTool({
    name: 'example.echo',
    description: 'Echoes back any text you provide - useful for testing',
    inputSchema: {
      type: 'object',
      properties: {
        text: { 
          type: 'string', 
          description: 'Text to echo back' 
        }
      },
      required: ['text']
    },
    run: async (input) => {
      return {
        content: input.text,
        metadata: {
          characterCount: input.text.length,
          wordCount: input.text.split(/\s+/).length,
          timestamp: new Date().toISOString()
        }
      };
    }
  });
};
