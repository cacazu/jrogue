-- Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained.
ui.semantic_feeling = function(id, english, parameters)
	return { semantic_id = id, english = english, parameters = parameters or {} }
end

ui.registry_feeling = function(category, id, scope, field, english)
	if category == "item" and id == "lever_flood_water" and scope == "base_game" and field == "warning" and english == "The air is really humid here..." then return ui.semantic_feeling("message.room.lever.water-warning", english) end
	if category == "item" and id == "lever_flood_acid" and scope == "base_game" and field == "warning" and english == "In the State of Denmark there was the odor of decay..." then return ui.semantic_feeling("message.room.lever.acid-warning", english) end
	if category == "item" and id == "lever_flood_lava" and scope == "base_game" and field == "warning" and english == "You feel that smell? That gasoline smell? Oh hell..." then return ui.semantic_feeling("message.room.lever.lava-warning", english) end
	if category == "item" and id == "lever_kill" and scope == "base_game" and field == "warning" and english == "The smell of a massacre..." then return ui.semantic_feeling("message.room.lever.kill-warning", english) end
	if category == "item" and id == "lever_walls" and scope == "base_game" and field == "warning" and english == "You hear the trumpets of Jericho echoing in the distance..." then return ui.semantic_feeling("message.room.lever.walls-warning", english) end
	return english
end

ui.msg_feel = function(msg)
	local record = type(msg) == "table" and msg or nil
	local display = nil
	if record then
		msg = ui.semantic_text(record.semantic_id, record.english, record.parameters, true)
		display = ui.semantic_text(record.semantic_id, record.english, record.parameters)
	end
	if type(msg) ~= "string" then return end
	local join_before = ""
	if level.feeling == "" then
		level.feeling = msg
	else
		join_before = " "
		level.feeling = level.feeling .. " " .. msg
	end
	if record then ui.remember_semantic_feeling(record.semantic_id, record.english, record.parameters, join_before, level.feeling) end
	ui.msg(display or msg)
end

ui.repeat_feel = function()
	ui.msg(ui.repeat_semantic_feeling(level.feeling))
end

ui.clear_feel = function()
	level.feeling = ""
	ui.clear_semantic_feelings()
end

ui.confirm = function( query )
	local choice = {
		header = query,
		entries = { 
			{ name = ui.semantic_text("ui.cancel", "Cancel"), value = 0, },
			{ name = ui.semantic_text("ui.confirm", "Confirm"), value = 1,},
		},
		cancel = 0,
	}
	return ui.choice( choice ) == 1
end

ui.query = function( query )
	local choice = {
		header = query,
		entries = { 
			{ name = ui.semantic_text("ui.confirm", "Confirm"), value = 1,},
			{ name = ui.semantic_text("ui.cancel", "Cancel"), value = 0, },
		},
		escape = false,
	}
	return ui.choice( choice ) == 1
end


ui.continue = function( query )
	local choice = {
		header = query,
		entries = { 
			{ name = ui.semantic_text("ui.continue", "Continue"), value = 0, },
		},
		cancel = 0,
	}
	ui.choice( choice )
end