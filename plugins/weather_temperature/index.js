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
          content: `Current temperature in ${input.city}: ${tempF}°F (${tempC}°C) - ${description}`,
          metadata: {
            city: input.city,
            temperatureF: tempF,
            temperatureC: tempC,
            feelsLikeF: feelsLikeF,
            description: description,
            humidity: current.humidity,
            windSpeedMph: current.windspeedMiles
          }
        };
      } catch (error) {
        return {
          content: `Could not get temperature for ${input.city}. Make sure you have internet connection and the city name is spelled correctly.`,
          error: error.message,
          metadata: {
            attempted: input.city
          }
        };
      }
    }
  });
};