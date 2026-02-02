module.exports.register = (api) => {
  api.registerTool({
    name: 'ASAM Dimension Updater',
    inputSchema: {
      type: 'object',
      properties: {
        previousASAM: {
          type: 'string',
          description: 'The previous ASAM dimensions for the client.'
        },
        updateType: {
          type: 'string',
          enum: ['weekly', 'intake'],
          description: 'The type of update to perform.'
        },
        levelOfCare: {
          type: 'string',
          enum: ['3.5', '3.1', 'OP'],
          description: 'The current or new level of care for the client.'
        }
      },
      required: ['previousASAM', 'updateType', 'levelOfCare']
    },
    run: async (input) => {
      const locDescriptions = {
        '3.5': 'Clinically Managed High-Intensity Residential',
        '3.1': 'Clinically Managed Low-Intensity Residential',
        'OP': 'Outpatient'
      };

      const prompt = `You are a clinical documentation specialist updating ASAM dimensions for a substance abuse treatment client. Based on the previous ASAM dimensions provided, generate an updated ASAM assessment.

UPDATE TYPE: ${input.updateType === 'weekly' ? 'Weekly Continued Stay Review' : 'Intake / Level of Care Transition'}
${input.updateType === 'intake' ? 'NEW ' : 'CURRENT '}LEVEL OF CARE: ${input.levelOfCare} - ${locDescriptions[input.levelOfCare]}

CRITICAL FORMATTING RULES:
- Each dimension must be a single continuous paragraph with NO line breaks within it
- Use EXACTLY these dimension names in this exact order:
  1. Dimension 1 - Acute Intoxication, Withdrawal and Addiction Medications
  2. Dimension 2 - Biomedical Conditions and Complications
  3. Dimension 3 - Psychiatric, Behavioral and Cognitive Conditions
  4. Dimension 4 - Substance Use Related Risks
  5. Dimension 5 - Recovery Environment Interactions
  6. Dimension 6 - Person Centered Considerations
- Format: "Dimension X - [Exact Name from Above]: Score: [0-4]. [Detailed clinical reasoning as continuous text]"
- Use only plain text with NO markdown formatting symbols
- Do NOT explain the science behind withdrawal, ACEs, symptoms, or ASAM criteria
- Report information factually
- Generate updated dimensions that reflect appropriate clinical status and support medical necessity for LOC ${input.levelOfCare}.

PREVIOUS ASAM DIMENSIONS:
${input.previousASAM}

Generate the updated ASAM dimensions now, with each dimension as a single paragraph:`;

      // Return prompt for LLM processing with suggested role
      return {
        content: prompt,
        metadata: {
          inputType: input.updateType,
          careLevel: input.levelOfCare,
          suggestedRole: 'writer_cheap',
          note: 'This prompt should be sent to an LLM. Use "Run with LLM" button or process in Chat.'
        }
      };
    }
  });
};