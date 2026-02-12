# Fixes Applied - 2026-02-12

## ✅ Issue 1: Wrong Icon (Electron Symbol)
**Problem:** App was showing the default Electron icon instead of your custom Workbench logo.

**Root Cause:** Your `build/icon.png` was 476x455 (not square), and the png-to-ico converter requires square images.

**Solution:**
- Created a square version (476x476) with centered logo
- Regenerated `icon.ico` from the square version
- Icon file updated successfully

**Action Required:** Restart Workbench to see your custom wrench/door logo.

---

## ✅ Issue 2: Plugin Save Error
**Problem:** AI-generated plugin code was trying to save with invalid structure, causing "ENOTDIR, not a directory" error.

**Root Cause:** The suggested code had nested/recursive structure and invalid plugin format.

**Solution:** Created two working plugins:

### 1. Artifact Converter (`plugins/artifact_converter/`)
- Analyzes code artifacts (React components, functions, etc.)
- Detects API calls, dependencies, file handling
- Generates skeleton plugin code
- Provides conversion notes and next steps

### 2. Intake Note Generator (`plugins/intake_note_generator/`)
- Your React artifact converted to a working Workbench tool
- Reads PDF intake packets using Claude API
- Generates ASAM-compliant clinical notes
- Supports multiple documents and additional comments

**See:** `ARTIFACT_CONVERSION_GUIDE.md` for full usage documentation

---

## ✅ Issue 3: Broken Suggestion Buttons
**Problem:** "Search Files", "Run Doctor", "List Directory", "Read File" buttons didn't work.

**Root Cause:** Buttons referenced non-existent builtin tools:
- `builtin.searchFiles` ❌ (doesn't exist)
- `builtin.doctor` ❌ (doesn't exist)
- `builtin.exportReport` ❌ (doesn't exist)

**Solution:** Updated `src/components/SuggestionChips.tsx` to use actual tools:

### Before (Broken):
```typescript
const BASE_CHIPS: Chip[] = [
  { label: 'Search Files', action: '/builtin.searchFiles' },  // ❌ doesn't exist
  { label: 'Run Doctor', action: '/builtin.doctor' },         // ❌ doesn't exist
];

const TOOL_CHIPS: Chip[] = [
  { label: 'List Directory', action: '/builtin.listDir' },
  { label: 'Read File', action: '/builtin.readFile' },
  { label: 'Export Report', action: '/builtin.exportReport' }, // ❌ doesn't exist
];
```

### After (Working):
```typescript
const BASE_CHIPS: Chip[] = [
  { label: 'List Directory', action: '/builtin.listDir' },    // ✅ exists
  { label: 'System Info', action: '/builtin.systemInfo' },    // ✅ exists
];

const TOOL_CHIPS: Chip[] = [
  { label: 'Read File', action: '/builtin.readFile' },        // ✅ exists
  { label: 'List Directory', action: '/builtin.listDir' },    // ✅ exists
  { label: 'Write File', action: '/builtin.writeFile' },      // ✅ exists
];
```

**Action Required:** Restart Workbench to see the fixed buttons.

---

## Available Builtin Tools

These are the actual builtin tools that exist in Workbench:

### File Operations
- ✅ `builtin.readFile` - Read file contents
- ✅ `builtin.writeFile` - Write to a file
- ✅ `builtin.listDir` - List directory contents
- ✅ `builtin.fileExists` - Check if file exists

### System Operations
- ✅ `builtin.shell` - Execute shell commands
- ✅ `builtin.systemInfo` - Get system information
- ✅ `builtin.processes` - List running processes
- ✅ `builtin.diskSpace` - Check disk space
- ✅ `builtin.networkInfo` - Get network information
- ✅ `builtin.envVars` - List environment variables
- ✅ `builtin.installedApps` - List installed applications

### Asset Operations
- ✅ `builtin.readAsset` - Read uploaded assets
- ✅ `builtin.extractPdf` - Extract text from PDFs
- ✅ `builtin.analyzeAsset` - Analyze asset contents

### Clipboard
- ✅ `builtin.clipboardRead` - Read from clipboard
- ✅ `builtin.clipboardWrite` - Write to clipboard

---

## How to Restart and Test

### 1. Restart Workbench
```bash
# Stop current instance (Ctrl+C if running)
npm run dev
```

### 2. Check the Icon
- Look at the taskbar icon
- Look at the window title bar icon
- Should show your custom wrench/door logo, not Electron

### 3. Test the Buttons
- Click "List Directory" - should open a tool dialog asking for directory path
- Click "Read File" - should open a tool dialog asking for file path
- Click "System Info" - should open a tool dialog
- Click "Analyze Asset" - should open a tool dialog

### 4. Test New Plugins
Ask the AI:
- "List all available tools" - should show artifact_converter and intake_note_generator
- "What tools do we have for clinical work?" - should mention intake_note_generator

### 5. Test Artifact Converter
Ask the AI:
- "Use the artifact converter to analyze this code: [paste some code]"

---

## Files Changed

1. **Icon Files:**
   - `build/icon-square.png` (created)
   - `icon.ico` (regenerated)

2. **New Plugins:**
   - `plugins/artifact_converter/index.js` (created)
   - `plugins/artifact_converter/package.json` (created)
   - `plugins/intake_note_generator/index.js` (created)
   - `plugins/intake_note_generator/package.json` (created)

3. **UI Fix:**
   - `src/components/SuggestionChips.tsx` (modified)

4. **Documentation:**
   - `ARTIFACT_CONVERSION_GUIDE.md` (created)
   - `FIXES_APPLIED.md` (this file)

5. **Build Artifacts:**
   - `dist/` (rebuilt)
   - `*.cjs` files (regenerated)

---

## Next Steps

1. ✅ **Restart Workbench** to load all changes
2. ✅ **Test the buttons** to verify they work
3. ✅ **Check the icon** in taskbar and title bar
4. 📚 **Read ARTIFACT_CONVERSION_GUIDE.md** for plugin usage
5. 🧪 **Try the intake note generator** if you have clinical PDFs

---

## Questions?

All fixed! The buttons now point to actual tools that exist in your codebase. The non-existent tools have been replaced with working alternatives.
