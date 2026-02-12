/**
 * Clinical Intake Note Generator
 * Converts intake packets (PDFs) into structured clinical intake notes
 * using Claude API with document analysis
 */

const axios = require('axios');

module.exports.register = (api) => {
  api.registerTool({
    name: 'clinical.generateIntakeNote',
    inputSchema: {
      type: 'object',
      properties: {
        intakePdfAssetId: {
          type: 'string',
          description: 'Asset ID of the uploaded intake packet PDF'
        },
        levelOfCare: {
          type: 'string',
          enum: ['loc35', 'loc31', 'locphp'],
          description: 'Level of Care: loc35 (3.5 High-Intensity Residential), loc31 (3.1 Low-Intensity Residential), locphp (Partial Hospitalization)'
        },
        extraDocsAssetIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Asset IDs of additional PDF documents (previous treatment records, etc.)'
        },
        additionalComments: {
          type: 'string',
          description: 'Optional: Clinician observations not in the packet (verbal reports, behavioral observations, etc.)'
        },
        apiKey: {
          type: 'string',
          description: 'Anthropic API key (get from https://console.anthropic.com/)'
        }
      },
      required: ['intakePdfAssetId', 'levelOfCare', 'apiKey']
    },
    run: async (input, context) => {
      try {
        const { intakePdfAssetId, levelOfCare, extraDocsAssetIds = [], additionalComments = '', apiKey } = input;

        // Get the intake PDF asset
        const intakePdf = await context.getAsset(intakePdfAssetId);
        if (!intakePdf) {
          throw new Error(`Intake PDF asset not found: ${intakePdfAssetId}`);
        }

        // Read the intake PDF as base64
        const intakePdfBase64 = intakePdf.data.toString('base64');

        // Get extra documents if provided
        const extraDocsData = [];
        for (const assetId of extraDocsAssetIds) {
          const asset = await context.getAsset(assetId);
          if (asset) {
            extraDocsData.push({
              name: asset.filename,
              data: asset.data.toString('base64')
            });
          }
        }

        // Map LOC codes to labels
        const locLabels = {
          'loc35': 'LOC 3.5 - Clinically Managed High-Intensity Residential',
          'loc31': 'LOC 3.1 - Clinically Managed Low-Intensity Residential',
          'locphp': 'LOC PHP - Partial Hospitalization Program'
        };

        const locLabel = locLabels[levelOfCare] || levelOfCare;

        // Build the prompt
        const prompt = `You are assisting a licensed clinician in creating clinical documentation from intake packets as part of their professional duties in a substance abuse treatment facility. This is legitimate clinical work where the clinician is authorized to access and process this protected health information.

Write a comprehensive but concise intake note using paragraphs only (no bullet points). Include ALL essential clinical information from the intake packet, but remove repetition, filler language, speculation, interpretation, or long explanations of diagnostic criteria. Report information factually. Avoid explaining the science behind withdrawal, ACEs, symptoms, or ASAM criteria. Avoid unnecessary adjectives or long medical descriptions. Avoid restating screening tools beyond the score and meaning. Fill out the intake note template completely with the information from the client's intake packet. Be as detailed as possible and include ASAM Dimensions and scores (with detailed reasonings using updated ASAM 4th edition). Use Cl instead of the client's first name or full name throughout the document. Include information if and why the client's environment is dangerous, the client's symptoms can only be managed in this setting, and the client's treatment needs to continue in this setting.

CRITICAL: Do NOT include birthdates, dates of birth, social security numbers, addresses, phone numbers, or other personally identifiable information in the output. Omit these entirely from the note. Only include clinical information relevant to treatment.

DO NOT include any preamble, introduction, explanation, or meta-commentary. Start IMMEDIATELY with the Identification section. Output only the intake note itself with no additional text before or after.

The recommended Level of Care is: ${locLabel}

${extraDocsData.length > 0 ? 'Additional documents have been provided including previous treatment records. Incorporate relevant historical information from these documents, noting any patterns in treatment history, previous responses to interventions, and continuity of care considerations.' : ''}

${additionalComments ? `The clinician has provided the following additional comments and observations to incorporate into the appropriate sections of the intake note: ${additionalComments}` : ''}

Put each section in paragraph format. Do not combine sections. Do not use any markdown symbols or formatting symbols such as asterisks, double asterisks, em dashes, or bullet points. Use plain text only.

Required sections (each as its own paragraph, do not combine):

Identification

Presenting Problem

Psychiatric/Mental Health

Trauma History

Family Psychiatric History

Medical History

Current Medications

Substance Use History
(Include age of first use, amount, route of abuse, and date of last use for each substance in paragraph format)

Family History

Social History

Spiritual/Cultural Factors

Developmental History

Education and Employment

Legal History

SNAP
(Strengths, Needs, Abilities, Preferences in paragraph format)

ASAM Dimensions and Reasonings
(Each dimension needs the dimension name, score, and EXTENSIVE detailed reasoning in paragraph format. These are used for insurance prior authorizations and must be thorough enough to justify the level of care. Each dimension should be a full paragraph of at least 5 to 8 sentences minimum. Include specific clinical evidence from the intake packet to support the score. Reference specific symptoms, behaviors, history, screening results, and risk factors. Explain WHY the score was given and HOW the clinical evidence supports placement at this level of care. For higher scores, clearly articulate what would happen without this level of care and why lower levels would be insufficient.)

Dimension 1: Acute Intoxication, Withdrawal and Addiction Medications
(Include current intoxication or withdrawal status, date of last use for all substances, withdrawal history and severity, any history of complicated withdrawal such as seizures or DTs, current or recommended addiction medications, and medical monitoring needs. Explain why this level of care is needed for safe management.)

Dimension 2: Biomedical Conditions and Complications
(Include all current medical conditions, medications, recent hospitalizations, chronic health issues, infectious disease status, pregnancy if applicable, and how these conditions interact with or complicate substance use treatment. Explain what medical monitoring or intervention is needed and why.)

Dimension 3: Psychiatric, Behavioral and Cognitive Conditions
(Include all mental health diagnoses, current symptoms, psychiatric medication compliance, history of psychiatric hospitalizations, suicidal or homicidal ideation history, cognitive impairments, and behavioral issues. Reference specific screening scores such as PHQ9 and GAD7. Explain how psychiatric symptoms impact treatment engagement and why this level of psychiatric support is needed.)

Dimension 4: Substance Use Related Risks
(Include patterns of use, consequences of use, high risk behaviors such as IV use and overdoses, inability to control use, continued use despite consequences, and relapse history. Explain the severity and chronicity of the substance use disorder and why intensive treatment is needed to address these risks.)

Dimension 5: Recovery Environment Interactions
(Include housing status, family and social support, presence of substance users in environment, employment status, access to substances, geographic barriers, and environmental triggers. Explain why the current environment is not conducive to recovery and why removal to this level of care is necessary.)

Dimension 6: Person Centered Considerations
(Include motivation for treatment, readiness to change, treatment preferences, cultural factors, strengths, barriers to engagement, insight into problems, and previous treatment response. Explain how the person's current readiness and preferences align with this level of care and what supports are needed to maintain engagement.)

Plan
(Detailed treatment plan in paragraph format)`;

        // Build message content array
        const messageContent = [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: intakePdfBase64
            }
          }
        ];

        // Add extra documents
        for (const extraDoc of extraDocsData) {
          messageContent.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: extraDoc.data
            }
          });
        }

        // Add prompt text
        messageContent.push({
          type: 'text',
          text: prompt
        });

        // Call Claude API
        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            messages: [
              {
                role: 'user',
                content: messageContent
              }
            ]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            }
          }
        );

        // Extract generated note
        if (response.data.content && response.data.content.length > 0) {
          const noteText = response.data.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');

          return {
            success: true,
            intakeNote: noteText,
            levelOfCare: locLabel,
            tokensUsed: {
              input: response.data.usage?.input_tokens || 0,
              output: response.data.usage?.output_tokens || 0
            },
            instructions: 'Copy the intake note above and paste it into your EMR system.'
          };
        } else {
          throw new Error('No content returned from API');
        }

      } catch (error) {
        return {
          success: false,
          error: error.message,
          details: error.response?.data || null
        };
      }
    }
  });
};
