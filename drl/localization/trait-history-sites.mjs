/** Ordered trait display metadata is read from original order, never inferred from totals. */
export function curateTraitHistorySites({exact}){
 const f='src/drltraits.pas',player='src/dfplayer.pas';
 exact(f,'function GetHistory : AnsiString;','function GetHistory : AnsiString;\r\n  function GetHistoryIDs : TBytes;');
 exact(f,'function TTraits.GetHistory: AnsiString;',`function TTraits.GetHistoryIDs: TBytes;\r\nvar i, count: SizeInt;\r\nbegin\r\n  SetLength(Result, High(FOrder));\r\n  count := 0;\r\n  for i := 1 to High(FOrder) do\r\n    if (FOrder[i] > 0) and (FOrder[i] <= High(FValues)) then\r\n    begin\r\n      Result[count] := FOrder[i];\r\n      Inc(count);\r\n    end;\r\n  SetLength(Result, count);\r\nend;\r\n\r\nfunction TTraits.GetHistory: AnsiString;`);
 exact(player,'function lua_player_get_trait_hist(L: Plua_State): Integer; cdecl;',`function lua_player_get_trait_history_ids(L: Plua_State): Integer; cdecl;\r\nvar State: TDRLLuaState; Being: TBeing; IDs: TBytes; i: SizeInt;\r\nbegin\r\n  State.Init(L);\r\n  Being := State.ToObject(1) as TBeing;\r\n  if not (Being is TPlayer) then Exit(0);\r\n  IDs := TPlayer(Being).Traits.GetHistoryIDs;\r\n  lua_createtable(L, Length(IDs), 0);\r\n  for i := 0 to High(IDs) do State.RawSetField(-1, LongInt(i+1), LongInt(IDs[i]));\r\n  Result := 1;\r\nend;\r\n\r\nfunction lua_player_get_trait_hist(L: Plua_State): Integer; cdecl;`);
 exact(player,'const lua_player_lib : array[0..18] of luaL_Reg = (','const lua_player_lib : array[0..19] of luaL_Reg = (');
 exact(player,"( name : 'get_trait_hist';  func : @lua_player_get_trait_hist),","( name : 'get_trait_hist';  func : @lua_player_get_trait_hist),\r\n      ( name : 'get_trait_history_ids'; func : @lua_player_get_trait_history_ids),");
 return{requiredUnits:{[player]:['vlualibrary']},nativeFullUnitCompiled:false,originalGetHistoryAndUpgradeAndSaveUntouched:true};
}
