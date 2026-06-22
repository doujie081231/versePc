const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const sevenZipDir = path.join(__dirname, 'node_modules', '7zip-bin', 'win', 'x64');
const real7za = path.join(sevenZipDir, '7za.exe');
const backup7za = path.join(sevenZipDir, '7za-real.exe');

if (!fs.existsSync(backup7za)) {
    fs.copyFileSync(real7za, backup7za);
    console.log('Backed up 7za.exe to 7za-real.exe');
}

const wrapperCode = `const { execFileSync } = require('child_process');
const path = require('path');
const realExe = path.join(__dirname, '7za-real.exe');
const args = process.argv.slice(2).filter(a => a !== '-snld');
try {
    execFileSync(realExe, args, { stdio: 'inherit' });
    process.exit(0);
} catch(e) {
    process.exit(e.status || 1);
}
`;

fs.writeFileSync(path.join(sevenZipDir, '7za-wrapper.js'), wrapperCode);
console.log('Created 7za-wrapper.js');

// Try to create a minimal .exe that launches our wrapper
// Use node to compile a standalone exe
try {
    // Create a .cmd file first
    const cmdPath = path.join(sevenZipDir, '7za.cmd');
    fs.writeFileSync(cmdPath, `@echo off\r\nnode "%~dp07za-wrapper.js" %*\r\n`);
    console.log('Created 7za.cmd');

    // Now try to use the Windows 'mklink' to create a junction
    // Actually, let's try to create a .exe using IExpress or similar
    
    // Simplest approach: use node to create a self-contained script
    // and then use a PE builder
    
    // Actually, the simplest approach is to use 'pkg' to build a small exe
    // Let's check if pkg is available
    try {
        execFileSync('npx', ['pkg', '--version'], { stdio: 'pipe' });
        console.log('pkg is available');
    } catch(e) {
        console.log('pkg not available, trying alternative approach');
    }
} catch(e) {
    console.log('Error:', e.message);
}

console.log('Done - but app-builder.exe calls 7za.exe directly');
console.log('Need to find a way to intercept the call');
