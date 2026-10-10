/**
 * \file ui-curse.c
 * \brief Curse selection menu
 *
 * Copyright (c) 1997 Ben Harrison, James E. Wilson, Robert A. Koeneke
 * Copyright (c) 2016 Nick McConnell
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

#include "angband.h"
#include "web-interface-text.h" /* AB_INTERFACE_INCLUDE */
#include "init.h"
#include "obj-curse.h"
#include "obj-knowledge.h"
#include "ui-curse.h"
#include "ui-menu.h"
#include "ui-output.h"

static int selection;
#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */

static const struct {const char *name,*description,*name_id,*description_id;} ab_if_curse_refs[]={
 {NULL,NULL,NULL,NULL},
 {"air swing","makes it hard to hit anything","domain.curse.air_swing.name","domain.curse.air_swing.description"},
 {"steelskin","makes your skin harder to damage, but conduct electricity","domain.curse.steelskin.name","domain.curse.steelskin.description"},
 {"chilled to the bone","makes you vulnerable to cold attacks, but resistant to fire","domain.curse.chilled_to_the_bone.name","domain.curse.chilled_to_the_bone.description"},
 {"burning up","makes you vulnerable to fire attacks, but resistant to cold","domain.curse.burning_up.name","domain.curse.burning_up.description"},
 {"treacherous weapon","makes your weapon attack you","domain.curse.treacherous_weapon.name","domain.curse.treacherous_weapon.description"},
 {"anti-teleportation","prevents you from teleporting","domain.curse.anti_teleportation.name","domain.curse.anti_teleportation.description"},
 {"stone","periodically turns your skin to stone","domain.curse.stone.name","domain.curse.stone.description"},
 {"cowardice","makes you too scared to fight","domain.curse.cowardice.name","domain.curse.cowardice.description"},
 {"impair hitpoint recovery","makes you slow to recover hitpoints","domain.curse.impair_hitpoint_recovery.name","domain.curse.impair_hitpoint_recovery.description"},
 {"impair mana recovery","makes you slow to recover mana","domain.curse.impair_mana_recovery.name","domain.curse.impair_mana_recovery.description"},
 {"undead summon","occasionally summons an undead","domain.curse.undead_summon.name","domain.curse.undead_summon.description"},
 {"demon summon","occasionally summons a demon","domain.curse.demon_summon.name","domain.curse.demon_summon.description"},
 {"dragon summon","sometimes summons a dragon","domain.curse.dragon_summon.name","domain.curse.dragon_summon.description"},
 {"paralysis","paralyses you every now and then","domain.curse.paralysis.name","domain.curse.paralysis.description"},
 {"hallucination","makes you hallucinate sometimes","domain.curse.hallucination.name","domain.curse.hallucination.description"},
 {"siren","occasionally makes a loud noise","domain.curse.siren.name","domain.curse.siren.description"},
 {"poison","poisons you from time to time","domain.curse.poison.name","domain.curse.poison.description"},
 {"annoyance","wakes up and annoys nearby monsters, and delays your escape","domain.curse.annoyance.name","domain.curse.annoyance.description"},
 {"slowness","drags at your feet","domain.curse.slowness.name","domain.curse.slowness.description"},
 {"clumsiness","gives you butterfingers","domain.curse.clumsiness.name","domain.curse.clumsiness.description"},
 {"weakness","weakens your grasp","domain.curse.weakness.name","domain.curse.weakness.description"},
 {"irritation","annoys monsters and makes it hard for you to hit them","domain.curse.irritation.name","domain.curse.irritation.description"},
 {"enveloping","protects you at the expense of free movement","domain.curse.enveloping.name","domain.curse.enveloping.description"},
 {"sickliness","makes you frail","domain.curse.sickliness.name","domain.curse.sickliness.description"},
 {"dullness","makes you mentally slow","domain.curse.dullness.name","domain.curse.dullness.description"},
 {"teleportation","randomly makes you teleport","domain.curse.teleportation.name","domain.curse.teleportation.description"},
 {"vulnerability","attracts opponents and weakens the defences","domain.curse.vulnerability.name","domain.curse.vulnerability.description"},
};
static char ab_if_curse_strength[65];
static const char *ab_if_curse_id(int index,bool description){
 if(index<1||(size_t)index>=N_ELEMENTS(ab_if_curse_refs)||!curses[index].name||!curses[index].desc)return NULL;
 if(strcmp(curses[index].name,ab_if_curse_refs[index].name)||strcmp(curses[index].desc,ab_if_curse_refs[index].description))return NULL;
 return description?ab_if_curse_refs[index].description_id:ab_if_curse_refs[index].name_id;
}

#endif /* AB_INTERFACE */


struct curse_menu_data {
	int index;
	int power;
};

/**
 * Display an entry on the item menu
 */
static void get_curse_display(struct menu *menu, int oid, bool cursor, int row,
					  int col, int width)
{
	struct curse_menu_data *choice = menu_priv(menu);
	int attr = cursor ? COLOUR_L_BLUE : COLOUR_WHITE;
	char buf[80];
	int power = choice[oid].power;
	char *name = curses[choice[oid].index].name;


#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */
 const char *ab_id=ab_if_curse_id(choice[oid].index,false);
 if(ab_id)ab_if_row_text("curse-menu",oid,"interface.curse.row",(const struct ab_ui_param[]){AB_UI_REF("curse",ab_id),AB_UI_INT("power",power)},2);
#endif /* AB_INTERFACE */
	strnfmt(buf, sizeof(buf), "  %s (curse strength %d)", name, power);
	c_put_str(attr, buf, row, col);
}

/**
 * Deal with events on the get_item menu
 */
static bool get_curse_action(struct menu *menu, const ui_event *event, int oid)
{
	struct curse_menu_data *choice = menu_priv(menu);
	if (event->type == EVT_SELECT) {
		selection = choice[oid].index;
	}

	return false;
}

/**
 * Show spell long description when browsing
 */
static void curse_menu_browser(int oid, void *data, const region *loc)
{
	struct curse_menu_data *choice = data;
	char buf[80];


#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */
 ab_ui_emit("curse-menu","header","interface.curse.header",(const struct ab_ui_param[]){AB_UI_OPAQUE("strength","numeric_expression",ab_if_curse_strength)},1);
 ab_ui_static("curse-menu","description",ab_if_curse_id(choice[oid].index,true));
#endif /* AB_INTERFACE */
	/* Redirect output to the screen */
	text_out_hook = text_out_to_screen;
	text_out_wrap = 0;
	text_out_indent = loc->col - 1;
	text_out_pad = 1;

	Term_gotoxy(loc->col, loc->row + loc->page_rows);
	my_strcpy(buf, curses[choice[oid].index].desc, sizeof(buf));
	my_strcap(buf);
	text_out(" %s.\n", buf);

	/* XXX */
	text_out_pad = 0;
	text_out_indent = 0;
}

/**
 * Display list of curses to choose from
 */
static int curse_menu(struct object *obj, char *dice_string)
{
	menu_iter menu_f = { 0, 0, get_curse_display, get_curse_action, 0 };
	struct menu *m = menu_new(MN_SKIN_SCROLL, &menu_f);
	char header[80];
	int row;
	unsigned int length = 0;
	int i, count = 0;
	size_t array_size = z_info->curse_max * sizeof(struct curse_menu_data);
	struct curse_menu_data *available = mem_zalloc(array_size);
	static region area = { 20, 1, -1, -2 };

	/* Count and then list the curses */
	for (i = 1; i < z_info->curse_max; i++) {
		if ((obj->known->curses[i].power > 0) &&
			(obj->known->curses[i].power < 100) &&
			player_knows_curse(player, i)) {
			available[count].index = i;
			available[count].power = obj->curses[i].power;
			length = MAX(length, strlen(curses[i].name) + 13);
			count++;
		}
	}
	if (!count) {
		mem_free(available);
		return 0;
	}

	/* Set up the menu */
	menu_setpriv(m, count, available);
#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */
 my_strcpy(ab_if_curse_strength,dice_string,sizeof(ab_if_curse_strength));
 ab_if_menu_bind(m,"curse-menu",NULL,NULL,NULL,0);
#endif /* AB_INTERFACE */

	my_strcpy(header,
			  format(" Remove which curse (spell strength %s)?", dice_string),
			  sizeof(header));
	m->header = header;
	m->selections = all_letters_nohjkl;
	m->flags = (MN_PVT_TAGS | MN_KEYMAP_ESC);
	m->browse_hook = curse_menu_browser;

	/* Set up the item list variables */
	selection = 0;

	/* Set up the menu region */
	area.page_rows = m->count + 2;
	area.row = 1;
	area.col = (Term->wid - 1 - length) / 2;
	if (area.col <= 3)
		area.col = 0;
	area.width = MAX(length + 1, strlen(m->header));

	for (row = area.row; row < area.row + area.page_rows; row++)
		prt("", row, MAX(0, area.col - 1));

	menu_layout(m, &area);

	/* Choose */
	menu_select(m, 0, true);

	/* Clean up */
	mem_free(available);

#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */
 ab_if_menu_forget(m);
#endif /* AB_INTERFACE */
	mem_free(m);

	/* Result */
	return selection;
}

bool textui_get_curse(int *choice, struct object *obj, char *dice_string)
{
	int curse = curse_menu(obj, dice_string);
	if (curse) {
		*choice = curse;
		return true;
	}
	return false;
}
