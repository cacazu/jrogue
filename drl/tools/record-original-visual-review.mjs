import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'port/tests/output/original-game');
const reviewed={
  'pc-help-English.png':'188e3925d519f744fe8b29348490da0b2f36532d4cea4f67fad99fcb282cb303',
  'pc-initial.png':'35d11bc12a208abf163d6d28df8e522f9c11f9218c30499e6fd83fd01c301c7e',
  'pc-help-scrolled.png':'d52c17e7f901b20270df70e7bd9875e9ae07f5d147ba9ab218e7dc3eab1ed08c',
  'mobile-touch.png':'ee0d40732ae4466e37e64dc041923397011d68765e3faf555d47916d8633bf40',
  'mobile-fit-zoom.png':'3362d5cf4bf2c86424062b399a4b02dbc80ef7d9aac6a213f09e6c811e6ba752',
  'resumed-continuation.png':'8b9ee7d549c80a7546bb8b3970f70a2df69aff0fa2e3fa8711181c4385909f19',
};
const evidence=JSON.parse(fs.readFileSync(path.join(output,'evidence.json'),'utf8'));
if(evidence.result!=='pass'||evidence.artifacts['drl-core.wasm'].sha256!==
  '20e21dafe03105aaae03e821d94392f60ba655b8e9212a126554499213054d60')throw Error('Review is for the inspected original-game milestone only');
for(const shot of evidence.screenshots){
  const actual=createHash('sha256').update(fs.readFileSync(path.join(output,shot.file))).digest('hex');
  if(actual!==reviewed[shot.file]||actual!==shot.sha256)throw Error('Uninspected or changed screenshot: '+shot.file);
  shot.inspected=true;
}
const review={schema:1,recorded_utc:new Date().toISOString(),review_method:'Assistant viewed the current English Help and mobile-touch PNGs and verified four other PNGs byte-identical to independently viewed prior images; this records visual inspection, not an automated image assertion',
  core_sha256:evidence.artifacts['drl-core.wasm'].sha256,adapter_sha256:evidence.artifacts['drl_web_port.wasm'].sha256,
  screenshots:reviewed,findings:[
    'Japanese native HUD and scrolling help are readable, with glyph boundaries intact.',
    'The same open Help view renders the exact English paragraph and title after a language change.',
    'The exact external ASCII name BrowserMarine_5489 appears in the original HUD.',
    'Narrow mobile preserves the raw 80-column view with explicit horizontal scrolling; fit mode shows the full grid.',
    'Touch controls remain readable at 200% UI font and fit within the page.',
    'The native initial-floor movement hint and manual targeting caption now resolve through Japanese semantic IDs.',
    'Resuming resets the temporary UI fit/zoom selections; the narrow raw grid remains scrollable.',
  ],full_campaign_verified:false,complete_world_purity_witness:false,full_localization_complete:false};
fs.writeFileSync(path.join(root,'docs/ORIGINAL-GAME-VISUAL-QA.json'),JSON.stringify(review,null,2)+'\n');
fs.writeFileSync(path.join(output,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({reviewed_screenshots:Object.keys(reviewed).length,core_sha256:review.core_sha256}));
