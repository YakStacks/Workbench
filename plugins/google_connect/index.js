const { google } = require('googleapis');

module.exports.register = (api) => {
  api.registerTool({
    name: 'google.connect',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Google OAuth client ID' },
        clientSecret: { type: 'string', description: 'Google OAuth client secret' },
        refreshToken: { type: 'string', description: 'Google OAuth refresh token' }
      },
      required: ['clientId', 'clientSecret', 'refreshToken']
    },
    run: async (input) => {
      try {
        const oauth2Client = new google.auth.OAuth2(
          input.clientId,
          input.clientSecret,
          'urn:ietf:wg:oauth:2.0:oob'
        );
        oauth2Client.setCredentials({ refresh_token: input.refreshToken });
        
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        // Test Calendar connection
        const calendarList = await calendar.calendarList.list();
        
        // Test Gmail connection
        const profile = await gmail.users.getProfile({ userId: 'me' });
        
        return {
          success: true,
          message: 'Connected to Google services successfully',
          calendar: {
            account: calendarList.data.items[0]?.summary,
            calendars: calendarList.data.items.length
          },
          gmail: {
            email: profile.data.emailAddress,
            userId: profile.data.userId
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  });
  
  // Add individual tools for Calendar and Gmail operations
  api.registerTool({
    name: 'google.calendar.listEvents',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        clientSecret: { type: 'string' },
        refreshToken: { type: 'string' },
        maxResults: { type: 'integer', default: 10 }
      },
      required: ['clientId', 'clientSecret', 'refreshToken']
    },
    run: async (input) => {
      const oauth2Client = new google.auth.OAuth2(
        input.clientId,
        input.clientSecret,
        'urn:ietf:wg:oauth:2.0:oob'
      );
      oauth2Client.setCredentials({ refresh_token: input.refreshToken });
      
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      const events = await calendar.events.list({
        calendarId: 'primary',
        maxResults: input.maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      return {
        events: events.data.items || []
      };
    }
  });
  
  api.registerTool({
    name: 'google.gmail.listMessages',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        clientSecret: { type: 'string' },
        refreshToken: { type: 'string' },
        maxResults: { type: 'integer', default: 10 }
      },
      required: ['clientId', 'clientSecret', 'refreshToken']
    },
    run: async (input) => {
      const oauth2Client = new google.auth.OAuth2(
        input.clientId,
        input.clientSecret,
        'urn:ietf:wg:oauth:2.0:oob'
      );
      oauth2Client.setCredentials({ refresh_token: input.refreshToken });
      
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      const messages = await gmail.users.messages.list({
        userId: 'me',
        maxResults: input.maxResults
      });
      
      return {
        messages: messages.data.messages || []
      };
    }
  });
};