/* SPDX-License-Identifier: GPL-3.0-or-later. Source-only reversible derivative. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const expected='83364976d5858620be91d057a0cdb6909e5a121074c10e860b9f0cc92410e209';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const [input,out]=process.argv.slice(2);
if(!input||!out)throw Error('usage: node generate-focus-derivative.mjs physical_input.c NEW_OUTPUT_DIRECTORY');
const bytes=await fs.readFile(input);if(sha(bytes)!==expected)throw Error('textbox.error.source_guard');
const source=bytes.toString('utf8');if(!Buffer.from(source).equals(bytes))throw Error('textbox.error.source_guard');
const begin='static int focused_unicode(int *dialog_count) {';
const end='static const void *game_identity(void) {';
const a=source.indexOf(begin),b=source.indexOf(end);
if(a<0||b<=a||source.indexOf(begin,a+1)>=0||source.indexOf(end,b+1)>=0)throw Error('textbox.error.source_guard');
const old=source.slice(a,b),newline=source.includes('\r\n')?'\r\n':'\n';
const replacement=['static int focused_unicode(int *dialog_count) {',
  '    return tome_textbox_nested_focused_unicode(dialog_count,NULL);','}', ''].join(newline);
const anchor='#include "sdl_private_input_2_32_10.h"';
if(source.split(anchor).length!==2)throw Error('textbox.error.source_guard');
const derivative=source.slice(0,a)+replacement+source.slice(b);
const projected=derivative.replace(anchor,anchor+newline+'#include "tome_nested_focus.h"');
const reversed=projected.replace(anchor+newline+'#include "tome_nested_focus.h"',anchor).replace(replacement,old);
if(reversed!==source)throw Error('textbox.error.source_guard');
const original=await fs.realpath(input),parent=await fs.realpath(path.dirname(path.resolve(out)));
const target=path.join(parent,path.basename(out));
if(path.resolve(original).toLowerCase()===path.join(target,'physical_input.c').toLowerCase())throw Error('textbox.error.source_guard');
await fs.mkdir(target); /* exclusive fresh directory; never overwrite a live variant */
await fs.writeFile(path.join(target,'physical_input.c'),projected,{flag:'wx'});
await fs.writeFile(path.join(target,'physical_input.original.c'),bytes,{flag:'wx'});
await fs.writeFile(path.join(target,'manifest.json'),JSON.stringify({schema_version:1,
  original_path:original,original_sha256:expected,derivative_sha256:sha(Buffer.from(projected)),
  edits:['include additive bounded raw-focus observer','replace one-level focus query only'],
  reverse_byte_equality:true,upstream_commit:'624a67329fe2ad440c5b344785a9c73fcf22ae63'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({source_ready:true,output:target,sha256:sha(Buffer.from(projected))}));
