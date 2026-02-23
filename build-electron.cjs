const fs = require('fs');
const path = require('path');

// Root-level files
const rootFiles = [
  'main', 'preload', 'doctor', 'permissions', 'secrets-manager',
  'tool-manifest', 'dry-run', 'memory-manager', 'environment-detection',
  'guardrails', 'asset-manager', 'storage'
];

// Runtime files (in src/runtime/)
const runtimeFiles = [
  'run-manager', 'process-registry', 'sessions-manager', 'tool-dispatch'
];

// Core config files (in core/)
const coreConfigFiles = ['product-config'];

// Core files (in src/core/)
const coreFiles = [
  'index', 'runner', 'verification', 'doctor', 'events'
];

const files = [...rootFiles, ...runtimeFiles, ...coreFiles];

// Rename root files from .js to .cjs
rootFiles.forEach(file => {
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
    if (file === 'main') {
        console.error('Critical: main.js not found!');
        process.exit(1);
    }
  }
});

// Rename runtime files from .js to .cjs (in src/runtime/)
runtimeFiles.forEach(file => {
  const jsPath = path.join(__dirname, 'src', 'runtime', `${file}.js`);
  const cjsPath = path.join(__dirname, 'src', 'runtime', `${file}.cjs`);
  
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
  }
});

// Rename core files from .js to .cjs (in src/core/)
coreFiles.forEach(file => {
  const jsPath = path.join(__dirname, 'src', 'core', `${file}.js`);
  const cjsPath = path.join(__dirname, 'src', 'core', `${file}.cjs`);
  
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
  }
});

// Fix requires in main.cjs
const mainCjsPath = path.join(__dirname, 'main.cjs');
if (fs.existsSync(mainCjsPath)) {
  let content = fs.readFileSync(mainCjsPath, 'utf8');
  
  // Fix root-level requires
  rootFiles.forEach(file => {
    if (file === 'main') return;
    
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
  
  // Fix runtime requires (src/runtime/)
  runtimeFiles.forEach(file => {
    const searchDouble = `require("./src/runtime/${file}")`;
    const replaceDouble = `require("./src/runtime/${file}.cjs")`;
    if (content.includes(searchDouble)) {
        content = content.split(searchDouble).join(replaceDouble);
        console.log(`  Updated ${searchDouble} to ${replaceDouble}`);
    }

    const searchSingle = `require('./src/runtime/${file}')`;
    const replaceSingle = `require('./src/runtime/${file}.cjs')`;
    if (content.includes(searchSingle)) {
        content = content.split(searchSingle).join(replaceSingle);
        console.log(`  Updated ${searchSingle} to ${replaceSingle}`);
    }
  });
  
  // Fix core requires (src/core/) - only update index.js reference
  const searchCoreDouble = `require("./src/core")`;
  const replaceCoreDouble = `require("./src/core/index.cjs")`;
  if (content.includes(searchCoreDouble)) {
      content = content.split(searchCoreDouble).join(replaceCoreDouble);
      console.log(`  Updated ${searchCoreDouble} to ${replaceCoreDouble}`);
  }

  const searchCoreSingle = `require('./src/core')`;
  const replaceCoreSingle = `require('./src/core/index.cjs')`;
  if (content.includes(searchCoreSingle)) {
      content = content.split(searchCoreSingle).join(replaceCoreSingle);
      console.log(`  Updated ${searchCoreSingle} to ${replaceCoreSingle}`);
  }
  
  // Fix core/product-config require
  const searchProductConfig = `require("./core/product-config")`;
  const replaceProductConfig = `require("./core/product-config.cjs")`;
  if (content.includes(searchProductConfig)) {
      content = content.split(searchProductConfig).join(replaceProductConfig);
      console.log(`  Updated ${searchProductConfig} to ${replaceProductConfig}`);
  }
  
  fs.writeFileSync(mainCjsPath, content);
  console.log('Updated requires in main.cjs');
}

// Fix requires in src/core/index.cjs
const coreIndexPath = path.join(__dirname, 'src', 'core', 'index.cjs');
if (fs.existsSync(coreIndexPath)) {
  let content = fs.readFileSync(coreIndexPath, 'utf8');
  
  // Update requires to use .cjs extensions
  content = content.replace(/require\(['"]\.\/runner['"]\)/g, 'require("./runner.cjs")');
  content = content.replace(/require\(['"]\.\/verification['"]\)/g, 'require("./verification.cjs")');
  content = content.replace(/require\(['"]\.\/doctor['"]\)/g, 'require("./doctor.cjs")');
  content = content.replace(/require\(['"]\.\/events['"]\)/g, 'require("./events.cjs")');
  
  fs.writeFileSync(coreIndexPath, content);
  console.log('Updated requires in src/core/index.cjs');
}
