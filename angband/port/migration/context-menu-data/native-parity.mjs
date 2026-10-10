/* SPDX-License-Identifier: GPL-2.0-only */
// Remove only explicitly owned context annotations; retained expressions are
// the original source bytes, including conditional branches and macro args.
export function reconstructContext(source) {
 const begins = (source.match(/\/\* AB_CONTEXT_BEGIN \*\//g) ?? []).length;
 const ends = (source.match(/\/\* AB_CONTEXT_END \*\//g) ?? []).length;
 if (begins !== ends) throw new Error('unbalanced context source annotation');
 return source.replace(/\/\* AB_CONTEXT_BEGIN \*\/[\s\S]*?\/\* AB_CONTEXT_END \*\//g, '');
}