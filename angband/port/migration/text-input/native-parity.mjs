/* Reconstruct the byte-identical original default editor, not a C reformatter. */
export function reconstructTextInput(source) {
 return source
  .replace(/\/\* AB_TEXT_BRANCH_BEGIN \*\/[\s\S]*?\/\* AB_TEXT_BRANCH_END \*\//g, '')
  .replace(/#ifdef __EMSCRIPTEN__ \/\* AB_TEXT_PURE \*\/[\s\S]*?#endif \/\* AB_TEXT_PURE \*\/(?:\r\n|\n)?/g, '');
}
