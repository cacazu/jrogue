/* SPDX-License-Identifier: GPL-2.0-only */
#include "web-semantic.h"

void ab_semantic_message(const char *id)
{
#ifdef __EMSCRIPTEN__
	ab_host_message(id, ab_rs_message(id));
#else
	/* Native builds retain the unmodified English message path. */
	(void)id;
#endif
}
