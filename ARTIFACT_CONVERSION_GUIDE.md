# Artifact to Workbench Plugin Conversion Guide

## What Got Fixed

### ✅ Icon Issue
- Your icon.png was 476x455 (not square)
- Created a square version at 476x476
- Regenerated icon.ico with your custom Workbench logo
- **Action Required:** Restart Workbench to see your custom icon

### ✅ Plugin Conversion
Created two new plugins:

## 1. Artifact Converter Tool

**Location:** `plugins/artifact_converter/`

A meta-tool that analyzes code artifacts and helps convert them to Workbench plugins.

### Usage:
```javascript
// Call from Workbench AI
{
  "tool": "converter.artifactToPlugin",
  "artifactCode": "your React/JS code here",
  "pluginName": "my_new_plugin",
  "toolName": "category.toolName",
  "description": "What this tool does"
}
```

### What it does:
- Analyzes artifact code type (React component, function, etc.)
- Detects API calls and dependencies
- Generates skeleton plugin code
- Provides conversion notes and next steps

---

## 2. Clinical Intake Note Generator

**Location:** `plugins/intake_note_generator/`

Converted from your React artifact into a fully functional Workbench tool.

### How to Use:
1. **Upload your intake PDF** to Workbench (drag & drop or use Upload button)
2. **Ask the AI**: "Generate an intake note from the uploaded PDF using LOC 3.5"
3. The AI will automatically use the `clinical.generateIntakeNote` tool
4. Copy the generated note to your EMR system

### Usage Example (Direct API):
```javascript
{
  "tool": "clinical.generateIntakeNote",
  "intakePdfAssetId": "asset_abc123",
  "levelOfCare": "loc35",
  "extraDocsAssetIds": [
    "asset_def456",
    "asset_ghi789"
  ],
  "additionalComments": "Client appeared tearful when discussing family. Reports increased cravings after recent stressor.",
  "apiKey": "sk-ant-api03-xxxxx"
}
```

### Parameters:
- **intakePdfAssetId** (required): Asset ID of uploaded intake PDF
- **levelOfCare** (required): One of:
  - `loc35` - LOC 3.5 High-Intensity Residential
  - `loc31` - LOC 3.1 Low-Intensity Residential
  - `locphp` - Partial Hospitalization Program
- **extraDocsAssetIds** (optional): Array of asset IDs for additional PDFs
- **additionalComments** (optional): Clinician observations
- **apiKey** (required): Your Anthropic API key

### Features:
- ✅ Reads PDF documents using Claude's document analysis
- ✅ Generates comprehensive ASAM-based intake notes
- ✅ Supports multiple documents (previous treatment records)
- ✅ Removes PII automatically
- ✅ Formatted for insurance authorization

---

## Key Differences: Artifact vs Plugin

### React Artifact (Original):
- **UI-based:** Forms, buttons, file uploads
- **Browser-only:** Runs in web browser
- **User-driven:** Manual form filling
- **Visual output:** Displays results on screen

### Workbench Plugin (Converted):
- **API-based:** Function calls with parameters
- **Backend tool:** Runs in Node.js (Electron)
- **AI-driven:** AI calls the tool when needed
- **Programmatic:** Returns structured data

---

## How to Use the Converter for Future Artifacts

### Step 1: Get your artifact code
Copy the code from Claude.ai or wherever you have it.

### Step 2: Analyze with converter
Ask the AI in Workbench:
> "Use the artifact converter to analyze this code and create a plugin scaffold for it: [paste code]"

### Step 3: Review the output
The converter will:
- Identify artifact type
- List dependencies needed
- Generate skeleton code
- Provide conversion notes

### Step 4: Manual conversion
For complex artifacts (like the Intake Note Generator), you'll need to:
1. Extract core business logic (the actual functionality)
2. Remove UI code (React components, forms, etc.)
3. Convert file handling (browser FileReader → Node.js fs)
4. Define input schema (what parameters the tool needs)
5. Implement the run() function

---

## Testing Your New Tools

### Restart Workbench
```bash
npm run dev
```

### Test the Intake Note Generator
1. Prepare a test PDF intake packet
2. Get your Anthropic API key from https://console.anthropic.com/
3. Ask the AI in Workbench:
   > "Generate an intake note from this PDF: C:/path/to/intake.pdf using LOC 3.5. My API key is sk-ant-..."

The AI will automatically use the `clinical.generateIntakeNote` tool!

---

## Common Conversion Patterns

### Pattern 1: API Call Artifacts
**Example:** Tools that call external APIs (like the intake generator)

**Conversion:**
- Extract API endpoint and request format
- Move API key to input parameter (or use secrets)
- Convert fetch() to axios or node-fetch
- Return API response as tool result

### Pattern 2: Data Processing Artifacts
**Example:** CSV analyzers, text transformers, calculators

**Conversion:**
- Extract core algorithm/function
- Define input schema for data
- Return processed result

### Pattern 3: File Handling Artifacts
**Example:** PDF readers, image processors

**Conversion:**
- Replace browser FileReader with Node.js fs
- Use file paths instead of file uploads
- Return file contents or processed data

---

## Next Steps

1. **Restart Workbench** to load the new plugins and see your custom icon
2. **Test the intake generator** with a sample PDF
3. **Use the converter** for your next artifact
4. **Customize as needed** - edit the plugin code to fit your workflow

---

## Getting API Keys

### Anthropic Claude API
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key
5. Copy and save it (starts with `sk-ant-`)

**Note:** You'll need to add billing info to use the API. The Intake Note Generator uses Claude Sonnet 4, which costs ~$3 per 1M input tokens and ~$15 per 1M output tokens.

---

## Troubleshooting

### Plugin not showing up?
- Check `plugins/[name]/package.json` exists with `{"type": "commonjs"}`
- Restart Workbench completely
- Check console for load errors

### API key errors?
- Make sure your key starts with `sk-ant-`
- Verify billing is set up in Anthropic console
- Check for typos in the key

### File not found errors?
- Use absolute paths: `C:/full/path/to/file.pdf`
- Check file actually exists
- Make sure you have read permissions

---

## Questions?

Check the example plugins in `plugins/` directory for reference implementations!
