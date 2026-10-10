import { readFile } from 'node:fs/promises';
const argument = process.argv[2];
if (!argument) throw new Error('Supply a JSON command or --file <path>.');
const text = argument === '--file' ? await readFile(process.argv[3], 'utf8') : argument;
const command = JSON.parse(text);
const response = await fetch('http://127.0.0.1:8890/', { method: 'POST', body: JSON.stringify(command), signal: AbortSignal.timeout(75000) });
const result = await response.json();
console.log(JSON.stringify(result, null, 2));
if (!response.ok) process.exitCode = 1;
