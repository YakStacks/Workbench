// File Watcher - Alert when files change in a directory
module.exports.register = (api) => {
  const watchers = new Map();
  
  api.registerTool({
    name: 'system.fileWatcher',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { 
          type: 'string', 
          description: 'Directory to watch (e.g., Downloads folder)' 
        },
        action: {
          type: 'string',
          enum: ['start', 'stop', 'status'],
          description: 'start = begin watching, stop = stop watching, status = check current watchers'
        }
      },
      required: ['directory', 'action']
    },
    run: async (input) => {
      const fs = require('fs');
      const path = require('path');
      
      try {
        const dirPath = path.resolve(input.directory);
        
        if (input.action === 'status') {
          const activeWatchers = Array.from(watchers.keys());
          return {
            content: activeWatchers.length > 0 
              ? `Active watchers:\n${activeWatchers.join('\n')}`
              : 'No active file watchers',
            metadata: { watchers: activeWatchers }
          };
        }
        
        if (input.action === 'stop') {
          if (watchers.has(dirPath)) {
            watchers.get(dirPath).close();
            watchers.delete(dirPath);
            return {
              content: `✅ Stopped watching: ${dirPath}`,
              metadata: { directory: dirPath, status: 'stopped' }
            };
          } else {
            return {
              content: `No watcher found for: ${dirPath}`,
              metadata: { directory: dirPath }
            };
          }
        }
        
        if (input.action === 'start') {
          if (!fs.existsSync(dirPath)) {
            throw new Error('Directory does not exist');
          }
          
          if (watchers.has(dirPath)) {
            return {
              content: `Already watching: ${dirPath}`,
              metadata: { directory: dirPath, status: 'already-watching' }
            };
          }
          
          const changes = [];
          const watcher = fs.watch(dirPath, (eventType, filename) => {
            const timestamp = new Date().toISOString();
            changes.push({ timestamp, eventType, filename });
            console.log(`[FileWatcher] ${timestamp} - ${eventType}: ${filename} in ${dirPath}`);
          });
          
          watchers.set(dirPath, watcher);
          
          return {
            content: `✅ Now watching: ${dirPath}\n\nChanges will be logged to console. Use action="stop" to stop watching.`,
            metadata: { 
              directory: dirPath, 
              status: 'watching',
              note: 'Changes are logged to Electron console. Future: send notifications or save to file.'
            }
          };
        }
        
      } catch (error) {
        return {
          content: `Failed to set up file watcher: ${error.message}`,
          error: error.message,
          metadata: { directory: input.directory }
        };
      }
    }
  });
};
