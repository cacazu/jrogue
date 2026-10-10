#pragma once
#ifndef CATA_SRC_HELP_H
#define CATA_SRC_HELP_H

#include <map>
#include <string>
#include <utility>
#include <vector>

#include "cuboid_rectangle.h"
#include "point.h"
#include "translation.h"
#include "cata_path.h"
#include "cdda_help_semantic.h"

class JsonObject;
class cata_path;
struct input_event;

namespace catacurses
{
class window;
}  // namespace catacurses

class help
{
    public:
        static void load( const JsonObject &jo, const std::string &src,
                          const cata_path &base_path = cata_path(),
                          const cata_path &full_path = cata_path() );
        static void reset();
        // Owned UI-only metadata from the actual original loader; absent means legacy/failure.
        std::optional<cdda_help_semantic::topic_metadata> observe_loaded_topic( int order ) const noexcept;
        void display_help() const;
    private:
        void load_object( const JsonObject &jo, const std::string &src,
                          const cata_path &full_path );
        void reset_instance();
        std::map<int, inclusive_rectangle<point>> draw_menu( const catacurses::window &win,
                                               int selected, std::map<int, input_event> &hotkeys ) const;
        static std::string get_note_colors();
        static std::string get_dir_grid();
        // Modifier for each mods order
        int current_order_start = 0;
        std::string current_src;
        std::map<int, std::pair<translation, std::vector<translation>>> help_texts;
        std::map<int, cdda_help_semantic::topic_metadata> semantic_help_topics;
};

help &get_help();

std::string get_hint();

#endif // CATA_SRC_HELP_H
