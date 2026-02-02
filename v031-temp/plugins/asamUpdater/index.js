// ASAM Dimension Updater Tool
// Converted from React artifact - generates updated ASAM dimensions for continued stay reviews

module.exports.register = (api) => {
  api.registerTool({
    name: 'clinical.asamUpdater',
    inputSchema: {
      type: 'object',
      properties: {
        previousASAM: {
          type: 'string',
          description: "The client's previous ASAM dimensions text"
        },
        levelOfCare: {
          type: 'string',
          description: 'Level of care code',
          enum: ['3.5', '3.1', 'OP']
        },
        updateType: {
          type: 'string',
          description: 'Type of update being performed',
          enum: ['weekly', 'intake']
        }
      },
      required: ['previousASAM']
    },
    run: async (input) => {
      const { previousASAM, levelOfCare = '3.5', updateType = 'weekly' } = input;

      const locDescriptions = {
        '3.5': 'Clinically Managed High-Intensity Residential',
        '3.1': 'Clinically Managed Low-Intensity Residential',
        'OP': 'Outpatient'
      };

      // Build LOC-specific requirements
      let locRequirements = '';
      if (levelOfCare === '3.5') {
        locRequirements = '- Justify need for 24-hour structured environment with clinical monitoring\n- Document severity requiring high-intensity residential services\n- Show why lower LOC would be insufficient';
      } else if (levelOfCare === '3.1') {
        locRequirements = '- Justify need for residential structure with less intensive monitoring\n- Document stability while showing remaining barriers to outpatient\n- Show appropriateness of this level versus higher or lower care';
      } else if (levelOfCare === 'OP') {
        locRequirements = '- Justify continued outpatient treatment needs\n- Document community functioning while showing ongoing treatment necessity\n- Show recovery maintenance needs and relapse prevention work';
      }

      const prompt = `You are a clinical documentation specialist updating ASAM dimensions for a substance abuse treatment client. Based on the previous ASAM dimensions provided, generate an updated ASAM assessment.

UPDATE TYPE: ${updateType === 'weekly' ? 'Weekly Continued Stay Review' : 'Intake / Level of Care Transition'}
${updateType === 'intake' ? 'NEW ' : 'CURRENT '}LEVEL OF CARE: ${levelOfCare} - ${locDescriptions[levelOfCare]}

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
- Do NOT use asterisks (*), double asterisks (**), em dashes (—), en dashes (–), bullet points, or any other special formatting characters
- Use regular hyphens (-) only where grammatically appropriate
- Include ALL essential clinical information
- Remove repetition, filler language, speculation, and interpretation
- Report information factually
- Do NOT explain the science behind withdrawal, ACEs, symptoms, or ASAM criteria
- Do NOT use unnecessary adjectives or long medical descriptions
- For screening tools, only include the score and its meaning
- Do NOT add explanations of diagnostic criteria

${updateType === 'weekly' ? `WEEKLY UPDATE CONSIDERATIONS:
- Justify continued need for current level of care
- Show clinical progression while maintaining medical necessity
- Document any changes in functioning, symptoms, or recovery status` : `INTAKE / LOC TRANSITION CONSIDERATIONS:
- Justify the appropriateness of the new level of care
- Document why the client meets criteria for LOC ${levelOfCare}
- Show clinical indicators that support this placement
- If stepping down, document stabilization and readiness
- If stepping up, document increased acuity or need for more structure`}

LEVEL OF CARE SPECIFIC REQUIREMENTS:
${locRequirements}

Generate updated dimensions that reflect appropriate clinical status and support medical necessity for LOC ${levelOfCare}.

PREVIOUS ASAM DIMENSIONS:
${previousASAM}

Generate the updated ASAM dimensions now, with each dimension as a single paragraph:`;

      return {
        prompt,
        metadata: {
          suggestedRole: 'writer_cheap',
          levelOfCare,
          updateType,
          locDescription: locDescriptions[levelOfCare],
          inputLength: previousASAM.length
        }
      };
    }
  });
};
