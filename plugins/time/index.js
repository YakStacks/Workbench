// Time Tool - Get current time and date information
module.exports.register = (api) => {
  api.registerTool({
    name: 'example.currentTime',
    description: 'Returns the current date and time in various formats',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: { 
          type: 'string', 
          description: 'Timezone (e.g., America/New_York) - optional',
          default: 'local'
        }
      }
    },
    run: async (input) => {
      try {
        const now = new Date();
        const timezone = input.timezone || 'local';
        
        let localTime, isoTime, utcTime;
        
        if (timezone === 'local' || !input.timezone) {
          localTime = now.toLocaleString();
          isoTime = now.toISOString();
          utcTime = now.toUTCString();
        } else {
          // For specific timezones
          localTime = now.toLocaleString('en-US', { timeZone: timezone });
          isoTime = now.toISOString();
          utcTime = now.toUTCString();
        }
        
        return {
          content: `Current time: ${localTime}`,
          metadata: {
            iso: isoTime,
            utc: utcTime,
            local: localTime,
            timestamp: now.getTime(),
            timezone: timezone,
            dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
            date: now.toLocaleDateString()
          }
        };
      } catch (error) {
        return {
          content: `Error getting time: ${error.message}`,
          error: error.message,
          metadata: {
            attemptedTimezone: input.timezone
          }
        };
      }
    }
  });
};
