// URL Summarizer - Paste any link, get TL;DR
module.exports.register = (api) => {
  api.registerTool({
    name: 'web.urlSummary',
    inputSchema: {
      type: 'object',
      properties: {
        url: { 
          type: 'string', 
          description: 'URL to summarize (article, blog post, documentation)' 
        }
      },
      required: ['url']
    },
    run: async (input) => {
      const fetch = (await import('node-fetch')).default;
      
      try {
        // Fetch the webpage
        const response = await fetch(input.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Basic HTML to text extraction (removes tags)
        let text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Limit to first 3000 chars to avoid token limits
        text = text.substring(0, 3000);
        
        return {
          content: `Content from ${input.url}:\n\n${text}\n\nPlease provide a concise summary of this article.`,
          metadata: {
            url: input.url,
            contentLength: text.length,
            suggestedRole: 'writer_cheap'
          }
        };
        
      } catch (error) {
        return {
          content: `Failed to fetch ${input.url}: ${error.message}`,
          error: error.message,
          metadata: { url: input.url }
        };
      }
    }
  });
};
