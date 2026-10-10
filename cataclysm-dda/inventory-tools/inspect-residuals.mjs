import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
console.log(JSON.stringify({ sourceCounts: JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).sourceCounts, sourceStems: [...new Set(manifest.unclassifiedSources.map(entry => entry.file.replace(/^src\//, '').replace(/\.(?:cpp|h)$/, '')))], dataTypes: manifest.unclassifiedTypes.map(entry => [entry.type, entry.count]) }, null, 2));
