-- Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained.
-- DRL plot lua script file --

function drl.OnIntro( skip )
--	if core.game_type() ~= GAMESTANDARD then return end
	if skip then return end
	ui.blood_slide()
	ui.plot_screen(ui.semantic_text("message.plot.intro-wait", "The trip was long -- you thought it would never end. But hell, a marine's job is rarely interesting. You hate the UAC -- nothing ever happens here. Now you've got to sit around and wait for your squadmates, who are supposed to check out what happened on Phobos.\n\nNot knowing what to do with yourself, you lean back near the comm console and listen for news from your fellow marines.\n"), RED)
	ui.plot_screen(ui.semantic_text("message.plot.intro-contact", "Suddenly...\n\n\"Hell, what a bloodbath!\" you hear from the comm. \"Corpses Everywhere!\"\n\n\"What happened?!\"\n\n\"Look, there's someone there!\"\n\n\"Oh, no! God!\"\n\nGunshots.\n\nMore Gunshots."), RED)
	ui.plot_screen(ui.semantic_text("message.plot.intro-silence", "\"This can't be happening!\"\n\n\"Help! Help, I'm...\" <SPLAT!>\n\n\"Jake! Where are you?! What happ... oh, fuck!\"\n\n<BANG! BANG! BANG!>\n\nSlurp.\n\nSilence."), RED)
end

function drl.plot_outro_1()
--	if core.game_type() ~= GAMESTANDARD then return end
	ui.blood_slide()
	ui.plot_screen(ui.semantic_text("message.plot.deimos-arrival", "Once you beat the big badasses and clean out the moon base you're supposed to win, aren't you? Aren't you? Where's your fat reward and ticket back home? What the hell is this? It's not supposed to end this way!\n\nIt stinks like rotten meat but it looks like the lost Deimos base. Looks like you're stuck on The Shores of Hell. And the only way out is through...\n"), RED)
end

function drl.plot_outro_2()
--	if core.game_type() ~= GAMESTANDARD then return end
	ui.blood_slide()
	ui.plot_screen(ui.semantic_text("message.plot.hell-arrival", "You've done it! The hideous Cyberdemon lord that ruled the lost Deimos moon base has been slain and you are triumphant!  But ... where are you? You clamber to the edge of the moon and look down to see the awful truth.\n\nDeimos floats above Hell itself! You've never heard of anyone escaping from Hell, but you'll make the bastards sorry they ever heard of you! Quickly, you rappel down to the surface of Hell.\n\nNow, it's on to the final chapter of DRL -- Inferno!"), RED)
end

function drl.plot_outro_3()
-- if core.game_type() ~= GAMESTANDARD then return end
	ui.blood_slide()
	ui.plot_screen(ui.semantic_text("message.plot.earth-return", "The loathsome Spiderdemon that masterminded the invasion of the moon bases and caused so much death has had her ass kicked for all time.\n\nA hidden doorway opens and you enter. You've proven too tough for Hell to contain, and now Hell at last plays fair -- for you emerge from the door to see the green fields of Earth! Home at last.\n\nYou wonder what's been happening on Earth while you were battling evil unleashed. It's good that no Hellspawn could have come through that door with you...\n\nOr could it...?"), RED)
end

function drl.plot_outro_partial()
--	if core.game_type() ~= GAMESTANDARD then return end
	ui.blood_slide()
	ui.plot_screen(ui.semantic_text("message.plot.sacrifice-mastermind", "The thermonuclear bomb shows the last second, and you know that your life is over. Still as you look at the Spider Mastermind, your eyes meet, and you smile. She is surprised, but after a split-second she understands.\n\nThe thermonuclear explosion erupts, and you laugh knowing that your sacrifice has ended the reign of Hell...\n\n                             ...but did you get ALL of them?"), RED)
end

function drl.plot_outro_final()
--	if core.game_type() ~= GAMESTANDARD then return end
	if player.hp <= 0 then
		drl.plot_outro_final_nuked()
		return
	elseif player.eq.armor and player.eq.armor.id == "uberarmor" then
		drl.plot_outro_special()
		return
	end
	ui.blood_slide()
	ui.plot_screen(ui.semantic_text("message.plot.carmack-victory", "John Carmack is dead.\n\nNo more evil will ever fall upon this world. Your damned soul rests, knowing that no more hellish forces will threaten Earth.\n\nOr will they?\n\nThis will be revealed in...\n\nDRL II : Hell on Earth!"), RED)
end

function drl.plot_outro_final_nuked()
--	if core.game_type() ~= GAMESTANDARD then return end
	ui.blood_slide()
	ui.plot_screen(ui.semantic_text("message.plot.carmack-sacrifice", "The thermonuclear bomb shows the last second, and you know that your life is over. Still as you look at the greatest of evils, your eyes meet, and you smile. To your surprise he smiles back, appearing satisfied.\n\nThe thermonuclear explosion erupts, and although you know that nothing can possibly survive, you also feel that this was a hollow victory. What could he have possibly been smiling for?  Perhaps you should have lived long enough to find out..."), RED)
end


function drl.plot_outro_special()
--	if core.game_type() ~= GAMESTANDARD then return end
	ui.blood_slide()
	ui.plot_screen(ui.semantic_text("message.plot.apostle-victory", "The Apostle is dead.\n\nYou've beaten the forces of Hell, and yet, you've also managed to emerge victorious when reality changed to something else...  \n\nYou can rest easily...\nAt least until...\n\nDRL II : Hell on Earth!"), RED)
end
