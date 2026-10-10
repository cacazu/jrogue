// GPL-3.0-or-later. Two reviewed presentation contracts; no general relaxation.
export const sourceCommit='624a67329fe2ad440c5b344785a9c73fcf22ae63';
export const precisionOwners=new Map([
 ['game.modules.tome.mod.class.uiset.classicplayerdisplay.method.display.maketexturebar.tformat.parameter',
  {source:'%-8.8s:',tag:'tformat',target:'%s：',argument_index:1,source_specifiers:['%-8.8s'],target_specifiers:['%s'],source_types:['s'],target_types:['s']}],
 ['game.modules.tome.mod.dialogs.charactersheet.method.drawdialog.tformat.parameter_parameter_parameter',
  {source:'%s%-8.8s: #00ff00#%s ',tag:'tformat',target:'%s%s： #00ff00#%s ',argument_index:2,source_specifiers:['%s','%-8.8s','%s'],target_specifiers:['%s','%s','%s'],source_types:['s','s','s'],target_types:['s','s','s']}],
]);

export function printfSpecifiers(text,tag){
 const input=text.replace(/%%/g,'');
 return [...input.matchAll(/%(?:\d+\$)?[-+ #0]*\d*(?:\.\d+)?[cdiouxXeEfgGqsaA]/g)]
  .filter(match=>tag==='tformat'||!(match[0].includes(' ')&&/[0-9]/.test(input[match.index-1]??'')))
  .map(match=>match[0]);
}
export function conversionTypes(specifiers){
 return specifiers.map(specifier=>/[sq]$/.test(specifier)?'s':'n');
}
export function markupTokens(text){
 return text.match(/#[A-Za-z0-9_]+#|#\{[^}]*\}#|@[A-Za-z_.]+@/g)??[];
}
