// Clipboard History - Remember what you copied
module.exports.register = (api) => {
  const history = [];
  const MAX_HISTORY = 50;
  let monitoring = false;
  let lastClipboard = '';
  let monitorInterval = null;
  
  // Monitor clipboard changes
  const startMonitoring = () => {
    if (monitoring) return;
    
    const { clipboard } = require('electron');
    monitoring = true;
    
    monitorInterval = setInterval(() => {
      const current = clipboard.readText();
      if (current && current !== lastClipboard) {
        lastClipboard = current;
        history.unshift({
          text: current,
          timestamp: new Date().toISOString(),
          preview: current.substring(0, 100) + (current.length > 100 ? '...' : '')
        });
        
        // Keep only last MAX_HISTORY items
        if (history.length > MAX_HISTORY) {
          history.pop();
        }
      }
    }, 1000); // Check every second
  };
  
  api.registerTool({
    name: 'system.clipboardHistory',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'stop', 'list', 'get', 'clear'],
          description: 'start = begin monitoring, stop = stop, list = show history, get = retrieve specific item, clear = erase history'
        },
        index: {
          type: 'number',
          description: 'For action=get: which item to retrieve (0 = most recent)'
        }
      },
      required: ['action']
    },
    run: async (input) => {
      const { clipboard } = require('electron');
      
      try {
        if (input.action === 'start') {
          startMonitoring();
          return {
            content: `✅ Clipboard monitoring started. Your clipboard history will be tracked (last ${MAX_HISTORY} items).`,
            metadata: { monitoring: true, maxItems: MAX_HISTORY }
          };
        }
        
        if (input.action === 'stop') {
          if (monitorInterval) {
            clearInterval(monitorInterval);
            monitorInterval = null;
          }
          monitoring = false;
          return {
            content: '✅ Clipboard monitoring stopped.',
            metadata: { monitoring: false }
          };
        }
        
        if (input.action === 'clear') {
          history.length = 0;
          return {
            content: '✅ Clipboard history cleared.',
            metadata: { historySize: 0 }
          };
        }
        
        if (input.action === 'list') {
          if (history.length === 0) {
            return {
              content: 'No clipboard history yet. Use action="start" to begin monitoring.',
              metadata: { historySize: 0 }
            };
          }
          
          const list = history.map((item, i) => 
            `[${i}] ${item.timestamp.split('T')[1].split('.')[0]} - ${item.preview}`
          ).join('\n');
          
          return {
            content: `Clipboard History (${history.length} items):\n\n${list}\n\nUse action="get" with index=N to retrieve full text.`,
            metadata: { 
              historySize: history.length,
              items: history
            }
          };
        }
        
        if (input.action === 'get') {
          const index = input.index || 0;
          if (index < 0 || index >= history.length) {
            return {
              content: `Invalid index ${index}. History has ${history.length} items (0-${history.length - 1}).`,
              error: 'Index out of range'
            };
          }
          
          const item = history[index];
          return {
            content: `Clipboard item [${index}] from ${item.timestamp}:\n\n${item.text}`,
            metadata: {
              index,
              timestamp: item.timestamp,
              length: item.text.length
            }
          };
        }
        
      } catch (error) {
        return {
          content: `Clipboard history error: ${error.message}`,
          error: error.message
        };
      }
    }
  });
  
  // Auto-start monitoring on plugin load
  startMonitoring();
};
