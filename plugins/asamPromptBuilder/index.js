// Sample plugin: asamPromptBuilder
module.exports.register = (api) => {
  api.registerTool({
    name: 'clinical.asamPrompt',
    inputSchema: {
      type: 'object',
      properties: {
        patientData: { type: 'string', description: 'Patient clinical data or notes' },
        dimension: { type: 'string', description: 'ASAM dimension (1-6) to focus on', enum: ['1', '2', '3', '4', '5', '6', 'all'] }
      },
      required: ['patientData']
    },
    run: async (input) => {
      const { patientData, dimension = 'all' } = input;
      
      const dimensions = {
        '1': 'Dimension 1: Acute Intoxication and/or Withdrawal Potential',
        '2': 'Dimension 2: Biomedical Conditions and Complications',
        '3': 'Dimension 3: Emotional, Behavioral, or Cognitive Conditions and Complications',
        '4': 'Dimension 4: Readiness to Change',
        '5': 'Dimension 5: Relapse, Continued Use, or Continued Problem Potential',
        '6': 'Dimension 6: Recovery/Living Environment'
      };
      
      let prompt = `Based on the following patient data, generate an ASAM assessment:\n\n${patientData}\n\n`;
      
      if (dimension === 'all') {
        prompt += 'Provide assessment for all 6 ASAM dimensions:\n';
        Object.entries(dimensions).forEach(([num, desc]) => {
          prompt += `\n${desc}:\n[Assessment]\n`;
        });
      } else {
        prompt += `Focus on ${dimensions[dimension]}:\n[Detailed Assessment]`;
      }
      
      prompt += '\n\nUse evidence-based clinical language and cite specific details from the patient data.';
      
      return { prompt, metadata: { dimension, dataLength: patientData.length } };
    },
  });
};
