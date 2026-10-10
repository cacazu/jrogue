-- SPDX-License-Identifier: GPL-3.0-or-later
-- Original mod/class/Game.lua:1986-1992 block, unchanged.
-- Invoke only for a recorded application input-repeat delta.
return function(self, nb_keyframes)
	if self.wasd_state and self.wasd_state.cnt > 0 then
		self.wasd_state.cd = self.wasd_state.cd - nb_keyframes
		if self.wasd_state.cd <= 0 then			
			self.wasd_state.cd = self.wasd_state.base_cd
			self:onTickEnd(function() self:executeWASD() end)
		end
	end
end
