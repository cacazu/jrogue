//! Pure composition of source-selected lore facts, with no game-state access.
use super::{KnowledgeParameterType as Kind, KnowledgeTextError as Error, ReviewedKnowledgeCatalog};
use crate::localization::json::JsonValue as J;
use crate::text::Locale;
use std::collections::BTreeMap;

type Values = BTreeMap<String, String>;
#[derive(Clone, Debug)]
struct Part { section: String, role: String, id: String, caller: Option<String>, params: BTreeMap<String,J> }
fn invalid(reason: &'static str) -> Error { Error::InvalidCatalog(reason) }
fn field<'a>(value: &'a J,name: &str) -> Result<&'a J,Error> { value.field(name).ok_or_else(||invalid("missing section field")) }
fn text<'a>(value: &'a J) -> Result<&'a str,Error> { value.as_str().ok_or_else(||invalid("expected section string")) }
fn exact(value: &J,names: &[&str]) -> Result<(),Error> {
    let fields=value.as_object().ok_or_else(||invalid("expected section object"))?;
    if fields.len()!=names.len() || fields.iter().any(|(k,_)|!names.contains(&k.as_str())) {return Err(invalid("extra section fields"));}
    Ok(())
}
fn parse(catalog: &ReviewedKnowledgeCatalog,value: &J) -> Result<(String,Vec<Part>),Error> {
    exact(value,&["schema_version","section","ordered_parts"])?;
    if field(value,"schema_version")?.as_integer()!=Some(1){return Err(invalid("section version"));}
    let section=text(field(value,"section")?)?.to_owned();
    if !["kills","flavor","movement","toughness","experience","drop","abilities","awareness","friends","spells","attacks"].contains(&section.as_str()){return Err(invalid("unknown section"));}
    let rows=field(value,"ordered_parts")?.as_array().ok_or_else(||invalid("expected ordered parts"))?;
    if rows.is_empty() || rows.len()>512{return Err(invalid("section part bound"));}
    let mut parts=Vec::with_capacity(rows.len());
    for row in rows {
        let fields=row.as_object().ok_or_else(||invalid("expected part"))?;
        if fields.iter().any(|(k,_)|!["section","role","id","caller","params","presentation"].contains(&k.as_str())){return Err(invalid("extra part fields"));}
        let child=text(field(row,"section")?)?.to_owned();
        let nested=matches!((section.as_str(),child.as_str()),("movement","speed_adjective"|"speed_multiplier")|("abilities","clause")|("spells","spell_clause"));
        if child!=section && !nested{return Err(invalid("wrong nested section"));}
        let role=text(field(row,"role")?)?.to_owned();
        let id=text(field(row,"id")?)?.to_owned();
        if id!=format!("angband.knowledge.lore.{child}.{role}"){return Err(invalid("part identity mismatch"));}
        let schema=catalog.parameter_schema(&id)?;
        let params=field(row,"params")?.as_object().ok_or_else(||invalid("expected part parameters"))?;
        if params.len()!=schema.len() || params.iter().any(|(k,_)|!schema.contains_key(k)){return Err(invalid("part parameter set"));}
        let mut owned=BTreeMap::new();
        for (name,param) in params {
            exact(param,&["type","value"])?;
            let kind=text(field(param,"type")?)?;
            let expected=schema.get(name).ok_or_else(||invalid("unknown part parameter"))?;
            match (expected,kind) {
                (Kind::Integer,"integer") => {
                    let n=field(param,"value")?.as_integer().ok_or_else(||invalid("expected integer"))?;
                    i32::try_from(n).map_err(|_|invalid("native integer range"))?;
                }
                (Kind::LocalizedText,"localized_text") => { field(param,"value")?.as_object().ok_or_else(||invalid("expected selected ref"))?; }
                _=>return Err(invalid("part parameter type")),
            }
            owned.insert(name.clone(),field(param,"value")?.clone());
        }
        let caller=row.field("caller").map(text).transpose()?.map(str::to_owned);
        match child.as_str() {
            "clause" if !caller.as_deref().is_some_and(|c|["alter","detection","vulnerability","resistance","nonresistance","effect_immunity"].contains(&c))=>return Err(invalid("clause caller")),
            "spell_clause" if !caller.as_deref().is_some_and(|c|["innate","breath","magic"].contains(&c))=>return Err(invalid("spell caller")),
            "clause"|"spell_clause"=>{},
            _ if caller.is_some()=>return Err(invalid("unexpected caller")),
            _=>{},
        }
        if let Some(p)=row.field("presentation") {
            exact(p,&["color"])?;
            if !field(p,"color")?.as_integer().is_some_and(|n|(0..=255).contains(&n)){return Err(invalid("color range"));}
        }
        parts.push(Part{section:child,role,id,caller,params:owned});
    }
    Ok((section,parts))
}

/// Substitute only declared grammar slots; parameter text is never rescanned.
fn interpolate(template: &str,values: &Values)->Result<String,Error>{
    let mut output=String::new();let mut cursor=0;
    while let Some(relative)=template[cursor..].find('{') {
        let start=cursor+relative;output.push_str(&template[cursor..start]);
        let end=start+template[start..].find('}').ok_or_else(||invalid("grammar slot"))?;
        let name=&template[start+1..end];
        output.push_str(values.get(name).ok_or_else(||invalid("missing grammar value"))?);
        cursor=end+1;if output.len()>32768{return Err(invalid("section output bound"));}
    }
    output.push_str(&template[cursor..]);if output.len()>32768{return Err(invalid("section output bound"));}Ok(output)
}
struct Composer<'a,F> {catalog:&'a ReviewedKnowledgeCatalog,locale:Locale,resolve:&'a mut F}
impl<F:FnMut(&J)->Result<String,Error>> Composer<'_,F> {
    fn reference(&mut self,value:&J,depth:usize)->Result<String,Error>{
        if depth>8{return Err(invalid("knowledge reference depth"));}
        let id=text(field(value,"id")?)?;
        let fields=value.as_object().ok_or_else(||invalid("reference object"))?;
        if fields.iter().any(|(k,_)|k!="id"&&k!="params"){return Err(invalid("extra reference fields"));}
        if !self.catalog.parameters.contains_key(id){return (self.resolve)(value);}
        let schema=self.catalog.parameter_schema(id)?;
        let params=value.field("params").map(|p|p.as_object().ok_or_else(||invalid("reference parameters"))).transpose()?.unwrap_or(&[]);
        if params.len()!=schema.len() || params.iter().any(|(k,_)|!schema.contains_key(k)){return Err(invalid("reference parameter set"));}
        let mut values=Values::new();
        for (name,p) in params {
            exact(p,&["type","value"])?;
            let kind=text(field(p,"type")?)?;let v=field(p,"value")?;
            let rendered=match (schema.get(name),kind) {
                (Some(Kind::Integer),"integer")=>{
                    let n=v.as_integer().ok_or_else(||invalid("numeric reference"))?;
                    i32::try_from(n).map_err(|_|invalid("native integer range"))?;
                    if name=="hundredths" && ["angband.knowledge.lore.statement.speed_multiplier.player_factor_hundredths","angband.knowledge.lore.statement.experience.hundredths_value"].contains(&id){format!("{n:02}")}else{n.to_string()}
                }
                (Some(Kind::LocalizedText),"localized_text")=>self.reference(v,depth+1)?,
                _=>return Err(invalid("numeric/reference grammar type")),
            };values.insert(name.clone(),rendered);
        }
        interpolate(self.catalog.text(id,self.locale)?,&values)
    }
    fn values(&mut self,part:&Part)->Result<Values,Error>{
        part.params.iter().map(|(name,value)|{
            let rendered=if let Some(n)=value.as_integer(){n.to_string()}else{self.reference(value,0)?};
            Ok((name.clone(),rendered))
        }).collect()
    }
    fn leaf(&mut self,part:&Part)->Result<String,Error>{let v=self.values(part)?;interpolate(self.catalog.text(&part.id,self.locale)?,&v)}
    fn grammar(&self,section:&str,role:&str,values:Values)->Result<String,Error>{
        let id=format!("angband.knowledge.lore.statement.{section}.{role}");
        let schema=self.catalog.parameter_schema(&id)?;
        if schema.keys().ne(values.keys()){return Err(invalid("whole grammar parameter set"));}
        interpolate(self.catalog.text(&id,self.locale)?,&values)
    }
    fn optional(&self,role:&str)->Result<String,Error>{self.catalog.text(&format!("angband.knowledge.lore.lexeme.projection.{role}"),self.locale).map(str::to_owned)}
    fn param(&mut self,parts:&[Part],role:&str,name:&str)->Result<String,Error>{
        let part=parts.iter().find(|p|p.role==role).ok_or_else(||invalid("missing selected role"))?;
        self.values(part)?.remove(name).ok_or_else(||invalid("missing role parameter"))
    }
    fn selected(parts:&[Part],role:&str)->bool{parts.iter().any(|p|p.role==role)}
    fn vals(rows: &[(&str,String)])->Values{rows.iter().map(|(k,v)|((*k).to_owned(),v.clone())).collect()}
    fn japanese(&mut self,section:&str,parts:&[Part])->Result<String,Error>{
        let has=|r:&str|Self::selected(parts,r);
        match section {
            "kills"=>{
                if has("unique_ancestors_slain") {
                    let mut v=self.values(parts.iter().find(|p|p.role=="unique_ancestors_slain").ok_or_else(||invalid("kill role"))?)?;
                    let rule=if has("unique_revenge_taken"){"unique_revenge"}else{v.insert("agreement".into(),self.param(parts,"unique_unavenged","agreement")?);"unique_unavenged"};
                    return self.grammar("kills",rule,v);
                }
                if has("ancestors_slain") {
                    let mut v=self.values(parts.iter().find(|p|p.role=="ancestors_slain").ok_or_else(||invalid("ancestor role"))?)?;
                    let rule=if has("current_life_extermination"){v.insert("kills".into(),self.param(parts,"current_life_extermination","kills")?);"common_ancestors_and_current_kills"}
                    else if has("ancestral_extermination"){v.insert("kills".into(),self.param(parts,"ancestral_extermination","kills")?);"common_ancestors_and_past_kills"}
                    else{v.insert("subject".into(),self.param(parts,"never_defeated","subject")?);"common_undefeated"};
                    return self.grammar("kills",rule,v);
                }
                parts.iter().map(|p|self.leaf(p)).collect()
            }
            "flavor"=>parts.iter().map(|p|self.leaf(p)).collect(),
            "movement"=>{
                let adjectives=parts.iter().filter(|p|p.role=="race_adjective").map(|p|self.values(p).map(|mut v|v.remove("adjective").unwrap_or_default())).collect::<Result<String,_>>()?;
                let noun=if has("race_noun"){self.param(parts,"race_noun","noun")?}else{self.leaf(parts.iter().find(|p|p.role=="generic_creature").ok_or_else(||invalid("race noun"))?)?};
                let kind=self.grammar("movement","race_kind",Self::vals(&[("adjectives",adjectives),("noun",noun)]))?;
                let mut location=Self::vals(&[("race_kind",kind)]);
                let loc=if has("town_location"){self.grammar("movement","town_location",location)?}else{
                    location.insert("feet".into(),self.param(parts,"depth_feet","feet")?);location.insert("level".into(),self.param(parts,"depth_level","level")?);
                    self.grammar("movement",if has("forced_depth_presence"){"forced_depth"}else{"normal_depth"},location)?
                };
                let randomness=self.optional(if has("erratic_extreme"){"random_extreme"}else if has("erratic_somewhat"){"random_somewhat"}else if has("erratic_slight"){"random_slight"}else{"no_randomness"})?;
                let never=self.optional(if has("never_chases_intruders"){"never_pursues"}else{"no_pursuit_clause"})?;
                let mut v=Self::vals(&[("randomness",randomness),("never_move",never)]);
                let role=if has("adjective_description"){v.insert("speed".into(),self.param(parts,"adjective_description","speed")?);"adjective_motion"}
                else{v.insert("normal_factor".into(),self.param(parts,"normal_multiplier","factor")?);
                    if has("same_as_player"){"same_speed_motion"}else{v.insert("player_factor".into(),self.param(parts,"player_multiplier","factor")?);"multiplier_motion"}};
                Ok(loc+&self.grammar("movement",role,v)?)
            }
            "toughness"=>{
                let mut output=String::new();if has("life_rating_subject"){
                    let v=Self::vals(&[("subject",self.param(parts,"life_rating_subject","subject")?),("hp",self.param(parts,"life_rating_value","hp")?),("ac",self.param(parts,"armor_rating_value","armor")?)]);
                    output.push_str(&self.grammar("toughness",if has("average_life_rating"){"average_hp_and_ac"}else{"unique_hp_and_ac"},v)?);
                }
                if has("player_hit_percent"){
                    let article=self.catalog.text(if has("hit_article_vowel"){"angband.knowledge.lore.lexeme.morphology.article_an"}else{"angband.knowledge.lore.lexeme.morphology.article_a"},self.locale)?.to_owned();
                    let v=Self::vals(&[("article",article),("percent",self.param(parts,"player_hit_percent","percent")?)]);output.push_str(&self.grammar("toughness","melee_hit_chance",v)?);
                }Ok(output)
            }
            "experience"=>{
                let introduction=self.leaf(parts.iter().find(|p|p.role=="unique_kill_subject"||p.role=="normal_kill_subject").ok_or_else(||invalid("reward introduction"))?)?;
                let mut v=self.values(parts.iter().find(|p|p.role=="player_level_qualification").ok_or_else(||invalid("reward level"))?)?;
                let point=parts.iter().find(|p|p.role=="experience_points").ok_or_else(||invalid("reward points"))?;
                let mut points=self.values(point)?;v.insert("value".into(),points.remove("experience").ok_or_else(||invalid("reward value"))?);
                v.insert("plural".into(),points.remove("plural").ok_or_else(||invalid("reward plurality"))?);v.insert("introduction".into(),introduction);
                self.grammar("experience","reward",v)
            }
            "drop"=>{
                let mut items=Vec::new();
                for (prefix,kind) in [("general","ordinary_item"),("specific","specific_item")]{
                    let one=format!("{prefix}_single_quantity");let two=format!("{prefix}_one_or_two_quantity");let max=format!("{prefix}_maximum_quantity");
                    if !has(&one)&&!has(&two)&&!has(&max){continue;}
                    let mut v=Values::new();let role=if has(&one){"one"}else if has(&two){"one_or_two"}else{v.insert("count".into(),self.param(parts,&max,"count")?);"maximum"};
                    let quantity=self.grammar(&format!("drop_{prefix}_quantity"),role,v)?;
                    let mut v=Self::vals(&[("quantity",quantity)]);
                    if prefix=="general"{
                        v.insert("quality".into(),self.optional(if has("exceptional_quality"){"exceptional_quality"}else if has("good_quality"){"good_quality"}else{"no_quality"})?);
                        let part=parts.iter().find(|p|["invalid_drop_kind","object_drop_kind","treasure_drop_kind","object_or_treasure_drop_kind"].contains(&p.role.as_str())).ok_or_else(||invalid("drop kind"))?;
                        v.insert("kind".into(),self.leaf(part)?);
                    }items.push(self.grammar("drop",kind,v)?);
                }
                let values=Self::vals(&[("subject",self.param(parts,"carry_subject","subject")?),("items",items.join(self.catalog.text("angband.knowledge.lore.lexeme.morphology.and",self.locale)?))]);
                self.grammar("drop","may_carry",values)
            }
            "abilities"=>{
                let mut output=String::new();let mut subject=None;let mut cursor=0;let mut whole_clause_rendered=false;
                while cursor<parts.len(){let p=&parts[cursor];
                    if p.section!="clause"{
                        if p.role!="resistance_sentence_end" || !whole_clause_rendered{output.push_str(&self.leaf(p)?);}
                        cursor+=1;continue;
                    }
                    let caller=p.caller.clone().ok_or_else(||invalid("ability clause caller"))?;
                    let start=cursor;while cursor<parts.len(){let end=parts[cursor].role=="clause_end";cursor+=1;if end{break;}}
                    let group=&parts[start..cursor];
                    let first=group.first().ok_or_else(||invalid("empty ability clause"))?;
                    if let Some(v)=first.params.get("start").and_then(|r|r.field("params")).and_then(|r|r.field("subject")).and_then(|r|r.field("value")){subject=Some(self.reference(v,0)?);}
                    let traits=group.iter().filter(|p|p.role=="race_flag_description").map(|p|self.values(p).map(|mut v|v.remove("description").unwrap_or_default())).collect::<Result<Vec<_>,_>>()?;
                    let v=Self::vals(&[("subject",subject.clone().ok_or_else(||invalid("missing clause subject"))?),("traits",traits.join(self.catalog.text("angband.knowledge.lore.lexeme.morphology.and",self.locale)?))]);
                    output.push_str(&self.grammar("abilities",&caller,v)?);whole_clause_rendered=true;
                }Ok(output)
            }
            "awareness"=>{
                let mut v=self.values(parts.iter().find(|p|p.role=="awareness_subject_predicate").ok_or_else(||invalid("awareness predicate"))?)?;
                let observer=v.remove("observer").ok_or_else(||invalid("awareness observer"))?;v.insert("repeated_subject".into(),observer);
                v.insert("feet".into(),self.param(parts,"notice_distance","feet")?);self.grammar("awareness","notice_distance",v)
            }
            "friends"=>{
                let values=Self::vals(&[("subject",self.param(parts,"other_monsters","subject")?),("pack_hunt",self.optional(if has("pack_hunting"){"pack_hunt"}else{"no_pack_hunt"})?)]);
                self.grammar("friends","appears_with_monsters",values)
            }
            "spells"=>self.spells(parts),
            "attacks"=>self.attacks(parts),
            _=>Err(invalid("unimplemented section")),
        }
    }
    fn frequency(&mut self,parts:&[Part],prefix:&str)->Result<String,Error>{
        for (mode,rule) in [("exact","exact_frequency"),("approx","approx_frequency")]{let role=format!("{prefix}_{mode}_frequency_denominator");
            if Self::selected(parts,&role){let v=Self::vals(&[("denominator",self.param(parts,&role,"denominator")?)]);return self.grammar("spells",rule,v);}}
        self.optional("no_frequency")
    }
    fn spells(&mut self,parts:&[Part])->Result<String,Error>{
        let mut lists:BTreeMap<&str,Vec<String>>=BTreeMap::new();let mut cursor=0;
        while cursor<parts.len(){let p=&parts[cursor];if p.role!="spell_description"{cursor+=1;continue;}
            let caller=p.caller.as_deref().ok_or_else(||invalid("spell list caller"))?;let spell=self.param(&parts[cursor..cursor+1],"spell_description","description")?;cursor+=1;
            let rendered=if cursor<parts.len()&&parts[cursor].role=="spell_damage"{let damage=self.param(&parts[cursor..cursor+1],"spell_damage","damage")?;cursor+=1;self.grammar("spells","lore_with_damage",Self::vals(&[("spell",spell),("damage",damage)]))?}else{spell};lists.entry(caller).or_default().push(rendered);
        }
        let delimiter=self.catalog.text("angband.knowledge.lore.lexeme.morphology.or",self.locale)?;let mut output=String::new();
        let innate=lists.get("innate");let breath=lists.get("breath");
        if innate.is_some()||breath.is_some(){
            let role=if innate.is_some()&&breath.is_some(){"innate_and_breath"}else if innate.is_some(){"innate"}else{"breath"};
            let subject=self.param(parts,if innate.is_some(){"innate_subject"}else{"breath_subject"},"subject")?;
            let mut v=Self::vals(&[("subject",subject),("frequency",self.frequency(parts,"innate")?)]);
            if role=="innate_and_breath"{v.insert("innate_spells".into(),innate.map(|l|l.join(delimiter)).unwrap_or_default());v.insert("breath_spells".into(),breath.map(|l|l.join(delimiter)).unwrap_or_default());}
            else{v.insert("spells".into(),innate.or(breath).map(|l|l.join(delimiter)).unwrap_or_default());}output.push_str(&self.grammar("spells",role,v)?);
        }
        if let Some(spells)=lists.get("magic"){
            let v=Self::vals(&[("subject",self.param(parts,"magic_subject","subject")?),("spells",spells.join(delimiter)),("frequency",self.frequency(parts,"magic")?),("intelligence",self.optional(if Self::selected(parts,"intelligent_casting"){"intelligent"}else{"no_intelligence"})?)]);
            output.push_str(&self.grammar("spells","magic",v)?);
        }Ok(output)
    }
    fn attacks(&mut self,parts:&[Part])->Result<String,Error>{
        if Self::selected(parts,"no_physical_attacks")||Self::selected(parts,"attacks_unknown"){return parts.iter().map(|p|self.leaf(p)).collect();}
        let mut attacks=Vec::new();let mut cursor=0;
        while cursor<parts.len(){if parts[cursor].role!="attack_method"{cursor+=1;continue;}
            let start=cursor;cursor+=1;while cursor<parts.len()&&!["attack_method","attack_item_separator","attack_final_separator","average_damage_prefix"].contains(&parts[cursor].role.as_str()){cursor+=1;}
            let group=&parts[start..cursor];let method=self.param(group,"attack_method","method")?;
            if !Self::selected(group,"attack_effect"){attacks.push(method);continue;}
            let damage=group.iter().filter(|p|["damage_base","damage_dice","damage_level_bonus"].contains(&p.role.as_str())).map(|p|self.leaf(p)).collect::<Result<String,_>>()?;
            let v=Self::vals(&[("method",method),("effect",self.param(group,"attack_effect","effect")?),("damage",damage),("separator",self.optional(if Self::selected(group,"damage_hit_separator"){"damage_separator"}else{"no_damage_separator"})?),("percent",self.param(group,"attack_hit_percent","percent")?)]);
            attacks.push(self.grammar("attacks","method_and_effect",v)?);
        }
        let v=Self::vals(&[("subject",self.param(parts,"attack_subject","subject")?),("attacks",attacks.join(self.catalog.text("angband.knowledge.lore.lexeme.morphology.and",self.locale)?)),("minimum",self.optional(if Self::selected(parts,"average_damage_lower_bound"){"minimum_damage"}else{"complete_damage"})?),("damage",self.param(parts,"average_damage_value","damage")?),("possessive",self.param(parts,"average_damage_per_turn","possessive")?)]);
        self.grammar("attacks","known_attacks",v)
    }
}

impl ReviewedKnowledgeCatalog {
    /// Validate an owned source-selected section and render it in one locale.
    /// Foreign canonical references are delegated to the existing strict resolver.
    pub(crate) fn render_section<F>(&self,value:&J,locale:Locale,resolve:&mut F)->Result<String,Error>
    where F:FnMut(&J)->Result<String,Error>{
        let (section,parts)=parse(self,value)?;let mut composer=Composer{catalog:self,locale,resolve};
        if locale==Locale::English{parts.iter().map(|p|composer.leaf(p)).collect()}else{composer.japanese(&section,&parts)}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn object(fields: Vec<(&str,J)>)->J {
        J::Object(fields.into_iter().map(|(name,value)|(name.to_owned(),value)).collect())
    }
    fn string(value:&str)->J {J::String(value.to_owned())}
    fn reference(id:&str)->J {object(vec![("id",string(id))])}
    fn typed(kind:&str,value:J)->J {object(vec![("type",string(kind)),("value",value)])}
    fn local(id:&str)->J {typed("localized_text",reference(id))}
    fn integer(value:i64)->J {typed("integer",J::Integer(value))}
    fn part(section:&str,role:&str,params:Vec<(&str,J)>)->J {
        object(vec![("section",string(section)),("role",string(role)),
            ("id",string(&format!("angband.knowledge.lore.{section}.{role}"))),
            ("params",object(params))])
    }
    fn section(name:&str,parts:Vec<J>)->J {
        object(vec![("schema_version",J::Integer(1)),("section",string(name)),("ordered_parts",J::Array(parts))])
    }
    fn render(catalog:&ReviewedKnowledgeCatalog,value:&J,locale:Locale)->Result<String,Error> {
        catalog.render_section(value,locale,&mut |reference| {
            Err(Error::MissingIdentity(reference.field("id").and_then(J::as_str).unwrap_or("missing").to_owned()))
        })
    }
    fn set(value:&mut J,name:&str,new:J) {
        let J::Object(fields)=value else {panic!("test fixture must be an object")};
        if let Some((_,old))=fields.iter_mut().find(|(key,_)|key==name){*old=new;}else{fields.push((name.to_owned(),new));}
    }
    fn town_movement()->J {
        section("movement",vec![
            part("movement","subject_introduction",vec![]),
            part("movement","generic_creature",vec![]),
            part("movement","town_location",vec![]),
            part("movement","movement_transition",vec![]),
            part("movement","speed_spacing",vec![]),
            part("speed_adjective","normal_speed_preposition",vec![]),
            part("speed_adjective","adjective_description",vec![("speed",local("angband.knowledge.lore.lexeme.speed.normal_speed"))]),
            part("movement","sentence_end",vec![]),
        ])
    }
    const SUBJECT:&str="angband.knowledge.lore.lexeme.pronoun.nominative.neuter.title";

    #[test]
    fn native_english_order_and_japanese_movement_grammar_are_independent_and_pure() {
        let catalog=ReviewedKnowledgeCatalog::embedded().unwrap();
        let before=catalog.clone();let capture=town_movement();let original=capture.clone();
        assert_eq!(render(&catalog,&capture,Locale::English).unwrap(),"This creature lives in the town, and moves at normal speed.  ");
        assert_eq!(render(&catalog,&capture,Locale::Japanese).unwrap(),"この生物は町に住んでいる。通常の速さで移動する。  ");
        assert_eq!(catalog,before);assert_eq!(capture,original);
        assert_eq!(render(&catalog,&capture,Locale::Japanese),render(&catalog,&capture,Locale::Japanese));
    }

    #[test]
    fn experience_preserves_minimum_two_fraction_digits_and_native_no_carry_at_one_hundred() {
        let catalog=ReviewedKnowledgeCatalog::embedded().unwrap();
        let amount=object(vec![("id",string("angband.knowledge.lore.statement.experience.hundredths_value")),
            ("params",object(vec![("whole",integer(1)),("hundredths",integer(100))]))]);
        let capture=section("experience",vec![
            part("experience","normal_kill_subject",vec![]),
            part("experience","creature_kill_subject",vec![]),
            part("experience","experience_transition",vec![]),
            part("experience","experience_points",vec![("experience",typed("localized_text",amount)),("plural",local("angband.knowledge.lore.lexeme.morphology.plural"))]),
            part("experience","player_level_qualification",vec![("article",local("angband.knowledge.lore.lexeme.morphology.article_a")),("level",integer(1)),("ordinal",local("angband.knowledge.lore.lexeme.morphology.ordinal_st"))]),
        ]);
        assert_eq!(render(&catalog,&capture,Locale::English).unwrap(),"A kill of this creature is worth 1.100 points for a 1st level character.  ");
        let japanese=render(&catalog,&capture,Locale::Japanese).unwrap();
        assert!(japanese.contains("1.100"));assert!(japanese.contains("レベル1"));
        assert!(!japanese.contains("1st"));
        let mut resolver=|value:&J|Err(Error::MissingIdentity(format!("{value:?}")));
        let mut composer=Composer{catalog:&catalog,locale:Locale::Japanese,resolve:&mut resolver};
        let fraction=object(vec![("id",string("angband.knowledge.lore.statement.experience.hundredths_value")),
            ("params",object(vec![("whole",integer(1)),("hundredths",integer(5))]))]);
        assert_eq!(composer.reference(&fraction,0).unwrap(),"1.05");
    }

    #[test]
    fn known_and_average_toughness_keep_actual_hp_ac_visibility_condition_and_percent() {
        let catalog=ReviewedKnowledgeCatalog::embedded().unwrap();
        let capture=section("toughness",vec![
            part("toughness","life_rating_subject",vec![("subject",local(SUBJECT))]),
            part("toughness","average_life_rating",vec![]),part("toughness","life_rating_label",vec![]),
            part("toughness","life_rating_value",vec![("hp",integer(20))]),
            part("toughness","armor_rating_label",vec![]),part("toughness","armor_rating_value",vec![("armor",integer(10))]),
            part("toughness","ratings_end",vec![]),part("toughness","player_hit_subject",vec![]),
            part("toughness","player_hit_percent",vec![("percent",integer(55))]),part("toughness","player_hit_end",vec![]),
        ]);
        assert_eq!(render(&catalog,&capture,Locale::English).unwrap(),"It has an average life rating of 20, and an armor rating of 10.  You have a 55% chance to hit such a creature in melee (if you can see it).  ");
        assert_eq!(render(&catalog,&capture,Locale::Japanese).unwrap(),"この生物の平均HPは20、防御力は10。  この生物が見えていれば、近接攻撃の命中率は55%。  ");
    }

    #[test]
    fn drop_and_friends_use_whole_predicates_and_selected_optional_roles() {
        let catalog=ReviewedKnowledgeCatalog::embedded().unwrap();
        let drop=section("drop",vec![part("drop","carry_subject",vec![("subject",local(SUBJECT))]),
            part("drop","general_single_quantity",vec![]),part("drop","good_quality",vec![]),
            part("drop","object_drop_kind",vec![("plural",local("angband.knowledge.lore.lexeme.morphology.singular"))]),
            part("drop","carry_end",vec![])]);
        assert_eq!(render(&catalog,&drop,Locale::English).unwrap(),"It may carry a single good object.  ");
        assert_eq!(render(&catalog,&drop,Locale::Japanese).unwrap(),"この生物は1つの上質な品を持っていることがある。  ");
        let friends=section("friends",vec![part("friends","other_monsters",vec![("subject",local(SUBJECT))]),
            part("friends","pack_hunting",vec![]),part("friends","sentence_end",vec![])]);
        assert_eq!(render(&catalog,&friends,Locale::English).unwrap(),"It may appear with other monsters and hunts in packs.  ");
        let japanese=render(&catalog,&friends,Locale::Japanese).unwrap();
        assert!(japanese.contains("群れで狩りをする"));assert!(!japanese.contains("。。"));
    }

    #[test]
    fn selected_clause_identity_coalesces_fire_without_exposing_private_flag_coordinates() {
        let catalog=ReviewedKnowledgeCatalog::embedded().unwrap();
        let start=object(vec![("id",string("angband.knowledge.lore.statement.clause_start.vulnerability_prefix")),
            ("params",object(vec![("subject",local(SUBJECT))]))]);
        let mut parts=vec![part("clause","clause_start",vec![("start",typed("localized_text",start))]),
            part("clause","race_flag_description",vec![("description",local("angband.knowledge.lore.lexeme.race_flag.fire"))]),
            part("clause","clause_end",vec![("end",local("angband.knowledge.lore.lexeme.projection.clause_continues"))])];
        for part in &mut parts{set(part,"caller",string("vulnerability"));}
        parts.push(part("abilities","resistance_sentence_end",vec![]));
        let capture=section("abilities",parts);
        assert_eq!(render(&catalog,&capture,Locale::English).unwrap(),"It is hurt by fire.  ");
        assert_eq!(render(&catalog,&capture,Locale::Japanese).unwrap(),"この生物は火炎に弱い。  ");
    }

    #[test]
    fn unknown_sections_versions_and_unselected_root_fields_are_rejected() {
        let catalog=ReviewedKnowledgeCatalog::embedded().unwrap();
        for (name,value) in [("section",string("hidden_race")),("schema_version",J::Integer(2)),("ridx",J::Integer(623))]{
            let mut capture=town_movement();set(&mut capture,name,value);
            assert!(render(&catalog,&capture,Locale::Japanese).is_err(),"{name}");
        }
        let empty=section("movement",vec![]);assert!(render(&catalog,&empty,Locale::English).is_err());
    }

    #[test]
    fn mismatched_identity_nested_section_caller_and_extra_part_fields_are_rejected() {
        let catalog=ReviewedKnowledgeCatalog::embedded().unwrap();
        for (name,value) in [("id",string("angband.knowledge.lore.drop.carry_subject")),("section",string("drop")),
            ("caller",string("resistance")),("unused_knowledge",J::Bool(true))]{
            let mut bad=part("movement","generic_creature",vec![]);set(&mut bad,name,value);
            assert!(render(&catalog,&section("movement",vec![bad]),Locale::Japanese).is_err(),"{name}");
        }
    }

    #[test]
    fn exact_parameter_set_type_native_range_and_original_color_bound_are_enforced() {
        let catalog=ReviewedKnowledgeCatalog::embedded().unwrap();
        for parameters in [vec![],vec![("feet",local(SUBJECT))],vec![("feet",integer(i64::MAX))],
            vec![("feet",integer(50)),("hidden_level",integer(1))]]{
            let capture=section("movement",vec![part("movement","depth_feet",parameters)]);
            assert!(render(&catalog,&capture,Locale::English).is_err());
        }
        let mut p=part("movement","generic_creature",vec![]);
        set(&mut p,"presentation",object(vec![("color",J::Integer(256))]));
        assert!(render(&catalog,&section("movement",vec![p]),Locale::English).is_err());
    }

    #[test]
    fn unknown_refs_fail_explicitly_and_nested_refs_are_bounded() {
        let catalog=ReviewedKnowledgeCatalog::embedded().unwrap();
        let unknown=section("speed_adjective",vec![]);
        let mut resolver=|value:&J|Err(Error::MissingIdentity(format!("{value:?}")));
        let mut composer=Composer{catalog:&catalog,locale:Locale::Japanese,resolve:&mut resolver};
        assert!(composer.reference(&reference("unreviewed.completed.english"),0).is_err());
        let mut nested=reference(SUBJECT);
        for _ in 0..10{nested=object(vec![("id",string("angband.knowledge.grammar.rune.description.flag")),
            ("params",object(vec![("property",typed("localized_text",nested))]))]);}
        assert!(composer.reference(&nested,0).is_err());
        assert!(render(&catalog,&unknown,Locale::Japanese).is_err());
    }
}
