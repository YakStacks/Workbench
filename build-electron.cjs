const fs = require('fs');
const path = require('path');

const files = [
  'main', 'preload', 'doctor', 'permissions', 'run-manager', 
  'process-registry', 'secrets-manager', 'tool-manifest', 
  'dry-run', 'memory-manager', 'tool-dispatch', 'environment-detection',
  'guardrails', 'asset-manager'
];

// Rename files from .js to .cjs
files.forEach(file => {
  const jsPath = path.join(__dirname, `${file}.js`);
  const cjsPath = path.join(__dirname, `${file}.cjs`);
  
  if (fs.existsSync(cjsPath)) {
    try {
      fs.unlinkSync(cjsPath);
    } catch (e) {
      console.error(`Failed to delete existing ${cjsPath}:`, e);
    }
  }
  
  if (fs.existsSync(jsPath)) {
    fs.renameSync(jsPath, cjsPath);
    console.log(`Renamed ${file}.js to ${file}.cjs`);
  } else {
    // It's possible tsc didn't generate it if it hasn't changed? 
    // But tsc usually generates all.
    // If it's missing, maybe we should warn, but likely it's fine if not needed?
    // Actually, for main.js it is critical.
    if (file === 'main') {
        console.error('Critical: main.js not found!');
        process.exit(1);
    }
  }
});

// Fix requires in main.cjs
const mainCjsPath = path.join(__dirname, 'main.cjs');
if (fs.existsSync(mainCjsPath)) {
  let content = fs.readFileSync(mainCjsPath, 'utf8');
  
  files.forEach(file => {
    if (file === 'main') return;
    // Replace require("./file") with require("./file.cjs")
    // Use regex to catch potential variations if needed, but the current script used exact string replacement
    // c=c.replace('require("./doctor")', 'require("./doctor.cjs")');
    // We should be careful to only replace the exact require string.
    
    const searchDouble = `require("./${file}")`;
    const replaceDouble = `require("./${file}.cjs")`;
    if (content.includes(searchDouble)) {
        content = content.split(searchDouble).join(replaceDouble);
        console.log(`  Updated ${searchDouble} to ${replaceDouble}`);
    } else {
        console.log(`  WARNING: Did not find ${searchDouble}`);
    }

    const searchSingle = `require('./${file}')`;
    const replaceSingle = `require('./${file}.cjs')`;
    if (content.includes(searchSingle)) {
        content = content.split(searchSingle).join(replaceSingle);
        console.log(`  Updated ${searchSingle} to ${replaceSingle}`);
    }
  });
  
  fs.writeFileSync(mainCjsPath, content);
  console.log('Updated requires in main.cjs');
}
