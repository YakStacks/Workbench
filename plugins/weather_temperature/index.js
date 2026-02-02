module.exports.register = (api) => {
  api.registerTool({
    name: 'weather.temperature',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' }
      },
      required: ['city']
    },
    run: async (input) => {
      // Use wttr.in - free weather API, no key needed!
      const fetch = (await import('node-fetch')).default;
      
      try {
        const response = await fetch(`https://wttr.in/${encodeURIComponent(input.city)}?format=j1`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const current = data.current_condition[0];
        const tempF = current.temp_F;
        const tempC = current.temp_C;
        const description = current.weatherDesc[0].value;
        const feelsLikeF = current.FeelsLikeF;
        
        return {
          city: input.city,
          temperature: `${tempF}°F (${tempC}°C)`,
          feelsLike: `${feelsLikeF}°F`,
          description: description,
          humidity: current.humidity + '%',
          windSpeed: current.windspeedMiles + ' mph',
          message: `Current temperature in ${input.city}: ${tempF}°F (${tempC}°C) - ${description}`
        };
      } catch (error) {
        return {
          error: 'Failed to fetch weather data',
          message: `Could not get temperature for ${input.city}. Error: ${error.message}`,
          note: 'Make sure you have internet connection and the city name is spelled correctly'
        };
      }
    }
  });
};