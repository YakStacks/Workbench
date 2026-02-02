module.exports.register = (api) => {
  api.registerTool({
    name: 'ASAM Dimension Updater',
    inputSchema: {
      type: 'object',
      properties: {
        previousASAM: {
          type: 'string',
          description: 'The previous ASAM dimensions provided by the user',
        },
        levelOfCare: {
          type: 'string',
          enum: ['3.5', '3.1', 'OP'],
          description: 'The level of care for the assessment',
        },
        updateType: {
          type: 'string',
          enum: ['weekly', 'intake'],
          description: 'The type of update for the ASAM dimensions',
        },
      },
      required: ['previousASAM', 'levelOfCare', 'updateType'],
    },
    run: async (input) => {
      const locDescriptions = {
        '3.5': 'Clinically Managed High-Intensity Residential',
        '3.1': 'Clinically Managed Low-Intensity Residential',
        'OP': 'Outpatient',
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
- Do NOT use unnecessary adjectives or long medical descriptions
- For screening tools, only include the score and its meaning
- Do NOT add explanations of diagnostic criteria

${input.updateType === 'weekly' ? `WEEKLY UPDATE CONSIDERATIONS:
- Justify continued need for current level of care
- Show clinical progression while maintaining medical necessity
- Document any changes in functioning, symptoms, or recovery status` : `INTAKE / LOC TRANSITION CONSIDERATIONS:
- Justify the appropriateness of the new level of care
- Document why the client meets criteria for LOC ${input.levelOfCare}
- Show clinical indicators that support this placement
- If stepping down, document stabilization and readiness
- If stepping up, document increased acuity or need for more structure`}

LEVEL OF CARE SPECIFIC REQUIREMENTS:
${input.levelOfCare === '3.5' ? '- Justify need for 24-hour structured environment with clinical monitoring\n- Document severity requiring high-intensity residential services\n- Show why lower LOC would be insufficient' : ''}
${input.levelOfCare === '3.1' ? '- Justify need for residential structure with less intensive monitoring\n- Document stability while showing remaining barriers to outpatient\n- Show appropriateness of this level versus higher or lower care' : ''}
${input.levelOfCare === 'OP' ? '- Justify continued outpatient treatment needs\n- Document community functioning while showing ongoing treatment necessity\n- Show recovery maintenance needs and relapse prevention work' : ''}

Generate updated dimensions that reflect appropriate clinical status and support medical necessity for LOC ${input.levelOfCare}.

PREVIOUS ASAM DIMENSIONS:
${input.previousASAM}

Generate the updated ASAM dimensions now, with each dimension as a single paragraph:`;

      return {
        content: prompt,
        metadata: {
          inputParameters: input,
          toolName: 'ASAM Dimension Updater',
          suggestedRole: 'writer_cheap',
          note: 'This prompt should be sent to an LLM. Use "Run with LLM" button.'
        }
      };
    }
  });
};