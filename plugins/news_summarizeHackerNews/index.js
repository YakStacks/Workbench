const fetch = require('node-fetch');
const cheerio require('cheerio');

module.exports.register = (api) => {
  api.registerTool({
    name: 'news.summarizeHackerNews',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    run: async (input) => {
      const response = await fetch('https://news.ycombinator.com');
      const body = await response.text();
      const $ = cheerio.load(body);
      let articles = [];

      $('.storylink').each((i, element) => {
        articles.push({
          title: $(element).text(),
          link: $(element).attr('href')
        });
      });

      return { summary: articles.slice(0, 5) }; // Summarizes the top 5 articles
    }
  });
};