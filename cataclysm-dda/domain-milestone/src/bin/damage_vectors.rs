//! Test adapter only. This is not a game application or presentation layer.
use cdda_damage_domain::{
    BarrelDescriptor, DamageInstance, DamageTypeId, DamageTypeRegistry, DamageUnit, Resistances,
};
use std::error::Error;
use std::fmt::Write;
use std::io::{self, BufRead};
use std::str::SplitWhitespace;

fn next<'a>(tokens: &mut SplitWhitespace<'a>) -> Result<&'a str, Box<dyn Error>> {
    tokens.next().ok_or_else(|| "missing fixture field".into())
}

fn read_unit(tokens: &mut SplitWhitespace<'_>) -> Result<DamageUnit, Box<dyn Error>> {
    let id = DamageTypeId::from(next(tokens)?);
    let mut unit = DamageUnit::new(id, next(tokens)?.parse()?);
    unit.res_pen = next(tokens)?.parse()?;
    unit.res_mult = next(tokens)?.parse()?;
    unit.damage_multiplier = next(tokens)?.parse()?;
    unit.unconditional_res_mult = next(tokens)?.parse()?;
    unit.unconditional_damage_mult = next(tokens)?.parse()?;
    let count: usize = next(tokens)?.parse()?;
    for _ in 0..count {
        unit.barrels.push(BarrelDescriptor {
            length_mm: next(tokens)?.parse()?,
            amount: next(tokens)?.parse()?,
        });
    }
    Ok(unit)
}

fn bits(value: f32) -> String {
    if value.is_nan() {
        "nan".to_owned()
    } else {
        format!("{:08x}", value.to_bits())
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut instance = DamageInstance::default();
    let mut resistance = Resistances::default();
    let mut registry = DamageTypeRegistry::default();
    let mut diagnostics = 0;
    for line in io::stdin().lock().lines() {
        let line = line?;
        let mut tokens = line.split_whitespace();
        let Some(command) = tokens.next() else {
            continue;
        };
        match command {
            "add" => {
                diagnostics += usize::from(instance.add(&read_unit(&mut tokens)?).is_some());
            }
            "add_instance" | "instance_equal" => {
                let count: usize = next(&mut tokens)?.parse()?;
                let mut other = DamageInstance::default();
                for _ in 0..count {
                    other.units.push(read_unit(&mut tokens)?);
                }
                if command == "add_instance" {
                    diagnostics += instance.add_instance(&other).len();
                } else {
                    println!("instance_equal {}", u8::from(instance.legacy_equal(&other)));
                }
            }
            "relative" => {
                let other = DamageInstance {
                    units: vec![read_unit(&mut tokens)?],
                };
                instance.add_relative(&other);
            }
            "relative_unit" => {
                let index: usize = next(&mut tokens)?.parse()?;
                let other = read_unit(&mut tokens)?;
                instance
                    .units
                    .get_mut(index)
                    .ok_or("invalid unit index")?
                    .add_relative(&other);
            }
            "multiply_unit" => {
                let index: usize = next(&mut tokens)?.parse()?;
                let value = next(&mut tokens)?.parse()?;
                instance
                    .units
                    .get_mut(index)
                    .ok_or("invalid unit index")?
                    .multiply_amount(value);
            }
            "multiply" => {
                let multiplier = next(&mut tokens)?.parse()?;
                let pre_armor = next(&mut tokens)? == "1";
                instance.multiply_damage(multiplier, pre_armor);
            }
            "multiply_type" => {
                let id = DamageTypeId::from(next(&mut tokens)?);
                instance.multiply_type_damage(next(&mut tokens)?.parse()?, &id);
            }
            "resist" => {
                let id = DamageTypeId::from(next(&mut tokens)?);
                let amount = next(&mut tokens)?.parse()?;
                let no_resist = next(&mut tokens)? == "1";
                resistance.set_resist(id.clone(), amount);
                registry.set_no_resist(id, no_resist);
            }
            "add_resist" => {
                let id = DamageTypeId::from(next(&mut tokens)?);
                let mut other = Resistances::default();
                other.set_resist(id, next(&mut tokens)?.parse()?);
                resistance.add(&other);
            }
            "multiply_resist" => resistance = resistance.multiplied(next(&mut tokens)?.parse()?),
            "divide_resist" => resistance = resistance.divided(next(&mut tokens)?.parse()?),
            "unit_equal" => {
                let index: usize = next(&mut tokens)?.parse()?;
                let other = read_unit(&mut tokens)?;
                let unit = instance.units.get(index).ok_or("invalid unit index")?;
                println!("unit_equal {}", u8::from(unit.legacy_equal(&other)));
            }
            "resist_equal" => {
                let mut other = Resistances::default();
                let id = DamageTypeId::from(next(&mut tokens)?);
                other.set_resist(id, next(&mut tokens)?.parse()?);
                println!(
                    "resist_equal {}",
                    u8::from(resistance.legacy_contains_equal(&other))
                );
            }
            "clear" => instance.clear(),
            "dump" => {
                let label = next(&mut tokens)?;
                let mut output = format!(
                    "{label} {} {} {}",
                    instance.units.len(),
                    diagnostics,
                    bits(instance.total_damage())
                );
                for unit in &instance.units {
                    write!(&mut output, " | {}", unit.damage_type.0)?;
                    for value in [
                        unit.amount,
                        unit.res_pen,
                        unit.res_mult,
                        unit.damage_multiplier,
                        unit.unconditional_res_mult,
                        unit.unconditional_damage_mult,
                        instance.type_damage(&unit.damage_type),
                        instance.type_arpen(&unit.damage_type),
                        resistance.type_resist(&unit.damage_type, &registry),
                        resistance.effective_resist(unit, &registry),
                    ] {
                        write!(&mut output, " {}", bits(value))?;
                    }
                    write!(&mut output, " {}", unit.barrels.len())?;
                    for barrel in &unit.barrels {
                        write!(&mut output, " {} {}", barrel.length_mm, bits(barrel.amount))?;
                    }
                }
                for (id, amount) in &resistance.values {
                    write!(&mut output, " R {} {}", id.0, bits(*amount))?;
                }
                println!("{output}");
            }
            _ => return Err(format!("unknown fixture command: {command}").into()),
        }
        if tokens.next().is_some() {
            return Err("unexpected fixture field".into());
        }
    }
    Ok(())
}
