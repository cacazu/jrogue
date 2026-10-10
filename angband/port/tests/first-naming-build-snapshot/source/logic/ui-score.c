/**
 * \file ui-score.c
 * \brief Highscore display for Angband
 *
 * Copyright (c) 1997 Ben Harrison, James E. Wilson, Robert A. Koeneke
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
#include "buildid.h"
#include "game-world.h"
#include "score.h"
#include "ui-input.h"
#include "ui-output.h"
#include "ui-score.h"
#include "ui-term.h"

/**
 * Display a page of scores
 */
static void display_score_page(const struct high_score scores[], int start,
							   int count, int highlight)
{
	int n;


#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */
 ab_ui_scope_begin("score",true);
#endif /* AB_INTERFACE */
	/* Dump 5 entries */
	for (n = 0; start < count && n < 5; start++, n++) {
		const struct high_score *score = &scores[start];
		uint8_t attr;
		int clev, mlev, cdun, mdun;
		const char *user, *gold, *when, *aged;
		struct player_class *c;
		struct player_race *r;
		char out_val[160];
		char tmp_val[160];

		/* Indicate death in yellow */
		attr = (start == highlight) ? COLOUR_L_GREEN : COLOUR_WHITE;

		c = player_id2class(atoi(score->p_c));
		r = player_id2race(atoi(score->p_r));

		/* Extract the level info */
		clev = atoi(score->cur_lev);
		mlev = atoi(score->max_lev);
		cdun = atoi(score->cur_dun);
		mdun = atoi(score->max_dun);

		/* Extract the gold and such */
		for (user = score->uid; isspace((unsigned char)*user); user++)
			/* loop */;
		for (when = score->day; isspace((unsigned char)*when); when++)
			/* loop */;
		for (gold = score->gold; isspace((unsigned char)*gold); gold++)
			/* loop */;
		for (aged = score->turns; isspace((unsigned char)*aged); aged++)
			/* loop */;

		/* Dump some info */
		strnfmt(out_val, sizeof(out_val),
				"%3d.%9s  %s the %s %s, level %d",
				start + 1, score->pts, score->who,
				r ? r->name : "<none>", c ? c->name : "<none>",
				clev);

		/* Append a "maximum level" */
		if (mlev > clev)
			my_strcat(out_val, format(" (Max %d)", mlev), sizeof(out_val));


#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */
 char ab_slot[64];
 strnfmt(ab_slot,sizeof(ab_slot),"row.%d.name",start);
 ab_ui_emit(NULL,ab_slot,"interface.score.row.summary",(const struct ab_ui_param[]){AB_UI_INT("rank",start+1),AB_UI_INT("points",atoi(score->pts)),AB_UI_OPAQUE("name","character_name",score->who),AB_UI_REF("race",r?ab_ui_race_id(r->ridx):"interface.score.table.none"),AB_UI_REF("class",c?ab_ui_class_id(c->cidx):"interface.score.table.none"),AB_UI_INT("level",clev)},6);
 if(mlev>clev){strnfmt(ab_slot,sizeof(ab_slot),"row.%d.maximum_level",start);ab_ui_emit(NULL,ab_slot,"interface.score.row.maximum_level",(const struct ab_ui_param[]){AB_UI_INT("level",mlev)},1);}
 strnfmt(ab_slot,sizeof(ab_slot),"row.%d.depth",start);ab_ui_emit(NULL,ab_slot,"interface.score.row.depth",(const struct ab_ui_param[]){AB_UI_INT("depth",cdun),AB_UI_INT("maximum",mdun)},2);
#endif /* AB_INTERFACE */
		/* Dump the first line */
		c_put_str(attr, out_val, n * 4 + 2, 0);


		/* Died where? */
		if (!cdun)
			strnfmt(out_val, sizeof(out_val), "Killed by %s in the town",
					score->how);
		else
			strnfmt(out_val, sizeof(out_val),
					"Killed by %s on dungeon level %d", score->how, cdun);

		/* Append a "maximum level" */
		if (mdun > cdun)
			my_strcat(out_val, format(" (Max %d)", mdun), sizeof(out_val));

		/* Dump the info */
		c_put_str(attr, out_val, n * 4 + 3, 15);


		/* Clean up standard encoded form of "when" */
		if ((*when == '@') && strlen(when) == 9) {
			strnfmt(tmp_val, sizeof(tmp_val), "%.4s-%.2s-%.2s", when + 1,
					when + 5, when + 7);
			when = tmp_val;
		}

		/* And still another line of info */
		strnfmt(out_val, sizeof(out_val),
				"(User %s, Date %s, Gold %s, Turn %s).",
				user, when, gold, aged);

#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */
 strnfmt(ab_slot,sizeof(ab_slot),"row.%d.details",start);
 ab_ui_emit(NULL,ab_slot,"interface.score.row.details",(const struct ab_ui_param[]){AB_UI_OPAQUE("user","verbatim_user_text",user),AB_UI_OPAQUE("date","opaque_calendar_date",when),AB_UI_INT("gold",atoi(gold)),AB_UI_INT("turns",atoi(aged))},4);
#endif /* AB_INTERFACE */
		c_put_str(attr, out_val, n * 4 + 4, 15);
	}
#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */
 ab_ui_scope_end();
#endif /* AB_INTERFACE */

}

/**
 * Display the scores in a given range.
 */
static void display_scores_aux(const struct high_score scores[], int from,
							   int to, int highlight, bool allow_scrolling)
{
	struct keypress ch;
	int k, count;

	/* Assume we will show the first 10 */
	if (from < 0) from = 0;
	if (to < 0) to = allow_scrolling ? 5 : 10;
	if (to > MAX_HISCORES) to = MAX_HISCORES;

	/* Count the high scores */
	for (count = 0; count < MAX_HISCORES; count++)
		if (!scores[count].what[0])
			break;

	/* Forget about the last entries */
	if ((count > to) && !allow_scrolling) count = to;

	/*
	 * Move 5 entries at a time.  Unless scrolling is allowed, only
	 * move forward and stop once the end is reached.
	 */
	k = from;
	while (1) {
		/* Clear screen */
		Term_clear();

		/* Title */
		if (k > 0) {
			put_str(format("%s Hall of Fame (from position %d)",
				VERSION_NAME, k + 1), 0, 21);
		} else {
			put_str(format("%s Hall of Fame", VERSION_NAME), 0, 30);
		}

		display_score_page(scores, k, count, highlight);

		/* Wait for response; prompt centered on 80 character line */
		if (allow_scrolling) {
			AB_IF_TEXT("interface.score.display_scores_aux.press_esc_to_exit_up_for_prior_page","score","display_scores_aux.press_esc_to_exit_up_for_prior_page", prt("[Press ESC to exit, up for prior page, any other key for next page.]", 23, 6));
		} else {
			AB_IF_TEXT("interface.score.display_scores_aux.press_esc_to_exit_any_other_key_to","score","display_scores_aux.press_esc_to_exit_any_other_key_to", prt("[Press ESC to exit, any other key to page forward till done.]", 23, 9));
		}
		ch = inkey();
		prt("", 23, 0);

		if (ch.code == ESCAPE) {
			break;
		} else if (ch.code == ARROW_UP && allow_scrolling) {
			if (k == 0) {
				k = count - 5;
				while (k % 5) k++;
			} else if (k < 5) {
				k = 0;
			} else {
				k = k - 5;
			}
		} else {
			k += 5;
			if (k >= count) {
				if (allow_scrolling) {
					k = 0;
				} else {
					break;
				}
			}
		}
	}

	return;
}

/**
 * Predict the players location, and display it.
 */
void predict_score(bool allow_scrolling)
{
	int j;
	struct high_score the_score;
	struct high_score scores[MAX_HISCORES];


	/* Read scores, place current score */
	highscore_read(scores, N_ELEMENTS(scores));
	build_score(&the_score, player, "nobody (yet!)", NULL);

	if (player->is_dead)
		j = highscore_where(&the_score, scores, N_ELEMENTS(scores));
	else
		j = highscore_add(&the_score, scores, N_ELEMENTS(scores));

	/* Top fifteen scores if on the top ten, otherwise ten surrounding */
	if (j < 10) {
		display_scores_aux(scores, 0, 15, j, allow_scrolling);
	} else {
		display_scores_aux(scores, j - 2, j + 7, j, allow_scrolling);
	}
}


/**
 * Show scores.
 */
void show_scores(void)
{
	screen_save();

	/* Display the scores */
	if (character_generated) {
		predict_score(true);
	} else {
		/* Currently unused, but leaving in in case we re-implement looking
		 * at the scores without loading a character */
		struct high_score scores[MAX_HISCORES];
		highscore_read(scores, N_ELEMENTS(scores));
		display_scores_aux(scores, 0, MAX_HISCORES, -1, true);
	}


#ifdef __EMSCRIPTEN__ /* AB_INTERFACE */
 ab_ui_reset("score");
#endif /* AB_INTERFACE */
	screen_load();

	/* Hack - Flush it */
	Term_fresh();
}

