// Sample plugin: asamPromptBuilder
module.exports.register = (api) => {
  api.registerTool({
    name: 'clinical.asamPrompt',
    inputSchema: { type: 'object', properties: {} },
    run: async (_input) => {
      return 'Update the ASAM assessment with the following strict format: ...';
    },
  });
};
