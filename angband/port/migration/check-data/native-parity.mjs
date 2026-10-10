/* Exact additive annotations: stripping preserves original native bytes. */
export function stripChecks(source) {
 return source.replace(/\/\* AB_CHECK_BEGIN \*\/[\s\S]*?\/\* AB_CHECK_END \*\//g,'');
}
