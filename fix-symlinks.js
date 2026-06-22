const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');
const cacheDir = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'winCodeSign');
if (!fs.existsSync(cacheDir)) { console.log('No cache dir'); process.exit(0); }
const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.7z'));
for (const f of files) {
    const dirName = f.replace('.7z', '');
    const targetDir = path.join(cacheDir, dirName);
    const sevenZip = path.join(__dirname, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
    try {
        execSync(`"${sevenZip}" x -bd "${path.join(cacheDir, f)}" "-o${targetDir}"`, {timeout: 30000, windowsHide: true, stdio: 'ignore'});
    } catch(e) {}
    const libDir = path.join(targetDir, 'darwin', '10.12', 'lib');
    if (fs.existsSync(libDir)) {
        for (const name of ['libcrypto.dylib', 'libssl.dylib']) {
            const fpath = path.join(libDir, name);
            if (fs.existsSync(fpath) && fs.statSync(fpath).size === 0) {
                const realName = name.replace('.dylib', '.1.0.0.dylib');
                const realPath = path.join(libDir, realName);
                if (fs.existsSync(realPath)) {
                    fs.copyFileSync(realPath, fpath);
                }
            }
        }
    }
}
console.log('Done');
