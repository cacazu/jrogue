/** Original DRL death-message producer is a display callback, not saved result text. */
export function curateDeathProducerSites({exact,catalog}){
 const f='bin/data/drl/main.lua';
 catalog('message.death.visible','{{subject}} dies.','{{subject}}は死んだ。',{subject:'string'});
 catalog('message.death.heard','You hear the scream of a freed soul!','解き放たれた魂の悲鳴が聞こえる！');
 exact(f,'function drl.GetDeathMessage( being, visible )\n\tif visible then return being:get_name( true, true ).." dies." end\n\treturn "You hear the scream of a freed soul!"\nend',
  'function drl.GetDeathMessage( being, visible )\n\tif visible then return ui.semantic_text("message.death.visible", "{{subject}} dies.", {{name="subject",kind="string",value=ui.being_name(being, true, true)}}) end\n\treturn ui.semantic_text("message.death.heard", "You hear the scream of a freed soul!")\nend','message.death.visible');
 return{consumer:{file:'src/dfbeing.pas',line:2300,original:'IO.Msg( iDeathMessage )',producer:{file:f,name:'drl.GetDeathMessage',ids:['message.death.visible','message.death.heard']}},persistedResultDescriptionUnchanged:true};
}
