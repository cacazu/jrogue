// Unchanged functions extracted from official CDDA 7b2efa5cea38e4d4d97dd0e63b28b9148623da59. CC BY-SA 3.0.
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

struct barrel_desc {
    units::length barrel_length;
    float amount;

    barrel_desc();
    barrel_desc( units::length bl, float amt ) : barrel_length( bl ), amount( amt ) {}
    void deserialize( const JsonObject &jo );
};
struct damage_unit {
    bool was_loaded = false;
    void load( const JsonObject &jo );
    void deserialize( const JsonObject &jo );

    damage_type_id type;
    //the amount of damage_type
    float amount = 0.0f;
    //armor penetration
    float res_pen = 0.0f;
    //armor penetration multiplier
    float res_mult = 1.0f;
    float damage_multiplier = 1.0f;

    float unconditional_res_mult = 1.0f;
    float unconditional_damage_mult = 1.0f;

    std::vector<barrel_desc> barrels;

    damage_unit() = default;
    damage_unit( const damage_type_id &dt, float amt, float arpen = 0.0f, float arpen_mult = 1.0f,
                 float dmg_mult = 1.0f, float unc_arpen_mult = 1.0f, float unc_dmg_mult = 1.0f ) :
        type( dt ), amount( amt ), res_pen( arpen ), res_mult( arpen_mult ), damage_multiplier( dmg_mult ),
        unconditional_res_mult( unc_arpen_mult ), unconditional_damage_mult( unc_dmg_mult ) { }

    bool operator==( const damage_unit &other ) const;
    damage_unit &operator*=( double rhs );
    //handles "relative" field; NOT the same as damage_instance::add(damage_unit)
    damage_unit &operator+=( const damage_unit &rhs );
};
struct damage_instance {
    bool was_loaded = false;
    //called by JsonValue::read(), damage_unit is what is read from JSON
    void deserialize( const JsonValue &val );

    std::vector<damage_unit> damage_units;
    damage_instance() = default;
    damage_instance( const damage_type_id &dt, float amt, float arpen = 0.0f, float arpen_mult = 1.0f,
                     float dmg_mult = 1.0f, float unc_arpen_mult = 1.0f, float unc_dmg_mult = 1.0f );
    void mult_damage( double multiplier, bool pre_armor = false );
    void mult_type_damage( double multiplier, const damage_type_id &dt );
    float type_damage( const damage_type_id &dt ) const;
    float type_arpen( const damage_type_id &dt ) const;
    float total_damage() const;
    void clear();
    bool empty() const;

    // Applies damage type on-hit effects for all damage units
    void onhit_effects( Creature *source, Creature *target ) const;

    // Applies damage type on-damage effects for all damage units
    void ondamage_effects( Creature *source, Creature *target, const damage_instance &premitigated,
                           bodypart_str_id bp ) const;

    // calculates damage taking barrel length into consideration for the amount
    damage_instance di_considering_length( units::length barrel_length ) const;

    std::vector<damage_unit>::iterator begin();
    std::vector<damage_unit>::const_iterator begin() const;
    std::vector<damage_unit>::iterator end();
    std::vector<damage_unit>::const_iterator end() const;

    bool operator==( const damage_instance &other ) const;
    //loads an object mapping damage_instance JSON fields to proportional floats
    bool handle_proportional( const JsonValue &jval );
    //handles "relative" field; NOT the same as add(damage_unit)
    damage_instance &operator+=( const damage_instance &rhs );

    /**
     * Adds damage to the instance.
     * If the damage type already exists in the instance, the old and new instance are normalized.
     * The normalization means that the effective damage can actually decrease (depending on target's armor).
     */
    /*@{*/
    void add_damage( const damage_type_id &dt, float amt, float arpen = 0.0f, float arpen_mult = 1.0f,
                     float dmg_mult = 1.0f, float unc_arpen_mult = 1.0f, float unc_dmg_mult = 1.0f );
    void add( const damage_instance &added_di );
    void add( const damage_unit &added_du );
    /*@}*/
};
struct resistances {
    std::unordered_map<damage_type_id, float> resist_vals;

    resistances() = default;

    // If to_self is true, we want armor's own resistance, not one it provides to wearer
    explicit resistances( const item &armor, bool to_self = false, int roll = 0,
                          const bodypart_id &bp = bodypart_id() );
    explicit resistances( const item &armor, bool to_self, int roll, const sub_bodypart_id &bp );
    explicit resistances( monster &monster );
    void set_resist( const damage_type_id &dt, float amount );
    float type_resist( const damage_type_id &dt ) const;

    float get_effective_resist( const damage_unit &du ) const;

    resistances &operator+=( const resistances &other ) {
        for( const auto &dam : other.resist_vals ) {
            resist_vals[dam.first] += dam.second;
        }

        return *this;
    }
    bool operator==( const resistances &other );
    resistances operator*( float mod ) const;
    resistances operator/( float mod ) const;
};
template<typename T>
constexpr T lerp( const T &min, const T &max, float t )
{
    return ( 1.0f - t ) * min + t * max;
}
#line 294 "upstream/src/damage.cpp"
bool damage_unit::operator==( const damage_unit &other ) const
{
    return type == other.type &&
           amount == other.amount &&
           res_pen == other.res_pen &&
           res_mult == other.res_mult &&
           damage_multiplier == other.damage_multiplier &&
           unconditional_res_mult == other.unconditional_res_mult &&
           unconditional_damage_mult == other.unconditional_res_mult;
}

#line 305 "upstream/src/damage.cpp"
damage_instance::damage_instance( const damage_type_id &dt, float amt, float arpen,
                                  float arpen_mult, float dmg_mult, float unc_arpen_mult, float unc_dmg_mult )
{
    add_damage( dt, amt, arpen, arpen_mult, dmg_mult, unc_arpen_mult, unc_dmg_mult );
}

#line 311 "upstream/src/damage.cpp"
void damage_instance::add_damage( const damage_type_id &dt, float amt, float arpen,
                                  float arpen_mult, float dmg_mult, float unc_arpen_mult, float unc_dmg_mult )
{
    damage_unit du( dt, amt, arpen, arpen_mult, dmg_mult, unc_arpen_mult, unc_dmg_mult );
    add( du );
}

#line 318 "upstream/src/damage.cpp"
void damage_instance::mult_damage( double multiplier, bool pre_armor )
{
    if( multiplier <= 0.0 ) {
        clear();
    }

    if( pre_armor ) {
        for( damage_unit &elem : damage_units ) {
            elem.amount *= multiplier;
        }
    } else {
        for( damage_unit &elem : damage_units ) {
            elem.damage_multiplier *= multiplier;
        }
    }
}

#line 335 "upstream/src/damage.cpp"
void damage_instance::mult_type_damage( double multiplier, const damage_type_id &dt )
{
    for( damage_unit &elem : damage_units ) {
        if( elem.type == dt ) {
            elem.damage_multiplier *= multiplier;
        }
    }
}

#line 344 "upstream/src/damage.cpp"
float damage_instance::type_damage( const damage_type_id &dt ) const
{
    float ret = 0.0f;
    for( const damage_unit &elem : damage_units ) {
        if( elem.type == dt ) {
            ret += elem.amount * elem.damage_multiplier * elem.unconditional_damage_mult;
        }
    }
    return ret;
}

#line 355 "upstream/src/damage.cpp"
float damage_instance::type_arpen( const damage_type_id &dt ) const
{
    float ret = 0.0f;
    for( const damage_unit &elem : damage_units ) {
        if( elem.type == dt ) {
            ret += elem.res_pen;
        }
    }
    return ret;
}

#line 367 "upstream/src/damage.cpp"
float damage_instance::total_damage() const
{
    float ret = 0.0f;
    for( const damage_unit &elem : damage_units ) {
        ret += elem.amount * elem.damage_multiplier * elem.unconditional_damage_mult;
    }
    return ret;
}

#line 469 "upstream/src/damage.cpp"
void damage_instance::clear()
{
    damage_units.clear();
}

#line 474 "upstream/src/damage.cpp"
bool damage_instance::empty() const
{
    return damage_units.empty();
}

#line 479 "upstream/src/damage.cpp"
void damage_instance::add( const damage_instance &added_di )
{
    for( const damage_unit &added_du : added_di.damage_units ) {
        add( added_du );
    }
}

#line 486 "upstream/src/damage.cpp"
void damage_instance::add( const damage_unit &added_du )
{
    auto iter = std::find_if( damage_units.begin(), damage_units.end(),
    [&added_du]( const damage_unit & du ) {
        return du.type == added_du.type;
    } );
    if( iter == damage_units.end() ) {
        damage_units.emplace_back( added_du );
    } else {
        damage_unit &du = *iter;
        float mult = added_du.damage_multiplier / du.damage_multiplier;
        du.amount += added_du.amount * mult;
        du.res_pen += added_du.res_pen * mult;
        // Linearly interpolate armor multiplier based on damage proportion contributed
        float t = added_du.damage_multiplier / ( added_du.damage_multiplier + du.damage_multiplier );
        du.res_mult = lerp( du.res_mult, added_du.damage_multiplier, t );

        du.unconditional_res_mult *= added_du.unconditional_res_mult;
        du.unconditional_damage_mult *= added_du.unconditional_damage_mult;

        if( added_du.barrels.empty() ) {
            if( du.barrels.empty() ) {
                du.barrels = added_du.barrels;
            } else {
                debugmsg( "Tried to add two sets of barrel definitions for damage together, this is not currently supported." );
            }
        }
    }
}

#line 516 "upstream/src/damage.cpp"
std::vector<damage_unit>::iterator damage_instance::begin()
{
    return damage_units.begin();
}

#line 521 "upstream/src/damage.cpp"
std::vector<damage_unit>::const_iterator damage_instance::begin() const
{
    return damage_units.begin();
}

#line 526 "upstream/src/damage.cpp"
std::vector<damage_unit>::iterator damage_instance::end()
{
    return damage_units.end();
}

#line 531 "upstream/src/damage.cpp"
std::vector<damage_unit>::const_iterator damage_instance::end() const
{
    return damage_units.end();
}

#line 536 "upstream/src/damage.cpp"
bool damage_instance::operator==( const damage_instance &other ) const
{
    return damage_units == other.damage_units;
}

#line 541 "upstream/src/damage.cpp"
damage_unit &damage_unit::operator*=( const double rhs )
{
    amount *= rhs;
    return *this;
}

#line 586 "upstream/src/damage.cpp"
damage_unit &damage_unit::operator+=( const damage_unit &rhs )
{
    amount += rhs.amount;
    res_pen += rhs.res_pen;
    res_mult += rhs.res_mult;
    damage_multiplier += rhs.damage_multiplier;
    unconditional_damage_mult += rhs.unconditional_damage_mult;

    for( barrel_desc &bd : barrels ) {
        bd.amount += rhs.amount;
    }
    return *this;
}

#line 600 "upstream/src/damage.cpp"
damage_instance &damage_instance::operator+=( const damage_instance &rhs )
{
    for( damage_unit &val_dmg : damage_units ) {
        for( const damage_unit &tmp : rhs.damage_units ) {
            if( tmp.type != val_dmg.type ) {
                continue;
            }

            damage_unit relative_copy = tmp;
            // res_mult is set to 1 if it's not specified. Set it to zero so we don't accidentally add to it
            if( relative_copy.res_mult == 1.0f ) {
                relative_copy.res_mult = 0;
            }
            // Same for damage_multiplier
            if( relative_copy.damage_multiplier == 1.0f ) {
                relative_copy.damage_multiplier = 0;
            }
            // As well as the unconditional versions
            if( relative_copy.unconditional_res_mult == 1.0f ) {
                relative_copy.unconditional_res_mult = 0;
            }
            if( relative_copy.unconditional_damage_mult == 1.0f ) {
                relative_copy.unconditional_damage_mult = 0;
            }

            val_dmg += relative_copy;
        }
    }
    return *this;
}

#line 715 "upstream/src/damage.cpp"
void resistances::set_resist( const damage_type_id &dt, float amount )
{
    resist_vals[dt] = amount;
}

#line 719 "upstream/src/damage.cpp"
float resistances::type_resist( const damage_type_id &dt ) const
{
    auto iter = resist_vals.find( dt );
    return ( iter == resist_vals.end() || iter->first->no_resist ) ? 0.0f : iter->second;
}

#line 724 "upstream/src/damage.cpp"
float resistances::get_effective_resist( const damage_unit &du ) const
{
    return std::max( type_resist( du.type ) - du.res_pen,
                     0.0f ) * du.res_mult * du.unconditional_res_mult;
}

#line 730 "upstream/src/damage.cpp"
bool resistances::operator==( const resistances &other )
{
    for( const auto &dam : other.resist_vals ) {
        if( resist_vals.count( dam.first ) <= 0 || resist_vals[dam.first] != dam.second ) {
            return false;
        }
    }

    return true;
}

#line 741 "upstream/src/damage.cpp"
resistances resistances::operator*( float mod ) const
{
    resistances ret;
    for( const auto &dam : resist_vals ) {
        ret.resist_vals[dam.first] = dam.second * mod;
    }
    return ret;
}

#line 750 "upstream/src/damage.cpp"
resistances resistances::operator/( float mod ) const
{
    resistances ret;
    for( const auto &dam : resist_vals ) {
        ret.resist_vals[dam.first] = dam.second / mod;
    }
    return ret;
}

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
