/* Remove only the exact added annotation spans; retain every original byte. */
export function stripResidual(source){return source.replace(/\/\* AB_UI_RESIDUAL_BEGIN \*\/[\s\S]*?\/\* AB_UI_RESIDUAL_END \*\//g,'');}
