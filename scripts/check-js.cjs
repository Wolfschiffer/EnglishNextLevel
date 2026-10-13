const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'js');

function collectJavaScriptFiles(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectJavaScriptFiles(entryPath);
        return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
    });
}

const files = collectJavaScriptFiles(sourceRoot);
for (const file of files) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}

process.stdout.write(`Syntax check passed for ${files.length} JavaScript files.\n`);
