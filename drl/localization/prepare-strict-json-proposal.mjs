/** Source-only guarded proposal. Does not change canonical units or run Pascal. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {scanSource} from '../port/tools/inventory-texts.mjs';
const here=new URL('./',import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
let canonical=readFileSync(new URL('drlsemanticfeelings.pas',here),'utf8');
const expected='361aee5f2f59c8e93bcb9dabd16d92ce9eecbd20c8c955ebccf9646e15246828';
if(hash(Buffer.from(canonical))!==expected){
 canonical=readFileSync(new URL('strict-json-proposal/original-drlsemanticfeelings.pas',here),'utf8');
 if(hash(Buffer.from(canonical))!==expected)throw Error('Frozen JSON proposal source changed');
}
const marker='{ Bound lexical nesting before the standard recursive parser.';
const offset=canonical.indexOf(marker);if(offset<0||canonical.indexOf(marker,offset+1)>=0)throw Error('JSON proposal insertion guard changed');
const helper=String.raw`{ The pinned FCL scanner accepts backslash-apostrophe and raw control bytes
  20..31 inside strings even with joStrict. Guard raw JSON text before decoding.
  This pass is linear and constant-memory; the existing FCL scanner/parser still
  enforce structure, bounded nesting/tokens, Unicode, duplicate keys and schema. }
function ValidRawJSONStrings(const aData: RawByteString): Boolean;
var i,j: SizeInt; inString: Boolean; ch: Byte;
begin
  Result := False; i := 1; inString := False;
  while i <= Length(aData) do begin
    ch := Ord(aData[i]);
    if inString then begin
      if ch = $22 then inString := False
      else if ch = $5C then begin
        Inc(i); if i > Length(aData) then Exit;
        case aData[i] of
          '"','\','/','b','f','n','r','t': ;
          'u': for j := 1 to 4 do begin
            Inc(i); if i > Length(aData) then Exit;
            if not (aData[i] in ['0'..'9','a'..'f','A'..'F']) then Exit;
          end;
        else Exit; end;
      end else if ch < $20 then Exit;
    end else begin
      if ch = $22 then inString := True
      else if (ch < $20) and not (ch in [9,10,13]) then Exit;
    end;
    Inc(i);
  end;
  Result := not inString;
end;

`;
const from='  if not ValidUTF8(aData, DRL_FEELING_MAX_JSON_BYTES) then Exit;';
if(canonical.indexOf(from)<0||canonical.indexOf(from,canonical.indexOf(from)+1)>=0)throw Error('JSON proposal call guard changed');
const to=from+'\n  if not ValidRawJSONStrings(aData) then Exit;';
let proposal=canonical.slice(0,offset)+helper+canonical.slice(offset);
proposal=proposal.replace(from,to);
if(scanSource(proposal,'pascal').diagnostics.length)throw Error('Proposal Pascal lexical diagnostics');
if(proposal.replace(to,from).replace(helper,'')!==canonical)throw Error('Proposal does not reverse to exact frozen source');
const directory=new URL('strict-json-proposal/',here);mkdirSync(directory,{recursive:true});
writeFileSync(new URL('drlsemanticfeelings.pas',directory),proposal);
const result={schema:1,canonicalSourceSha256:expected,proposalSha256:hash(Buffer.from(proposal)),canonicalChanged:false,nativeCompilationOrExecutionPerformed:false,sourceGuardRoundtrip:true,changes:['constant-memory raw JSON string escape whitelist','unescaped string control bytes below 32 rejected','outside-string controls restricted to tab/CR/LF; spaces remain valid'],actualNativeVerification:'run native-json-contract-probe and native sidecar probes against proposal after frozen diagnostic'};
writeFileSync(new URL('proposal.json',directory),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
