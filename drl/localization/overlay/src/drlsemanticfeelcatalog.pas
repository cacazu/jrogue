{ Generated exact reviewed feeling-catalog validator, GPL-2.0. }
unit drlsemanticfeelcatalog;
{$mode objfpc}{$H+}
interface
uses drlsemantictext;
function DRLValidateFeelingRequest(const aID, aEnglish: AnsiString; const aParams: array of TDRLTextParam): Boolean;
function DRLRememberRegistryFeeling(const aCategory, aRegistryID, aScope, aField, aEnglish, aJoinBefore, aFullEnglishGuard: AnsiString): Boolean;
implementation
uses drlsemanticfeelings;
type TFeelingCatalogRow = record ID, English: AnsiString; FirstParam, ParamCount: Integer; end;
const CFeelingTexts: array[0..79] of TFeelingCatalogRow = (
 (ID:'message.event.armed-nuke.countdown';English:'"Thermonuclear bomb deployed. {{minutes}} minutes till explosion."';FirstParam:0;ParamCount:1),
 (ID:'message.feeling.alarm';English:'As you enter, some weird alarm starts howling!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.deadly-air';English:'The air seems deadly here, you better leave quick!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.distant-battle-cry';English:'A battle cry chants in the distance!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.exit-found';English:'...Oh, there it is. D''oh.';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.exit-lost';English:'Where the hell is the way out of here!?!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.familiar-object';English:'Descending the staircase you spot a familiar object...';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.hardened-walls';English:'The walls here seem tough!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.hell-big-guns';English:'You hear sounds of hellish mortars! They rolled out the BIG GUNS!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.hell-frozen';English:'Yes... Hell just froze over...';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.hell-mortars';English:'You hear sounds of hellish mortars!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.hellish-magic';English:'Hellish magic haunts the air!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.incoming-mess';English:'Khe, he, he, this will be a mess...';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.marching-feet';English:'You hear many marching feet.';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.monsters-everywhere';English:'Suddenly monsters come from everywhere!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.pitch-black';English:'This floor is pitch-black!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.run-urgently';English:'You feel the sudden need to run!!!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.targeted';English:'You feel you''re being targeted!';FirstParam:1;ParamCount:0),
 (ID:'message.feeling.unholy-energy';English:'Unholy energy fills the air!!!';FirstParam:1;ParamCount:0),
 (ID:'message.generator.cave.agony-feeling';English:'You hear echoing wails of agony!';FirstParam:1;ParamCount:0),
 (ID:'message.generator.cave.default-feeling';English:'Twisted passages carry the smell of death...';FirstParam:1;ParamCount:0),
 (ID:'message.generator.cave.lava-feeling';English:'The cave temperature is insanely hot!';FirstParam:1;ParamCount:0),
 (ID:'message.generator.single-plus.bruiser-intro';English:'You hear loud wails that cannot mean anything good!';FirstParam:1;ParamCount:0),
 (ID:'message.generator.single-plus.cyberdemon-intro';English:'Suddenly you have a great urge to turn back! You scream in TERROR!';FirstParam:1;ParamCount:0),
 (ID:'message.generator.single-plus.shambler-intro';English:'The air is crackling with electricity!';FirstParam:1;ParamCount:0),
 (ID:'message.generator.single.arch-vile-intro';English:'You hear crackling flames!';FirstParam:1;ParamCount:0),
 (ID:'message.generator.single.imp-intro';English:'The walls are scratched and flame-scorched!';FirstParam:1;ParamCount:0),
 (ID:'message.generator.single.mancubus-intro';English:'You hear deep, guttural noises!';FirstParam:1;ParamCount:0),
 (ID:'message.generator.single.revenant-intro';English:'Bones clatter all around you!';FirstParam:1;ParamCount:0),
 (ID:'message.generator.special-stairs.breeze';English:'You feel a breeze of morbid air...';FirstParam:1;ParamCount:0),
 (ID:'message.generator.special-stairs.cold';English:'You shiver from cold...';FirstParam:1;ParamCount:0),
 (ID:'message.generator.special-stairs.passage';English:'You sense a passage to a place beyond...';FirstParam:1;ParamCount:0),
 (ID:'message.level.hells-arena.final-refusal-crowd';English:'You hear screams everywhere! "Boooo..."';FirstParam:1;ParamCount:0),
 (ID:'message.level.hells-arena.final-round-accepted';English:'The voice booms, "Excellent! May the fight begin!!!"';FirstParam:1;ParamCount:0),
 (ID:'message.level.hells-arena.final-round-crowd';English:'You hear screams everywhere! "Kill, Kill, KILL!"';FirstParam:1;ParamCount:0),
 (ID:'message.level.hells-arena.final-round-refused';English:'The voice booms, "Too bad, you won''t make it far then...!" ';FirstParam:1;ParamCount:0),
 (ID:'message.level.hells-armory.heavy-machinery-sound';English:'You hear the sounds of heavy machinery.';FirstParam:1;ParamCount:0),
 (ID:'message.level.limbo.arch-viles-arrived';English:'Suddenly with a wail, arch-viles appear!';FirstParam:1;ParamCount:0),
 (ID:'message.level.limbo.arrival-blood-stench';English:'The smell of blood! You can barely believe this living hell...';FirstParam:1;ParamCount:0),
 (ID:'message.level.mortuary.arch-viles-arrived';English:'Suddenly with a wail, arch-viles appear!';FirstParam:1;ParamCount:0),
 (ID:'message.level.mortuary.arrival-blood-stench';English:'The smell of blood! Can this be real?? The floor is';FirstParam:1;ParamCount:0),
 (ID:'message.level.mortuary.arrival-corpses-everywhere';English:'covered in blood, and there are corpses everywhere!';FirstParam:1;ParamCount:0),
 (ID:'message.level.phobos-anomaly.arrival-tension';English:'You sense a certain tension.';FirstParam:1;ParamCount:0),
 (ID:'message.nuke.deployed-long';English:'"Thermonuclear bomb deployed. 5 minutes till explosion."';FirstParam:1;ParamCount:0),
 (ID:'message.nuke.deployed-short';English:'"Thermonuclear bomb deployed. 2 minutes 30 seconds till explosion."';FirstParam:1;ParamCount:0),
 (ID:'message.room.lever.acid-warning';English:'In the State of Denmark there was the odor of decay...';FirstParam:1;ParamCount:0),
 (ID:'message.room.lever.kill-warning';English:'The smell of a massacre...';FirstParam:1;ParamCount:0),
 (ID:'message.room.lever.lava-warning';English:'You feel that smell? That gasoline smell? Oh hell...';FirstParam:1;ParamCount:0),
 (ID:'message.room.lever.walls-warning';English:'You hear the trumpets of Jericho echoing in the distance...';FirstParam:1;ParamCount:0),
 (ID:'message.room.lever.water-warning';English:'The air is really humid here...';FirstParam:1;ParamCount:0),
 (ID:'message.room.vault.blood-feeling';English:'There''s the smell of blood in the air!';FirstParam:1;ParamCount:0),
 (ID:'message.room.vault.excited-feeling';English:'You feel excited!';FirstParam:1;ParamCount:0),
 (ID:'message.room.vault.special-feeling';English:'There''s something special here...';FirstParam:1;ParamCount:0),
 (ID:'message.valuable-feeling';English:'You feel there is something really valuable here!';FirstParam:1;ParamCount:0),
 (ID:'term.level.abyssal-plains.welcome';English:'You enter the Abyssal Plains. Well isn''t this... just... dandy.';FirstParam:1;ParamCount:0),
 (ID:'term.level.central-processing.welcome';English:'You enter Central Processing. You shudder, thinking about the evil mastermind who planned this.';FirstParam:1;ParamCount:0),
 (ID:'term.level.city-of-skulls.welcome';English:'You enter a city made out of bones. You sense a certain tension.';FirstParam:1;ParamCount:0),
 (ID:'term.level.containment-area.welcome';English:'You enter the Containment Area. You feel something is hidden behind this wall.';FirstParam:1;ParamCount:0),
 (ID:'term.level.deimos-lab.welcome';English:'You arrive at the Deimos Lab entry area.';FirstParam:1;ParamCount:0),
 (ID:'term.level.dis.welcome';English:'You enter the damned city of Dis...';FirstParam:1;ParamCount:0),
 (ID:'term.level.halls-of-carnage.welcome';English:'You enter the Halls of Carnage. You feel you need to run!';FirstParam:1;ParamCount:0),
 (ID:'term.level.hell-fortress.welcome';English:'This is it. This is the lair of all evil! What will you meet here?';FirstParam:1;ParamCount:0),
 (ID:'term.level.hellgate.welcome';English:'You arrive at the Phobos Anomaly.';FirstParam:1;ParamCount:0),
 (ID:'term.level.hells-arena.welcome';English:'You enter Hell''s Arena';FirstParam:1;ParamCount:0),
 (ID:'term.level.hells-armory.welcome';English:'You enter Hell''s Armory.';FirstParam:1;ParamCount:0),
 (ID:'term.level.house-of-pain.welcome';English:'You enter the House of Pain.';FirstParam:1;ParamCount:0),
 (ID:'term.level.limbo.welcome';English:'You arrive at Limbo.';FirstParam:1;ParamCount:0),
 (ID:'term.level.military-base.welcome';English:'You enter the Military Base. Arriving here again sure takes you back!';FirstParam:1;ParamCount:0),
 (ID:'term.level.mt-erebus.welcome';English:'You arrive at Mt. Erebus. You shiver before the mountain of eternal fire!';FirstParam:1;ParamCount:0),
 (ID:'term.level.phobos-arena.welcome';English:'You enter a big arena. There''s blood everywhere. You hear heavy mechanical footsteps...';FirstParam:1;ParamCount:0),
 (ID:'term.level.phobos-lab.welcome';English:'You arrive at the Phobos Lab. You are overcome by the feeling of nostalgia!';FirstParam:1;ParamCount:0),
 (ID:'term.level.spiders-lair.welcome';English:'You descend into the Spider''s Lair. Mechanical clicks everywhere! Oh my god it''s full of spiders!';FirstParam:1;ParamCount:0),
 (ID:'term.level.the-chained-court.welcome';English:'Welcome to the Chained Court...';FirstParam:1;ParamCount:0),
 (ID:'term.level.the-lava-pits.welcome';English:'You descend into the Lava Pits. Dammit, it''s hot in here!';FirstParam:1;ParamCount:0),
 (ID:'term.level.the-mortuary.welcome';English:'You enter the Mortuary.';FirstParam:1;ParamCount:0),
 (ID:'term.level.the-vaults.welcome';English:'You enter the Vaults. There''s a presence here...';FirstParam:1;ParamCount:0),
 (ID:'term.level.the-wall.welcome';English:'You arrive at the Wall. You feel uneasy.';FirstParam:1;ParamCount:0),
 (ID:'term.level.tower-of-babel.welcome';English:'You enter a big arena. There''s blood everywhere. You hear heavy mechanical footsteps...';FirstParam:1;ParamCount:0),
 (ID:'term.level.toxin-refinery.welcome';English:'The stench of toxins chokes you briefly.';FirstParam:1;ParamCount:0),
 (ID:'term.level.unholy-cathedral.welcome';English:'You arrive at the Unholy Cathedral. You feel something sinister in the air.';FirstParam:1;ParamCount:0)
);
const CFeelingParams: array[0..0] of record Name: AnsiString; Kind: TDRLTextParamKind; end = (
 (Name:'minutes';Kind:DRL_TEXT_INTEGER)
);
function DRLValidateFeelingRequest(const aID, aEnglish: AnsiString; const aParams: array of TDRLTextParam): Boolean;
var i,j,k: Integer; found: Boolean;
begin
 for i:=0 to High(CFeelingTexts) do if CFeelingTexts[i].ID=aID then begin
  if (CFeelingTexts[i].English<>aEnglish) or (CFeelingTexts[i].ParamCount<>Length(aParams)) then Exit(False);
  for j:=0 to CFeelingTexts[i].ParamCount-1 do begin
   found:=False;for k:=0 to High(aParams) do if (aParams[k].Name=CFeelingParams[CFeelingTexts[i].FirstParam+j].Name) and (aParams[k].Kind=CFeelingParams[CFeelingTexts[i].FirstParam+j].Kind) then found:=True;
   if not found then Exit(False);
  end;Exit(True);
 end;Exit(False);
end;
function DRLRememberRegistryFeeling(const aCategory, aRegistryID, aScope, aField, aEnglish, aJoinBefore, aFullEnglishGuard: AnsiString): Boolean;
begin
 if (aCategory='level') and (aRegistryID='abyssal_plains') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter the Abyssal Plains. Well isn''t this... just... dandy.') then Exit(DRLRememberSemanticFeeling('term.level.abyssal-plains.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='hells_arena') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter Hell''s Arena') then Exit(DRLRememberSemanticFeeling('term.level.hells-arena.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='hells_armory') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter Hell''s Armory.') then Exit(DRLRememberSemanticFeeling('term.level.hells-armory.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='hellgate') and (aScope='base_game') and (aField='welcome') and (aEnglish='You arrive at the Phobos Anomaly.') then Exit(DRLRememberSemanticFeeling('term.level.hellgate.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='tower_of_babel') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter a big arena. There''s blood everywhere. You hear heavy mechanical footsteps...') then Exit(DRLRememberSemanticFeeling('term.level.tower-of-babel.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='dis') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter the damned city of Dis...') then Exit(DRLRememberSemanticFeeling('term.level.dis.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='hell_fortress') and (aScope='base_game') and (aField='welcome') and (aEnglish='This is it. This is the lair of all evil! What will you meet here?') then Exit(DRLRememberSemanticFeeling('term.level.hell-fortress.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='halls_of_carnage') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter the Halls of Carnage. You feel you need to run!') then Exit(DRLRememberSemanticFeeling('term.level.halls-of-carnage.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='central_processing') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter Central Processing. You shudder, thinking about the evil mastermind who planned this.') then Exit(DRLRememberSemanticFeeling('term.level.central-processing.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='the_chained_court') and (aScope='base_game') and (aField='welcome') and (aEnglish='Welcome to the Chained Court...') then Exit(DRLRememberSemanticFeeling('term.level.the-chained-court.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='containment_area') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter the Containment Area. You feel something is hidden behind this wall.') then Exit(DRLRememberSemanticFeeling('term.level.containment-area.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='deimos_lab') and (aScope='base_game') and (aField='welcome') and (aEnglish='You arrive at the Deimos Lab entry area.') then Exit(DRLRememberSemanticFeeling('term.level.deimos-lab.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='unholy_cathedral') and (aScope='base_game') and (aField='welcome') and (aEnglish='You arrive at the Unholy Cathedral. You feel something sinister in the air.') then Exit(DRLRememberSemanticFeeling('term.level.unholy-cathedral.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='house_of_pain') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter the House of Pain.') then Exit(DRLRememberSemanticFeeling('term.level.house-of-pain.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='the_lava_pits') and (aScope='base_game') and (aField='welcome') and (aEnglish='You descend into the Lava Pits. Dammit, it''s hot in here!') then Exit(DRLRememberSemanticFeeling('term.level.the-lava-pits.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='limbo') and (aScope='base_game') and (aField='welcome') and (aEnglish='You arrive at Limbo.') then Exit(DRLRememberSemanticFeeling('term.level.limbo.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='military_base') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter the Military Base. Arriving here again sure takes you back!') then Exit(DRLRememberSemanticFeeling('term.level.military-base.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='the_mortuary') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter the Mortuary.') then Exit(DRLRememberSemanticFeeling('term.level.the-mortuary.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='mt_erebus') and (aScope='base_game') and (aField='welcome') and (aEnglish='You arrive at Mt. Erebus. You shiver before the mountain of eternal fire!') then Exit(DRLRememberSemanticFeeling('term.level.mt-erebus.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='phobos_lab') and (aScope='base_game') and (aField='welcome') and (aEnglish='You arrive at the Phobos Lab. You are overcome by the feeling of nostalgia!') then Exit(DRLRememberSemanticFeeling('term.level.phobos-lab.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='city_of_skulls') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter a city made out of bones. You sense a certain tension.') then Exit(DRLRememberSemanticFeeling('term.level.city-of-skulls.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='spiders_lair') and (aScope='base_game') and (aField='welcome') and (aEnglish='You descend into the Spider''s Lair. Mechanical clicks everywhere! Oh my god it''s full of spiders!') then Exit(DRLRememberSemanticFeeling('term.level.spiders-lair.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='toxin_refinery') and (aScope='base_game') and (aField='welcome') and (aEnglish='The stench of toxins chokes you briefly.') then Exit(DRLRememberSemanticFeeling('term.level.toxin-refinery.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='the_vaults') and (aScope='base_game') and (aField='welcome') and (aEnglish='You enter the Vaults. There''s a presence here...') then Exit(DRLRememberSemanticFeeling('term.level.the-vaults.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='the_wall') and (aScope='base_game') and (aField='welcome') and (aEnglish='You arrive at the Wall. You feel uneasy.') then Exit(DRLRememberSemanticFeeling('term.level.the-wall.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 if (aCategory='level') and (aRegistryID='phobos_arena') and (aScope='bundled_classic') and (aField='welcome') and (aEnglish='You enter a big arena. There''s blood everywhere. You hear heavy mechanical footsteps...') then Exit(DRLRememberSemanticFeeling('term.level.phobos-arena.welcome',aEnglish,[],aJoinBefore,aFullEnglishGuard));
 Exit(False);
end;
initialization
 DRLSemanticFeelingValidator := @DRLValidateFeelingRequest;
end.
