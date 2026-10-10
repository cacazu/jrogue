// GPL-3.0-or-later. Recognize only complete literal runtime source expressions.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { lexLua } from './lua-lexer.mjs';

export function directLiteralHooks(tokens) {
  const pairs = new Map(), stack = [], hooks = new Map();
  for (let index=0; index<tokens.length; index++) {
    const token=tokens[index];
    if (token.type === 'string') continue;
    if (['(', '[', '{'].includes(token.value)) stack.push(index);
    else if ([')', ']', '}'].includes(token.value)) {
      const open=stack.pop();
      if (open !== undefined) { pairs.set(open,index); pairs.set(index,open); }
    }
  }
  const literal = (start,end) => {
    while (tokens[start]?.value === '(' && pairs.get(start) === end-1) { start++; end--; }
    return end === start+1 && tokens[start]?.type === 'string' ? tokens[start] : null;
  };
  const argumentsOf = open => {
    const close=pairs.get(open), args=[];
    if (close === undefined) return args;
    let start=open+1;
    for (let index=start; index<close; index++) {
      if (tokens[index].type !== 'string' && ['(', '[', '{'].includes(tokens[index].value)) index=pairs.get(index) ?? close;
      else if (tokens[index].type !== 'string' && tokens[index].value === ',') { args.push([start,index]); start=index+1; }
    }
    if (start < close) args.push([start,close]);
    return args;
  };
  for (let index=0; index<tokens.length; index++) {
    const token=tokens[index];
    if (token.type !== 'identifier') continue;
    if (token.value === '_t' && !['.',':'].includes(tokens[index-1]?.value)) {
      if (tokens[index+1]?.type === 'string') hooks.set(tokens[index+1].start,{hook:'_t_sugar',tag:'_t'});
      else if (tokens[index+1]?.value === '(') {
        const args=argumentsOf(index+1), source=args[0] && literal(...args[0]);
        if (!source) continue;
        const tag=args[1] && literal(...args[1]);
        const omitted=!args[1] || args[1][1] === args[1][0]+1 && ['nil','false'].includes(tokens[args[1][0]].value);
        hooks.set(source.start,{hook:'_t_call',tag:tag?.value ?? (omitted ? '_t' : null),dynamic_tag:!tag && !omitted});
      }
    } else if (token.value === 'tformat' && tokens[index-1]?.value === ':' && tokens[index+1]?.value === '(') {
      const end=index-1, last=end-1;
      const start=tokens[last]?.type === 'symbol' && tokens[last]?.value === ')' ? pairs.get(last) : last;
      const source=start !== undefined && literal(start,end);
      if (source) hooks.set(source.start,{hook:'tformat_method',tag:'tformat'});
    } else if (token.value === 'tformat' && tokens[index-1]?.value === '.' && tokens[index-2]?.value === 'string' && !['.',':'].includes(tokens[index-3]?.value) && tokens[index+1]?.value === '(') {
      const args=argumentsOf(index+1), source=args[0] && literal(...args[0]);
      if (source) hooks.set(source.start,{hook:'tformat_function',tag:'tformat'});
    }
  }
  return hooks;
}

if (process.argv.includes('--self-test') && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const check = (code, expected) => assert.deepEqual([...directLiteralHooks(lexLua(code).tokens)].map(([offset,hook])=>({source:lexLua(code).tokens.find(token=>token.start===offset).value,...hook})),expected);
  check('_t("literal", "context")',[{source:'literal',hook:'_t_call',tag:'context',dynamic_tag:false}]);
  check('_t(("literal"))',[{source:'literal',hook:'_t_call',tag:'_t',dynamic_tag:false}]);
  check('_t "literal" .. variable',[{source:'literal',hook:'_t_sugar',tag:'_t'}]);
  check('_t(node["answer"..i])',[]);
  check('_t(player:descriptorDisplayName("subrace") or "", "birth descriptor name")',[]);
  check('_t(tt.type:gsub("/.*", ""), "talent category")',[]);
  check('_t("a".."b")',[]);
  check('("format %s"):tformat(name)',[{source:'format %s',hook:'tformat_method',tag:'tformat'}]);
  check('("prefix "..name):tformat()',[]);
  check('_t("source", runtimeTag)',[{source:'source',hook:'_t_call',tag:null,dynamic_tag:true}]);
  check('string.tformat("format %d", 1)',[{source:'format %d',hook:'tformat_function',tag:'tformat'}]);
  check('_t(",", nil)',[{source:',',hook:'_t_call',tag:'_t',dynamic_tag:false}]);
  console.log('Direct literal hook fixture: 12 assertions passed.');
}
