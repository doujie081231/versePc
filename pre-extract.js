const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const cacheDir = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'winCodeSign');

function fixExisting() {
    if (!fs.existsSync(cacheDir)) return 0;
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
    return fixed;
}

function preExtract() {
    const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.7z'));
    let extracted = 0;
    for (const f of files) {
        const dirName = f.replace('.7z', '');
        const targetDir = path.join(cacheDir, dirName);
        if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) continue;
        const sevenZip = path.join(__dirname, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
        try {
            execSync(`"${sevenZip}" x -bd "${path.join(cacheDir, f)}" "-o${targetDir}"`, {timeout: 30000, windowsHide: true, stdio: 'ignore'});
            extracted++;
        } catch(e) {}
    }
    return extracted;
}

const fixed1 = fixExisting();
const extracted = preExtract();
const fixed2 = fixExisting();
console.log(`Pre-extracted: ${extracted}, Fixed symlinks: ${fixed1 + fixed2}`);
