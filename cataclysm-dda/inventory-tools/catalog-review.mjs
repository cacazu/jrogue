#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parsePo, auditPoEntry, placeholderSignature } from './inventory.mjs';

const [sourceFile, output] = process.argv.slice(2);
if (!sourceFile || !output) throw new Error('Usage: node catalog-review.mjs <ja.po> <output-directory>');
const parsed = parsePo(fs.readFileSync(sourceFile, 'utf8'), 'lang/po/ja.po');
if (parsed.errors.length) throw new Error(JSON.stringify(parsed.errors));
const active = parsed.entries.filter(entry => !entry.obsolete && entry.singular !== '');
const missing = active.filter(entry => !entry.flags.includes('fuzzy') && (!Object.values(entry.translations).length || Object.values(entry.translations).some(text => !text) || (entry.plural !== null && Object.keys(entry.translations).length !== parsed.nplurals)));
const audit = active.map(entry => ({ ...entry, findings: auditPoEntry(entry) })).filter(entry => entry.findings.length);
const rejects = audit.filter(entry => entry.findings.some(finding => finding.severity === 'reject'));
const review = audit.filter(entry => entry.findings.some(finding => finding.severity === 'review'));
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'ja-missing.json'), JSON.stringify({ schemaVersion: 1, source: path.resolve(sourceFile), language: parsed.language, pluralForms: parsed.pluralForms, count: missing.length, entries: missing }, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'ja-rejected-placeholders.json'), JSON.stringify({ schemaVersion: 1, source: path.resolve(sourceFile), count: rejects.length, entries: rejects }, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'ja-placeholder-review.json'), JSON.stringify({ schemaVersion: 1, source: path.resolve(sourceFile), count: review.length, entries: review }, null, 2) + '\n');
const printfRejects = rejects.filter(entry => entry.findings.some(finding => finding.severity === 'reject' && finding.type === 'printf'));
const dynamicRejects = rejects.filter(entry => entry.findings.some(finding => finding.severity === 'reject' && finding.type === 'tags'));
console.log(JSON.stringify({ active: active.length, missing: missing.length, fuzzy: active.filter(entry => entry.flags.includes('fuzzy')).length, pluralEntries: active.filter(entry => entry.plural !== null).length, rejectedEntries: rejects.length, printfRejectedEntries: printfRejects.length, dynamicTagRejectedEntries: dynamicRejects.length, reviewEntries: review.length, missingPlaceholderSignatures: missing.slice(0, 3).map(entry => placeholderSignature(entry.singular)) }, null, 2));
