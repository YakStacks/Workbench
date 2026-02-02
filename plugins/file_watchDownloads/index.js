const fs = require('');
const path = require('path');

module.exports.register = (api) => {
  api.registerTool({
    name: 'file.watchDownloads',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    run: async (input) => {
      const downloadsPath = path.join(require('os').homedir(), 'Downloads');
      fs.watch(downloadsPath, (eventType, filename) => {
        console.log(`File ${filename} has been ${eventType}`);
      });
      return { message: 'Watching Downloads folder for changes.' };
    }
  });
};