// Reviewed original owner bindings, generated without changing English prose.
namespace {
struct reviewed_label { const char *id; const char *category; const char *action; const char *singular; };
const std::array<reviewed_label, 7> reviewed_labels = {{
    { "input.keybinding.default.up.name", "default", "UP", "Pan up" },
    { "input.keybinding.pickup.up.name", "PICKUP", "UP", "Previous item" },
    { "input.keybinding.bionics.up.name", "BIONICS", "UP", "Move cursor up" },
    { "input.keybinding.default_mode.pause.name", "DEFAULTMODE", "pause", "Pause" },
    { "input.keybinding.default_mode.pickup.name", "DEFAULTMODE", "pickup", "Pick up items from one nearby tile" },
    { "input.keybinding.default_mode.inventory.name", "DEFAULTMODE", "inventory", "Open inventory" },
    { "input.keybinding.default_mode.help.name", "DEFAULTMODE", "help", "View help" },
}};
const std::array<const char *, 6> reviewed_movement_messages = {{
    "Movement is performed using the numpad, the arrow keys, or vikeys.",
    "<HELP_DRAW_DIRECTIONS>",
    "Each step will take 100 movement points (or more, depending on the terrain); you will then replenish a variable amount of movement points, depending on many factors (press <press_player_data> to see the exact amount).",
    "To attempt to hit a monster with your weapon, simply move into it.",
    "You may find doors, ('+'); these may be opened with <press_open> or closed with <press_close>.  Some doors are locked.  Locked doors, windows, and some other obstacles can be destroyed by smashing them (<press_smash>, then choose a direction).  Smashing down obstacles is much easier with a good weapon or a strong character.",
    "There may be times when you want to move more quickly by holding down a movement key.  However, fast movement in this fashion may lead to the player getting into a dangerous situation or even killed before they have a chance to react.  Pressing <press_safemode> will toggle \"safe mode.\"  While this is on, any movement will be ignored if new monsters enter the player's view.",
}};
const std::array<const char *, 6> reviewed_movement_ids = {{
    "help.core.movement.controls",
    nullptr,
    "help.core.movement.movement_cost",
    "help.core.movement.melee",
    "help.core.movement.doors",
    "help.core.movement.safe_mode",
}};
struct reviewed_press { const char *id; const char *parameter; const char *action; };
const std::array<reviewed_press, 5> reviewed_press_parameters = {{
    { "help.core.movement.movement_cost", "press_player_data", "player_data" },
    { "help.core.movement.doors", "press_open", "open" },
    { "help.core.movement.doors", "press_close", "close" },
    { "help.core.movement.doors", "press_smash", "smash" },
    { "help.core.movement.safe_mode", "press_safemode", "safemode" },
}};
struct reviewed_grid_cell { const char *role; const char *action; int row; int column; };
const std::array<reviewed_grid_cell, 9> reviewed_grid_cells = {{
    { "north_west", "LEFTUP", 0, 0 },
    { "north", "UP", 0, 1 },
    { "north_east", "RIGHTUP", 0, 2 },
    { "west", "LEFT", 1, 0 },
    { "pause", "pause", 1, 1 },
    { "east", "RIGHT", 1, 2 },
    { "south_west", "LEFTDOWN", 2, 0 },
    { "south", "DOWN", 2, 1 },
    { "south_east", "RIGHTDOWN", 2, 2 },
}};
} // namespace
