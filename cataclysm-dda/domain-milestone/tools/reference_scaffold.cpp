// Fixture-only stubs for data identity, length storage and debug message capture.
// The original numeric functions below are inserted verbatim by build_reference.py.
#include <algorithm>
#include <cstdint>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>
#include <cmath>

struct damage_type { bool no_resist = false; };
static std::map<std::string, damage_type> registry;
struct damage_type_id {
    std::string value;
    damage_type_id() = default;
    explicit damage_type_id(std::string v) : value(std::move(v)) {}
    bool operator==(const damage_type_id &other) const { return value == other.value; }
    bool operator!=(const damage_type_id &other) const { return !(*this == other); }
    const damage_type *operator->() const { return &registry[value]; }
};
namespace std {
template<> struct hash<damage_type_id> {
    std::size_t operator()(const damage_type_id &id) const { return hash<std::string>()(id.value); }
};
}
namespace units {
struct length { int mm = 0; explicit length(int v=0) : mm(v) {} };
}
struct bodypart_id {};
struct bodypart_str_id {};
struct sub_bodypart_id {};
class Creature;
class JsonObject;
class JsonValue;
class item;
class monster;
static int diagnostics = 0;
static void debugmsg(const char *) { ++diagnostics; }

// ORIGINAL_DECLARATIONS
// ORIGINAL_FUNCTIONS

static damage_unit read_unit(std::istringstream &tokens) {
    std::string id;
    damage_unit result;
    std::size_t count;
    tokens >> id >> result.amount >> result.res_pen >> result.res_mult >> result.damage_multiplier
           >> result.unconditional_res_mult >> result.unconditional_damage_mult >> count;
    result.type = damage_type_id(id);
    if (!tokens) throw std::runtime_error("bad fixture unit");
    for (std::size_t index=0; index<count; ++index) {
        int length;
        float amount;
        tokens >> length >> amount;
        if (!tokens) throw std::runtime_error("bad fixture barrel");
        result.barrels.emplace_back(units::length(length), amount);
    }
    return result;
}

static std::string bits(float value) {
    if (std::isnan(value)) return "nan";
    std::uint32_t encoded;
    std::memcpy(&encoded, &value, sizeof(value));
    std::ostringstream output;
    output << std::hex << std::setw(8) << std::setfill('0') << encoded;
    return output.str();
}

int main() {
    damage_instance instance;
    resistances resistance;
    std::string line;
    while (std::getline(std::cin, line)) {
        std::istringstream tokens(line);
        std::string command;
        tokens >> command;
        if(command.empty()) continue;
        if(command == "add") {
            instance.add(read_unit(tokens));
        } else if(command == "add_instance" || command == "instance_equal") {
            std::size_t count;
            tokens >> count;
            damage_instance other;
            for (std::size_t index=0; index<count; ++index) other.damage_units.push_back(read_unit(tokens));
            if(command == "add_instance") instance.add(other);
            else std::cout << "instance_equal " << (instance == other) << '\n';
        } else if(command == "relative") {
            damage_instance other;
            other.damage_units.push_back(read_unit(tokens));
            instance += other;
        } else if(command == "relative_unit") {
            std::size_t index;
            tokens >> index;
            instance.damage_units.at(index) += read_unit(tokens);
        } else if(command == "multiply_unit") {
            std::size_t index;
            double multiplier;
            tokens >> index >> multiplier;
            instance.damage_units.at(index) *= multiplier;
        } else if(command == "multiply") {
            double multiplier;
            int pre_armor;
            tokens >> multiplier >> pre_armor;
            instance.mult_damage(multiplier, pre_armor == 1);
        } else if(command == "multiply_type") {
            std::string id;
            double multiplier;
            tokens >> id >> multiplier;
            instance.mult_type_damage(multiplier, damage_type_id(id));
        } else if(command == "resist") {
            std::string id;
            float amount;
            int no_resist;
            tokens >> id >> amount >> no_resist;
            resistance.set_resist(damage_type_id(id), amount);
            registry[id].no_resist = no_resist == 1;
        } else if(command == "add_resist") {
            std::string id;
            float amount;
            tokens >> id >> amount;
            resistances other;
            other.set_resist(damage_type_id(id), amount);
            resistance += other;
        } else if(command == "multiply_resist") {
            float multiplier;
            tokens >> multiplier;
            resistance = resistance * multiplier;
        } else if(command == "divide_resist") {
            float divisor;
            tokens >> divisor;
            resistance = resistance / divisor;
        } else if(command == "unit_equal") {
            std::size_t index;
            tokens >> index;
            std::cout << "unit_equal " << (instance.damage_units.at(index) == read_unit(tokens)) << '\n';
        } else if(command == "resist_equal") {
            std::string id;
            float amount;
            tokens >> id >> amount;
            resistances other;
            other.set_resist(damage_type_id(id), amount);
            std::cout << "resist_equal " << (resistance == other) << '\n';
        } else if(command == "clear") {
            instance.clear();
        } else if(command == "dump") {
            std::string label;
            tokens >> label;
            std::cout << label << ' ' << instance.damage_units.size() << ' ' << diagnostics << ' ' << bits(instance.total_damage());
            for(const damage_unit &unit : instance.damage_units) {
                std::cout << " | " << unit.type.value;
                for(float value : {unit.amount, unit.res_pen, unit.res_mult, unit.damage_multiplier,
                    unit.unconditional_res_mult, unit.unconditional_damage_mult,
                    instance.type_damage(unit.type), instance.type_arpen(unit.type),
                    resistance.type_resist(unit.type), resistance.get_effective_resist(unit)}) {
                    std::cout << ' ' << bits(value);
                }
                std::cout << ' ' << unit.barrels.size();
                for(const barrel_desc &barrel : unit.barrels) {
                    std::cout << ' ' << barrel.barrel_length.mm << ' ' << bits(barrel.amount);
                }
            }
            std::map<std::string, float> sorted;
            for(const auto &entry : resistance.resist_vals) sorted[entry.first.value] = entry.second;
            for(const auto &entry : sorted) std::cout << " R " << entry.first << ' ' << bits(entry.second);
            std::cout << '\n';
        } else {
            throw std::runtime_error("unknown fixture command");
        }
    }
}
