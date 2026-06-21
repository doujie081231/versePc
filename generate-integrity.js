const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const INTEGRITY_FILES = [
    'main.js',
    'server.js',
    'preload.cjs',
    'editor-preload.cjs',
    'agent-engine.js',
    'js/app.js',
    'js/ai-chat.js',
    'js/api.js'
];

const OUTPUT_FILE = 'integrity.json';

function computeHash(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

function main() {
    const projectRoot = __dirname;
    const manifest = {};

    for (const file of INTEGRITY_FILES) {
        const filePath = path.join(projectRoot, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`  WARN: ${file} not found, skipping`);
            continue;
        }
        manifest[file] = computeHash(filePath);
        console.log(`  OK: ${file} -> ${manifest[file].substring(0, 16)}...`);
    }

    const outputPath = path.join(projectRoot, OUTPUT_FILE);
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
    console.log(`Integrity manifest written to ${OUTPUT_FILE} (${Object.keys(manifest).length} files)`);

    const aiEnabled = process.env.ENABLE_AI === 'true';
    const aiConfigPath = path.join(projectRoot, 'ai-enabled.json');
    fs.writeFileSync(aiConfigPath, JSON.stringify({ enabled: aiEnabled }));
    console.log(`AI config written to ai-enabled.json (enabled=${aiEnabled})`);

    if (aiEnabled) {
        const preloadPath = path.join(projectRoot, 'preload.cjs');
        let preloadContent = fs.readFileSync(preloadPath, 'utf8');
        preloadContent = preloadContent.replace(
            /isAIEnabled:\s*\(\)\s*=>\s*\{[\s\S]*?return\s+(?:true|false);\s*\}/,
            'isAIEnabled: () => { return true; }'
        );
        fs.writeFileSync(preloadPath, preloadContent);
        console.log('Preload patched: isAIEnabled -> true');
    }
}

main();
