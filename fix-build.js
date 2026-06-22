const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const cacheDir = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'winCodeSign');

function fixExistingCache() {
    if (!fs.existsSync(cacheDir)) return;
    const dirs = fs.readdirSync(cacheDir).filter(d => /^\d+$/.test(d) && fs.statSync(path.join(cacheDir, d)).isDirectory());
    let fixed = 0;
    for (const d of dirs) {
        const libDir = path.join(cacheDir, d, 'darwin', '10.12', 'lib');
        if (!fs.existsSync(libDir)) continue;
        for (const name of ['libcrypto.dylib', 'libssl.dylib']) {
            const fpath = path.join(libDir, name);
            if (fs.existsSync(fpath) && fs.statSync(fpath).size === 0) {
                const realName = name.replace('.dylib', '.1.0.0.dylib');
                const realPath = path.join(libDir, realName);
                if (fs.existsSync(realPath)) {
                    fs.copyFileSync(realPath, fpath);
                    fixed++;
                }
            }
        }
    }
    console.log(`[fix-build] Fixed ${fixed} existing symlink files`);
}

function patch7zaExtraction() {
    const appBuilderPath = path.join(__dirname, 'node_modules', 'app-builder-bin', 'win', 'x64', 'app-builder.exe');
    if (!fs.existsSync(appBuilderPath)) {
        console.log('[fix-build] app-builder.exe not found, trying app-builder-lib');
        return;
    }
    
    const sevenZipPath = path.join(__dirname, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
    const backupPath = path.join(__dirname, 'node_modules', '7zip-bin', 'win', 'x64', '7za-original.exe');
    
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(sevenZipPath, backupPath);
        console.log('[fix-build] Backed up original 7za.exe');
    }
    
    const wrapperScript = path.join(__dirname, 'node_modules', '7zip-bin', 'win', 'x64', '7za-wrapper.js');
    fs.writeFileSync(wrapperScript, `
const {execFileSync} = require('child_process');
const args = process.argv.slice(2).filter(a => a !== '-snld');
try {
    const result = execFileSync('${backupPath.replace(/\\/g, '\\\\')}', args, {stdio: 'inherit'});
    process.exit(0);
} catch(e) {
    process.exit(e.status || 1);
}
`);
    
    const batchWrapper = path.join(__dirname, 'node_modules', '7zip-bin', 'win', 'x64', '7za.cmd');
    fs.writeFileSync(batchWrapper, `@echo off\r\nnode "${wrapperScript}" %*\r\n`);
    
    console.log('[fix-build] Created 7za wrapper (strips -snld flag)');
}

fixExistingCache();
patch7zaExtraction();
console.log('[fix-build] Done');
