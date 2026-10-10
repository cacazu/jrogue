-- Independently authored presentation adapter for original ToME Textbox/UIGroup.
-- GPL-3.0-or-later. No gameplay state, RNG, or global key dispatcher replacement.
local M = {}

local function continuation(byte)
	return byte and byte >= 128 and byte <= 191
end

-- Keep the exact incoming byte slices; never normalize or translate external text.
-- Lua 5.1 has no standard utf8 module. This strict decoder rejects overlong forms,
-- surrogate code points, truncated sequences, and code points above U+10FFFF.
function M.scalar_items(text)
	if type(text) ~= "string" then return nil, "utf8.invalid_type" end
	local items, cursor = {}, 1
	while cursor <= #text do
		local first = text:byte(cursor)
		local width
		if first <= 127 then
			width = 1
		elseif first >= 194 and first <= 223 then
			width = 2
		elseif first >= 224 and first <= 239 then
			width = 3
		elseif first >= 240 and first <= 244 then
			width = 4
		else
			return nil, "utf8.invalid_sequence"
		end
		for offset = 1, width - 1 do
			if not continuation(text:byte(cursor + offset)) then
				return nil, "utf8.invalid_sequence"
			end
		end
		local second = text:byte(cursor + 1)
		if (first == 224 and second < 160) or
		   (first == 237 and second > 159) or
		   (first == 240 and second < 144) or
		   (first == 244 and second > 143) then
			return nil, "utf8.invalid_sequence"
		end
		items[#items + 1] = text:sub(cursor, cursor + width - 1)
		cursor = cursor + width
	end
	-- The retained engine supplies iterateUTF via utils.lua / stringNextUTF.
	-- It tolerates malformed bytes, so invoke it only after strict validation.
	-- Empty text is handled here because its original iterator yields an empty
	-- slice. Compare every original byte boundary rather than trusting a plugin
	-- or a different helper version to normalize, reorder, or replace the bytes.
	if #items > 0 and type(string.iterateUTF) == "function" then
		local iterator = string.iterateUTF(text, 1, "char")
		if type(iterator) ~= "function" then return nil, "utf8.iterator_contract" end
		local original_items, offset = {}, 1
		for i = 1, #items do
			local first_byte, last_byte, value = iterator()
			if first_byte ~= offset or last_byte ~= offset + #items[i] - 1 or value ~= items[i] then
				return nil, "utf8.iterator_contract"
			end
			original_items[i] = value
			offset = last_byte + 1
		end
		if iterator() ~= nil then return nil, "utf8.iterator_contract" end
		return original_items
	end
	return items
end

function M.require_items(text)
	local items, reason = M.scalar_items(text)
	if not items then error(reason, 2) end
	return items
end

local function insert_items(self, items, util)
	for i = 1, #items do
		table.insert(self.tmp, self.cursor, items[i])
		self.cursor = self.cursor + 1
		self.scroll = util.scroll(self.cursor, self.scroll, self.max_display)
	end
end

-- Original __TEXTINPUT calls its filter twice on an admitted value and updates
-- once. Retain those callbacks. The presentation limit now counts scalar items;
-- an event that cannot fit is rejected atomically instead of splitting a scalar.
function M.commit(self, text, util)
	local incoming, reason = M.scalar_items(text)
	if not incoming then return false, reason end
	if #self.tmp >= self.max_len then return false, "utf8.limit" end
	if not self.filter(text) then return false, "utf8.filter" end
	local items, filter_reason = M.scalar_items(self.filter(text))
	if not items then return false, filter_reason end
	if #items > self.max_len - #self.tmp then return false, "utf8.limit" end
	insert_items(self, items, util)
	self:updateText()
	return true
end

-- Preserve the original clipboard filter path and its single final update.
-- Process one scalar per original filter invocation; do not route paste as both
-- Ctrl+V and committed text. The platform owns external clipboard permission.
function M.paste(self, text, util)
	local incoming, reason = M.scalar_items(text)
	if not incoming then return false, reason end
	for i = 1, #incoming do
		if #self.tmp >= self.max_len then break end
		local items = M.scalar_items(self.filter(incoming[i]))
		if not items or #items > self.max_len - #self.tmp then break end
		insert_items(self, items, util)
	end
	self:updateText()
	return true
end

function M.cursor_text(self)
	local last = math.min(self.cursor - 1, #self.tmp)
	if last < self.scroll then return "" end
	if self.hide then return string.rep("*", last - self.scroll + 1) end
	return table.concat(self.tmp, "", self.scroll, last)
end

-- Measure the original font's actual scalar prefixes at an input callback slot.
-- The original ASCII floor-cell convention is retained; this is not a pure
-- native-heap observer, because original font metrics may maintain font caches.
function M.cursor_at_pixel(self, pixel)
	local first = math.max(1, math.min(self.scroll, #self.tmp + 1))
	if type(pixel) ~= "number" or pixel ~= pixel or pixel <= 0 then return first end
	local prefix = ""
	for i = first, #self.tmp do
		prefix = prefix .. (self.hide and "*" or self.tmp[i])
		local width = self.font_mono:size(prefix)
		if type(width) ~= "number" or width ~= width then return first end
		if pixel < width then return i end
	end
	return #self.tmp + 1
end

-- Read actual nested focus links with rawget only. No class-name guesses,
-- callbacks, metamethods, Unicode toggles, actor fields, text setters, or tick.
-- Projection allocation is outside the independent Rust repaint/heap bracket.
function M.focus_state(root)
	local current, visited = root, {}
	for depth = 0, 31 do
		if type(current) ~= "table" or visited[current] then
			return {protocol = 1, known = false, accepts_unicode = false, depth = depth}
		end
		visited[current] = true
		local wrapper = rawget(current, "focus_ui")
		if wrapper == nil then
			local key = rawget(current, "key")
			if type(key) ~= "table" then
				return {protocol = 1, known = false, accepts_unicode = false, depth = depth}
			end
			local flag = rawget(key, "use_unicode")
			if flag ~= nil and type(flag) ~= "boolean" then
				return {protocol = 1, known = false, accepts_unicode = false, depth = depth}
			end
			return {
				protocol = 1, known = true, accepts_unicode = flag == true,
				depth = depth, focused = rawget(current, "focused") == true,
			}
		end
		if type(wrapper) ~= "table" then
			return {protocol = 1, known = false, accepts_unicode = false, depth = depth}
		end
		current = rawget(wrapper, "ui")
	end
	return {protocol = 1, known = false, accepts_unicode = false, depth = 32}
end

return M
