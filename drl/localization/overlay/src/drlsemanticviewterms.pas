{$INCLUDE drl.inc}
{ Finite original enum/group presentation terms. Domain arrays stay English. GPL-2.0. }
unit drlsemanticviewterms;
interface
uses dfdata;
function DRLViewDamageTypeName(aType: TDamageType; const aEnglish: AnsiString): AnsiString;
function DRLViewResistanceName(aType: TResistance; const aEnglish: AnsiString): AnsiString;
function DRLViewResistanceLabel(aType: TResistance; const aEnglish: AnsiString): AnsiString;
function DRLViewWeaponGroupName(const aGroupID, aEnglish: AnsiString): AnsiString;
implementation
uses sysutils, vtig, drlsemantictext;
function DRLViewDamageTypeName(aType: TDamageType; const aEnglish: AnsiString): AnsiString;
begin
  case aType of
    Damage_Bullet: if aEnglish = 'bullet' then Exit(DRLText('term.damage-type.bullet', aEnglish)) else Exit(aEnglish);
    Damage_Melee: if aEnglish = 'melee' then Exit(DRLText('term.damage-type.melee', aEnglish)) else Exit(aEnglish);
    Damage_Sharpnel: if aEnglish = 'shred' then Exit(DRLText('term.damage-type.shred', aEnglish)) else Exit(aEnglish);
    Damage_Acid: if aEnglish = 'acid' then Exit(DRLText('term.damage-type.acid', aEnglish)) else Exit(aEnglish);
    Damage_Fire: if aEnglish = 'fire' then Exit(DRLText('term.damage-type.fire', aEnglish)) else Exit(aEnglish);
    Damage_Cold: if aEnglish = 'cold' then Exit(DRLText('term.damage-type.cold', aEnglish)) else Exit(aEnglish);
    Damage_Poison: if aEnglish = 'poison' then Exit(DRLText('term.damage-type.poison', aEnglish)) else Exit(aEnglish);
    Damage_Plasma: if aEnglish = 'plasma' then Exit(DRLText('term.damage-type.plasma', aEnglish)) else Exit(aEnglish);
    Damage_SPlasma: if aEnglish = 'plasma' then Exit(DRLText('term.damage-type.plasma', aEnglish)) else Exit(aEnglish);
    Damage_IgnoreArmor: if aEnglish = 'heavy' then Exit(DRLText('term.damage-type.heavy', aEnglish)) else Exit(aEnglish);
    Damage_Pierce: if aEnglish = 'pierce' then Exit(DRLText('term.damage-type.pierce', aEnglish)) else Exit(aEnglish);
  end;
  Exit(aEnglish);
end;
function DRLViewResistanceName(aType: TResistance; const aEnglish: AnsiString): AnsiString;
begin
  case aType of
    Resist_Bullet: if aEnglish = 'Bullet' then Exit(DRLText('term.resistance.bullet', aEnglish)) else Exit(aEnglish);
    Resist_Melee: if aEnglish = 'Melee' then Exit(DRLText('term.resistance.melee', aEnglish)) else Exit(aEnglish);
    Resist_Shrapnel: if aEnglish = 'Shrap' then Exit(DRLText('term.resistance.shrapnel', aEnglish)) else Exit(aEnglish);
    Resist_Acid: if aEnglish = 'Acid' then Exit(DRLText('term.resistance.acid', aEnglish)) else Exit(aEnglish);
    Resist_Fire: if aEnglish = 'Fire' then Exit(DRLText('term.resistance.fire', aEnglish)) else Exit(aEnglish);
    Resist_Plasma: if aEnglish = 'Plasma' then Exit(DRLText('term.resistance.plasma', aEnglish)) else Exit(aEnglish);
    Resist_Cold: if aEnglish = 'Cold' then Exit(DRLText('term.resistance.cold', aEnglish)) else Exit(aEnglish);
    Resist_Poison: if aEnglish = 'Poison' then Exit(DRLText('term.resistance.poison', aEnglish)) else Exit(aEnglish);
    Resist_Pierce: if aEnglish = 'Pierce' then Exit(DRLText('term.resistance.pierce', aEnglish)) else Exit(aEnglish);
  end;
  Exit(aEnglish);
end;
function DRLViewWeaponGroupName(const aGroupID, aEnglish: AnsiString): AnsiString;
begin
  if aGroupID = 'melee' then
    if aEnglish = 'melee' then Exit(DRLText('term.weapon-group.melee', aEnglish)) else Exit(aEnglish);
  if aGroupID = 'pistol' then
    if aEnglish = 'pistol' then Exit(DRLText('term.weapon-group.pistol', aEnglish)) else Exit(aEnglish);
  if aGroupID = 'shotgun' then
    if aEnglish = 'shotgun' then Exit(DRLText('term.weapon-group.shotgun', aEnglish)) else Exit(aEnglish);
  if aGroupID = 'rocket' then
    if aEnglish = 'rocket' then Exit(DRLText('term.weapon-group.rocket', aEnglish)) else Exit(aEnglish);
  if aGroupID = 'chain' then
    if aEnglish = 'chaingun' then Exit(DRLText('term.weapon-group.chain', aEnglish)) else Exit(aEnglish);
  if aGroupID = 'plasma' then
    if aEnglish = 'plasma' then Exit(DRLText('term.weapon-group.plasma', aEnglish)) else Exit(aEnglish);
  if aGroupID = 'bfg' then
    if aEnglish = 'BFG' then Exit(DRLText('term.weapon-group.bfg', aEnglish)) else Exit(aEnglish);
  Exit(aEnglish);
end;
function DRLViewResistanceLabel(aType: TResistance; const aEnglish: AnsiString): AnsiString;
var iName: AnsiString;
    iColumns: Integer;
begin
  iName := DRLViewResistanceName(aType, aEnglish);
  iColumns := VTIG_Length(iName);
  if iColumns < 7 then Exit(iName + StringOfChar(' ', 7 - iColumns));
  Exit(iName);
end;
end.
