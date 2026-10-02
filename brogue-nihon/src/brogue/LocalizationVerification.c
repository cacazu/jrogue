/* Deterministic verification through the actual game and SDL renderers. */
#include "Rogue.h"
#include "GlobalsBase.h"
#include "Globals.h"

static void writeAuditString(FILE *output, const char *text) {
    fputc('"', output);
    for (const unsigned char *p = (const unsigned char *)text; *p; p++) {
        if (*p == '"' || *p == '\\') fputc('\\', output);
        if (*p < 32) fprintf(output, "\\u%04x", *p);
        else fputc(*p, output);
    }
    fputc('"', output);
}

static void auditText(FILE *output, const char *kind, int id, int state, const char *english) {
    char japanese[32000];
    localeSetLanguage("ja");
    localeDisplay(japanese, sizeof japanese, english);
    fprintf(output, "{\"kind\":\"%s\",\"id\":%d,\"state\":%d,\"english\":", kind, id, state);
    writeAuditString(output, english);
    fputs(",\"japanese\":", output);
    writeAuditString(output, japanese);
    fputs("}\n", output);
    fflush(output);
}

/* No SDL window, input, screenshots or player save is used by this audit. */
void localeAuditGeneratedText(void) {
    archivedMessage archiveBefore[MESSAGE_ARCHIVE_ENTRIES];
    memcpy(archiveBefore,messageArchive,sizeof archiveBefore);
    unsigned long turnBefore=rogue.playerTurnNumber;
    unsigned long randomBefore=randomNumbersGenerated;
    unsigned long recordingBefore=recordingLocation;
    localeSetLanguage("ja");
    executeKeystroke(LANGUAGE_KEY,false,false);
    if(strcmp(localeLanguage(),"en")) {fprintf(stderr,"Headless language switch failed.\n");exit(1);}
    executeKeystroke(LANGUAGE_KEY,false,false);
    if(strcmp(localeLanguage(),"ja")||rogue.playerTurnNumber!=turnBefore||randomNumbersGenerated!=randomBefore
            ||recordingLocation!=recordingBefore||memcmp(archiveBefore,messageArchive,sizeof archiveBefore)) {
        fprintf(stderr,"Language switching changed gameplay, recording or message history.\n");exit(1);
    }
    FILE *stateReport=fopen("language-switch.json","w");
    if(!stateReport)exit(1);
    fputs("{\"archive_unchanged\":true,\"turn_unchanged\":true,\"substantive_rng_unchanged\":true,\"recording_unchanged\":true}\n",stateReport);
    fclose(stateReport);
    FILE *output = fopen("generated-text.jsonl", "w");
    if (!output) { fprintf(stderr, "Cannot write generated text audit.\n"); exit(1); }
    const unsigned long categories[] = {FOOD, WEAPON, ARMOR, POTION, SCROLL, STAFF, WAND, RING, CHARM, GOLD, AMULET, GEM, KEY};
    const int counts[] = {NUMBER_FOOD_KINDS, NUMBER_WEAPON_KINDS, NUMBER_ARMOR_KINDS,
        gameConst->numberPotionKinds, gameConst->numberScrollKinds, NUMBER_STAFF_KINDS,
        gameConst->numberWandKinds, NUMBER_RING_KINDS, gameConst->numberCharmKinds, 1, 1, 1, 3};
    char text[20000], name[1000];
    for (int category = 0; category < sizeof categories / sizeof *categories; category++) {
        for (int kind = 0; kind < counts[category]; kind++) {
            item *it = generateItem(categories[category], kind);
            it->inventoryLetter = 'a'; it->originDepth = 12;
            it->nextItem = packItems->nextItem; packItems->nextItem = it;
            for (int state = 0; state < 5; state++) {
                it->quantity = state == 1 ? 3 : 1;
                it->enchant1 = state == 3 ? -2 : 4;
                it->flags &= ~(ITEM_IDENTIFIED | ITEM_RUNIC | ITEM_RUNIC_IDENTIFIED | ITEM_CURSED | ITEM_EQUIPPED | ITEM_PROTECTED);
                if (state >= 2) it->flags |= ITEM_IDENTIFIED;
                if (state == 3) it->flags |= ITEM_CURSED | ITEM_EQUIPPED;
                if (state == 4) it->flags |= ITEM_PROTECTED;
                rogue.playbackOmniscience = state >= 2;
                itemName(it, name, true, true, NULL);
                auditText(output, "item-name", category * 100 + kind, state, name);
                itemDetails(text, it);
                auditText(output, "item-description", category * 100 + kind, state, text);
            }
            if (it->category == WEAPON || it->category == ARMOR) {
                int runes = it->category == WEAPON ? NUMBER_WEAPON_RUNIC_KINDS : NUMBER_ARMOR_ENCHANT_KINDS;
                for (int rune = 0; rune < runes; rune++) {
                    it->enchant1 = 4; it->enchant2 = rune; it->vorpalEnemy = 0;
                    it->flags = ITEM_IDENTIFIED | ITEM_RUNIC | ITEM_RUNIC_IDENTIFIED;
                    itemDetails(text, it);
                    auditText(output, "runic-description", category * 100 + kind, rune, text);
                }
            }
            packItems->nextItem = it->nextItem; deleteItem(it);
        }
    }
    rogue.playbackOmniscience = true;
    for (int kind = 1; kind < NUMBER_MONSTER_KINDS; kind++) {
        creature *monst = generateMonster(kind, false, false);
        monst->loc = player.loc;
        for (int state = 0; state < 3 + NUMBER_MUTATORS; state++) {
            monst->mutationIndex = state >= 3 ? state - 3 : -1;
            monst->currentHP = state == 1 ? 1 : monst->info.maxHP;
            monst->creatureState = state == 2 ? MONSTER_ALLY : MONSTER_TRACKING_SCENT;
            monsterDetails(text, monst);
            auditText(output, "monster-description", kind, state, text);
        }
    }
    fclose(output);
    fprintf(stderr, "Generated item and monster text audit written.\n");
}
#ifdef BROGUE_SDL
#include "tiles.h"

static void redrawGame(void) {
    displayLevel();
    refreshSideBar(-1, -1, false);
    displayRecentMessages();
    updateFlavorText();
    refreshScreen();
}

static void captureGame(const char *scene) {
    redrawGame();
    verificationInputScene = scene;
    localeVerificationStopInputLoop = 1;
    mainInputLoop();
    rogue.gameHasEnded = false;
    localeVerificationStopInputLoop = 0;
}

void localeVerifyGameScreens(void) {
    unsigned long initialTurn = rogue.playerTurnNumber;
    unsigned long initialRandomCount = randomNumbersGenerated;
    unsigned long initialRecordingLocation = recordingLocation;
    localeSetLanguage("en");
    captureGame("game-en");
    executeKeystroke(LANGUAGE_KEY, false, false);
    captureGame("game-ja");
    if (initialTurn != rogue.playerTurnNumber || initialRandomCount != randomNumbersGenerated
            || initialRecordingLocation != recordingLocation || strcmp(localeLanguage(), "ja")) {
        fprintf(stderr, "Language switching advanced gameplay or substantive RNG.\n"); exit(1);
    }

    /* Exercise an actual dynamically formatted pickup message. */
    item *gold = generateItem(GOLD, 0);
    gold->quantity = 123;
    placeItemAt(gold, player.loc);
    pickUpItemAt(player.loc);
    captureGame("pickup-ja");

    /* Give the archive enough separate entries to exercise its scrolling view. */
    message("You feel stronger.", 0);
    message("You are hungry.", 0);
    message("You are hungry.", 0);
    message("The doors to the dungeon slam shut behind you.", 0);
    archivedMessage before[MESSAGE_ARCHIVE_ENTRIES];
    memcpy(before, messageArchive, sizeof before);
    unsigned long turn = rogue.playerTurnNumber;
    unsigned long randomCount = randomNumbersGenerated;
    verificationInputScene = "history-ja";
    displayMessageArchive();
    localeSetLanguage("en");
    redrawGame();
    verificationInputScene = "history-en";
    displayMessageArchive();
    int unchanged = !memcmp(before, messageArchive, sizeof before) && turn == rogue.playerTurnNumber
        && randomCount == randomNumbersGenerated;
    if (!unchanged) { fprintf(stderr, "Language switching modified the message archive or turn.\n"); exit(1); }
    localeSetLanguage("ja");
    redrawGame();
    verificationInputScene = "inventory-ja";
    displayInventory(ALL_ITEMS, 0, 0, true, true);
    verificationInputScene = "help-ja";
    printHelpScreen();
    redrawGame();
    char text[TEXT_MAX_LENGTH] = "Retrieve the Amulet of Yendor from the 26th floor and escape with it!";
    printTextBox(text, 30, 10, 25, &white, &black, NULL, 0);
    captureVerificationScene("wrap-ja");
    FILE *report = fopen("verification.json", "w");
    if (!report) exit(1);
    fprintf(report, "{\"seed\":42,\"archive_unchanged\":true,\"turn_unchanged\":true,\"substantive_rng_unchanged\":true,\"recording_unchanged\":true,\"missing_glyphs\":%d}\n", verificationMissingGlyphs());
    fclose(report);
    if (verificationMissingGlyphs()) exit(1);
}
#else
void localeVerifyGameScreens(void) {
    fprintf(stderr, "Screen verification requires the SDL build.\n");
    exit(1);
}
#endif
