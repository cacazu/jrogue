/* AB_GAME_DYNAMIC_BEGIN */
#include "web-dynamic-text.h"
/* AB_GAME_DYNAMIC_END *//**
 * \file obj-properties.c
 * \brief functions to deal with object properties
 *
 * Copyright (c) 2014 Chris Carr, Nick McConnell
 *
 * This work is free software; you can redistribute it and/or modify it
 * under the terms of either:
 *
 * a) the GNU General Public License as published by the Free Software
 *    Foundation, version 2, or
 *
 * b) the "Angband licence":
 *    This software may be copied and distributed for educational, research,
 *    and not for profit purposes provided that this copyright and statement
 *    are included in all such copies.  Other copyrights may also apply.
 */
#include "angband.h"/* AB_UI_RESIDUAL_BEGIN */
#ifdef __EMSCRIPTEN__

#include "web-ui-residual-text.h"
#include "web-death-cause.h"
#include "web-interface-text.h"
#endif
/* AB_UI_RESIDUAL_END */
#include "init.h"
#include "object.h"

struct obj_property *obj_properties;

struct obj_property *lookup_obj_property(int type, int index)
{
	struct obj_property *prop;
	int i;

	/* Find the right property */
	for (i = 0; i < z_info->property_max; i++) {
		prop = &obj_properties[i];
		if ((prop->type == type) && (prop->index == index)) {
			return prop;
		}

		/* Special case - stats count as mods */
		if ((type == OBJ_PROPERTY_MOD) && (prop->type == OBJ_PROPERTY_STAT)
			&& (prop->index == index)) {
			return prop;
		}
	}

	return NULL;
}

/**
 * Create a "mask" of object flags of a specific type or ID threshold.
 *
 * \param f is the flag array we're filling
 * \param id is whether we're masking by ID level
 * \param ... is the list of flags or ID types we're looking for
 *
 * N.B. OFT_MAX must be the last item in the ... list
 */
void create_obj_flag_mask(bitflag *f, int id, ...)
{
	int i, j;
	va_list args;

	of_wipe(f);

	va_start(args, id);

	/* Process each type in the va_args */
    for (i = va_arg(args, int); i != OFT_MAX; i = va_arg(args, int)) {
		for (j = 1; j < z_info->property_max; j++) {
			struct obj_property *prop = &obj_properties[j];
			if (prop->type != OBJ_PROPERTY_FLAG) continue;
			if ((id && prop->id_type == i) || (!id && prop->subtype == i)) {
				of_on(f, prop->index);
			}
		}
	}

	va_end(args);

	return;
}

/**
 * Print a message when an object flag is identified by use.
 *
 * \param flag is the flag being noticed
 * \param name is the object name 
 */
void flag_message(int flag, char *name)
{
	struct obj_property *prop = lookup_obj_property(OBJ_PROPERTY_FLAG, flag);
	char buf[1024] = "\0";
	const char *next;
	const char *s;
	const char *tag;
	const char *in_cursor;
	size_t end = 0;

	/* See if we have a message */
	if (!prop) {
		if (flag < 0 || flag >= OF_MAX) {
			/* AB_GAME_DYNAMIC_BEGIN */
#ifdef __EMSCRIPTEN__
ab_dynamic_msg("game.message.obj_properties.flag_message.bug_invalid_flag_index_index_passed_to_flag_message", "index:I;", "Bug: invalid flag index, %d, passed to "
				"flag_message().", flag);
#else
/* AB_GAME_DYNAMIC_END */msg("Bug: invalid flag index, %d, passed to "
				"flag_message().", flag);/* AB_GAME_DYNAMIC_BEGIN */
#endif
/* AB_GAME_DYNAMIC_END */
		} else {
			/* AB_UI_RESIDUAL_BEGIN */AB_UR_BEFORE((ab_ur_message("ui.residual.diagnostic.flag",MSG_GENERIC,(const struct ab_ui_param[]){AB_UI_OPAQUE("flag","canonical_identity",list_obj_flag_names[flag]),AB_UI_INT("index",flag)},2)),/* AB_UI_RESIDUAL_END */msg("Bug: flag '%s' (index %d) noticed but has "
				"no entry in object_property.txt.",
				list_obj_flag_names[flag], flag)/* AB_UI_RESIDUAL_BEGIN */)/* AB_UI_RESIDUAL_END */;
		}
		return;
	}
	if (!prop->msg) return;
	in_cursor = prop->msg;

	next = strchr(in_cursor, '{');
	while (next) {
		/* Copy the text leading up to this { */
		strnfcat(buf, 1024, &end, "%.*s", (int) (next - in_cursor),
			in_cursor);

		s = next + 1;
		while (*s && isalpha((unsigned char) *s)) s++;

		/* Valid tag */
		if (*s == '}') {
			/* Start the tag after the { */
			tag = next + 1;
			in_cursor = s + 1;
			if (strncmp(tag, "name", 4) == 0) {
				strnfcat(buf, 1024, &end, "%s", name); 
			}

		} else {
			/* An invalid tag, skip it */
			in_cursor = next + 1;
		}

		next = strchr(in_cursor, '{');
	}
	strnfcat(buf, 1024, &end, "%s", in_cursor);

	/* AB_UI_RESIDUAL_BEGIN */AB_UR_BEFORE((ab_ur_property_message(flag,name)),/* AB_UI_RESIDUAL_END */msg("%s", buf)/* AB_UI_RESIDUAL_BEGIN */)/* AB_UI_RESIDUAL_END */;
}

/**
 * Return the sustain flag of a given stat.
 */
int sustain_flag(int stat)
{
	if (stat < 0 || stat >= STAT_MAX) return -1;

	return stat + 1;
}
