/* Independently authored GPL-3.0-or-later reversible source generator.
 * SOURCE ONLY in this handoff. Parent owns execution/fixtures/native integration.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const baseline = {
  Textbox: '9d02393e88f968edcec308bd2fd6870d9dce8c7e0a6c326d3ed212759c233dda',
  UIGroup: 'd2c9aa3c96856b6012fefc3955899737f7b3297963931694d6c98baef2b95da2',
  Numberbox: '62b1609ed5cd4a00f009e6f3fb7bea3732cc80f2a5318043d92c788f180407fd',
};
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const here = path.dirname(fileURLToPath(import.meta.url));
const [engineArgument, outputArgument, ...extra] = process.argv.slice(2);
if (!engineArgument || !outputArgument || extra.length) {
  throw new Error('Usage: node generate-overlay.mjs <original-engine-directory> <new-output-directory>');
}
const engine = fs.realpathSync(engineArgument);
const requestedOutput = path.resolve(outputArgument);
// Require an existing parent and resolve its junctions before comparing. The
// final directory is new/exclusive; no recursive creation inside unknown paths.
const outputParent = fs.realpathSync(path.dirname(requestedOutput));
const output = path.join(outputParent, path.basename(requestedOutput));
const comparisonPath = value => process.platform === 'win32' ? value.toLowerCase() : value;
const within = (child, parent) => {
  const candidate = comparisonPath(child);
  const boundary = comparisonPath(parent);
  return candidate === boundary || candidate.startsWith(boundary + path.sep);
};
if (within(output, engine) || within(engine, output)) throw new Error('Output must be separate from pristine input.');
if (fs.existsSync(output)) throw new Error('Output directory must not exist; create a distinct reviewable generation.');
const originals = {};
for (const name of Object.keys(baseline)) {
  const bytes = fs.readFileSync(path.join(engine, 'ui', name + '.lua'));
  if (sha(bytes) !== baseline[name]) throw new Error('Unknown original source: ' + name);
  const source = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
  if (Buffer.from(source, 'utf8').compare(bytes) !== 0) throw new Error('Non-roundtrippable UTF-8 source: ' + name);
  originals[name] = {bytes, source};
}
const edits = [];
function replaceOne(source, before, after, id) {
  const at = source.indexOf(before);
  if (at < 0 || source.indexOf(before, at + before.length) >= 0) throw new Error('Source guard failed: ' + id);
  edits.push({id, before, after});
  return source.slice(0, at) + after + source.slice(at + before.length);
}
let textbox = originals.Textbox.source;
textbox = replaceOne(textbox,
  'local Focusable = require "engine.ui.Focusable"\n',
  'local Focusable = require "engine.ui.Focusable"\nlocal tome_utf8 = require "engine.ui.UTF8TextboxPresentation"\n',
  'textbox.require');
textbox = replaceOne(textbox,
  'function _M:setText(text)\n\tself.text = text\n\tself.tmp = {}\n\tfor i = 1, #self.text do self.tmp[#self.tmp+1] = self.text:sub(i, i) end\n',
  'function _M:setText(text)\n\tlocal items = tome_utf8.require_items(text)\n\tself.text = text\n\tself.tmp = items\n',
  'textbox.setText');
textbox = replaceOne(textbox,
  '\tself.tmp = {}\n\tfor i = 1, #self.text do self.tmp[#self.tmp+1] = self.text:sub(i, i) end\n',
  '\tself.tmp = tome_utf8.require_items(self.text)\n',
  'textbox.init');
textbox = replaceOne(textbox,
  '\t\t\tself.cursor = util.bound(math.floor(bx / self.font_mono_w) + self.scroll, 1, #self.tmp+1)\n',
  '\t\t\tself.cursor = tome_utf8.cursor_at_pixel(self, bx)\n',
  'textbox.mouse_cursor');
textbox = replaceOne(textbox,
  '\t\t__TEXTINPUT = function(c)\n\t\t\tif #self.tmp < self.max_len then\n\t\t\t\tif self.filter(c) then\n\t\t\t\t\ttable.insert(self.tmp, self.cursor, self.filter(c))\n\t\t\t\t\tself.cursor = self.cursor + 1\n\t\t\t\t\tself.scroll = util.scroll(self.cursor, self.scroll, self.max_display)\n\t\t\t\t\tself:updateText()\n\t\t\t\tend\n\t\t\tend\n\t\tend,\n',
  '\t\t__TEXTINPUT = function(c)\n\t\t\ttome_utf8.commit(self, c, util)\n\t\tend,\n',
  'textbox.commit');
textbox = replaceOne(textbox,
  '\t\t[{"_v", "ctrl"}] = function(c)\n\t\t\tlocal s = core.key.getClipboard()\n\t\t\tif s then\n\t\t\t\tfor i = 1, #s do\n\t\t\t\t\tif #self.tmp >= self.max_len then break end\n\t\t\t\t\tlocal c = string.sub(s, i, i)\n\t\t\t\t\ttable.insert(self.tmp, self.cursor, self.filter(c))\n\t\t\t\t\tself.cursor = self.cursor + 1\n\t\t\t\t\tself.scroll = util.scroll(self.cursor, self.scroll, self.max_display)\n\t\t\t\tend\n\t\t\t\tself:updateText()\n\t\t\tend\n\t\tend,\n',
  '\t\t[{"_v", "ctrl"}] = function(c)\n\t\t\tlocal s = core.key.getClipboard()\n\t\t\tif s then tome_utf8.paste(self, s, util) end\n\t\tend,\n',
  'textbox.paste');
textbox = replaceOne(textbox,
  '\t\tlocal cursor_x = self.font_mono:size(self.text:sub(self.scroll, self.cursor - 1))\n',
  '\t\tlocal cursor_x = self.font_mono:size(tome_utf8.cursor_text(self))\n',
  'textbox.cursor_prefix');

let group = originals.UIGroup.source;
group = replaceOne(group,
  'require "engine.class"\r\n',
  'require "engine.class"\r\nlocal tome_utf8 = require "engine.ui.UTF8TextboxPresentation"\r\n',
  'group.require');
if (group.includes('textInputPresentationState')) throw new Error('Unknown preexisting UIGroup method.');
const groupSuffix = '\r\n-- Read-only actual nested focus projection; original callbacks remain unchanged.\r\nfunction _M:textInputPresentationState()\r\n\treturn tome_utf8.focus_state(self)\r\nend\r\n';
edits.push({id:'group.readonly_focus', before:'', after:groupSuffix, append:true});
group += groupSuffix;

const helper = fs.readFileSync(path.join(here, 'UTF8TextboxPresentation.lua'));
new TextDecoder('utf-8', {fatal:true}).decode(helper);
const generated = {
  'engine/ui/Textbox.lua': Buffer.from(textbox, 'utf8'),
  'engine/ui/UIGroup.lua': Buffer.from(group, 'utf8'),
  'engine/ui/UTF8TextboxPresentation.lua': helper,
};

// Reverse every concrete substitution before any write. No global replacements.
let reverseTextbox = textbox;
let reverseGroup = group;
for (let index = edits.length - 1; index >= 0; index--) {
  const edit = edits[index];
  let source = edit.id.startsWith('textbox.') ? reverseTextbox : reverseGroup;
  if (edit.append) {
    if (!source.endsWith(edit.after)) throw new Error('Reverse append guard failed.');
    source = source.slice(0, -edit.after.length);
  } else {
    const at = source.indexOf(edit.after);
    if (at < 0 || source.indexOf(edit.after, at + edit.after.length) >= 0) throw new Error('Reverse uniqueness failed: ' + edit.id);
    source = source.slice(0, at) + edit.before + source.slice(at + edit.after.length);
  }
  if (edit.id.startsWith('textbox.')) reverseTextbox = source; else reverseGroup = source;
}
if (Buffer.from(reverseTextbox).compare(originals.Textbox.bytes) || Buffer.from(reverseGroup).compare(originals.UIGroup.bytes)) {
  throw new Error('Byte-for-byte reverse check failed.');
}

// All guards and byte reversal passed; only now write a new standalone overlay.
fs.mkdirSync(output);
for (const [relative, bytes] of Object.entries(generated)) {
  const destination = path.join(output, relative);
  fs.mkdirSync(path.dirname(destination), {recursive:true});
  fs.writeFileSync(destination, bytes, {flag:'wx'});
}
fs.mkdirSync(path.join(output, 'originals'));
for (const [name, original] of Object.entries(originals)) {
  fs.writeFileSync(path.join(output, 'originals', name + '.lua'), original.bytes, {flag:'wx'});
}
const manifest = {
  schema_version:1, source_commit:'624a67329fe2ad440c5b344785a9c73fcf22ae63',
  original_version:'ToME 1.7.6', source_only:true, runtime_verified:false,
  originals:Object.fromEntries(Object.entries(baseline).map(([name,hash])=>[name,{sha256:hash, file:'originals/'+name+'.lua'}])),
  files:Object.fromEntries(Object.entries(generated).map(([file,bytes])=>[file,{sha256:sha(bytes),bytes:bytes.length}])),
  substitutions:edits, reverse_byte_check:true,
  routes:[
    {module:'engine.ui.Textbox', archive_relative_path:'engine/ui/Textbox.lua'},
    {module:'engine.ui.UIGroup', archive_relative_path:'engine/ui/UIGroup.lua'},
    {module:'engine.ui.UTF8TextboxPresentation', archive_relative_path:'engine/ui/UTF8TextboxPresentation.lua'},
  ],
  unchanged_numeric_subclass:'engine.ui.Numberbox',
  limitations:['Unicode scalar policy; not grapheme editing','Numberbox custom __TEXTINPUT unchanged','Browser IME/mobile/clipboard delivery not changed','Original native CJK/font rendering needs actual browser proof'],
};
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest,null,2)+'\n', {flag:'wx'});
process.stdout.write(JSON.stringify({output, files:manifest.files, reverse_byte_check:true})+'\n');
