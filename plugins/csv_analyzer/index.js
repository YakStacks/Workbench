// CSV Analyzer - Upload CSV, ask questions about the data
module.exports.register = (api) => {
  api.registerTool({
    name: 'data.csvAnalyzer',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { 
          type: 'string', 
          description: 'Path to CSV file' 
        },
        question: {
          type: 'string',
          description: 'Question about the data (e.g., "What are the top 5 sales?", "Average age?")'
        }
      },
      required: ['filePath']
    },
    run: async (input) => {
      const fs = require('fs');
      const path = require('path');
      
      try {
        // Read CSV file
        const csvContent = fs.readFileSync(input.filePath, 'utf-8');
        const lines = csvContent.split('\n').filter(l => l.trim());
        
        if (lines.length === 0) {
          throw new Error('CSV file is empty');
        }
        
        // Parse CSV (simple comma-split, doesn't handle quoted commas)
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const row = {};
          headers.forEach((header, i) => {
            row[header] = values[i] || '';
          });
          return row;
        });
        
        // Create summary
        const summary = {
          file: path.basename(input.filePath),
          rows: rows.length,
          columns: headers.length,
          headers: headers,
          sample: rows.slice(0, 5)
        };
        
        const question = input.question || 'Analyze this data';
        
        return {
          content: `CSV Data Analysis:\n\nFile: ${summary.file}\nRows: ${summary.rows}\nColumns: ${summary.columns}\nHeaders: ${headers.join(', ')}\n\nFirst 5 rows:\n${JSON.stringify(summary.sample, null, 2)}\n\nQuestion: ${question}\n\nPlease analyze this CSV data and answer the question.`,
          metadata: {
            ...summary,
            suggestedRole: 'structurer'
          }
        };
        
      } catch (error) {
        return {
          content: `Failed to analyze CSV: ${error.message}`,
          error: error.message,
          metadata: { filePath: input.filePath }
        };
      }
    }
  });
};
