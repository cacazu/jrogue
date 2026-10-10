-- SPDX-License-Identifier: GPL-3.0-or-later
-- Source-owned diagnostic presentation, not a game/actor mutation.
-- Loaded before original start; original UI classes are required only on open.
local state = {opened=0, accepted=0, changed=0, canceled=0}
local api = {}
local function fail(id) error(id, 0) end
local function raw_resolve(object, key)
  local seen = {}
  for _ = 1, 32 do
    if type(object) ~= "table" or seen[object] then return nil end
    seen[object] = true
    local value = rawget(object, key)
    if value ~= nil then return value end
    local mt = getmetatable(object)
    if type(mt) ~= "table" then return nil end
    object = rawget(mt, "__index")
    if type(object) ~= "table" then return nil end
  end
end
local function quote(text)
  if type(text) ~= "string" then fail("textbox.error.status") end
  return '"'..text:gsub('[%z\1-\31\\"]', function(c)
    if c == '"' then return '\\"' end
    if c == '\\' then return '\\\\' end
    return ("\\u%04x"):format(c:byte())
  end)..'"'
end
local function number(n)
  if type(n) ~= "number" or n ~= n or n == math.huge or n == -math.huge then return "null" end
  return tostring(n)
end
local function active()
  local d, g = state.dialog, rawget(_G, "game")
  return d and type(g) == "table" and type(rawget(g, "dialogs")) == "table" and g.dialogs[d] ~= nil
end
local function close(kind)
  if not active() or game.dialogs[#game.dialogs] ~= state.dialog then fail("textbox.error.stage") end
  if kind == "accepted" then state.accepted = state.accepted + 1
  else state.canceled = state.canceled + 1 end
  state.last_text = state.box.text
  state.last_close = kind
  game:unregisterDialog(state.dialog) -- actual cleanup/handler restoration
end
function api.open(initial, title, field_title, cancel_text)
  if active() then fail("textbox.error.stage") end
  local g = rawget(_G, "game")
  if type(g) ~= "table" or type(rawget(g, "dialogs")) ~= "table" or #g.dialogs ~= 0 then fail("textbox.error.stage") end
  if type(initial) ~= "string" or #initial > 16384 or type(title) ~= "string" or type(field_title) ~= "string" or type(cancel_text) ~= "string" then fail("textbox.error.request") end
  if type(string.iterateUTF) ~= "function" or type(core) ~= "table" or type(core.display) ~= "table"
    or string.nextUTF ~= core.display.stringNextUTF then fail("textbox.error.iterator") end
  local class = require "engine.class"
  local Base = require "engine.ui.Base"
  local Focusable = require "engine.ui.Focusable"
  local UIGroup = require "engine.ui.UIGroup"
  local Textbox = require "engine.ui.Textbox"
  local Dialog = require "engine.ui.Dialog"
  local Button = require "engine.ui.Button"
  local KeyBind = require "engine.KeyBind"
  local UTF8 = require "engine.ui.UTF8TextboxPresentation"
  if type(UIGroup.textInputPresentationState) ~= "function" then fail("textbox.error.overlay") end
  -- A real bounded constructor guard also covers ASCII/empty external values.
  local sentinel = "\230\151\165\230\156\172\232\170\158"
  local witness = Textbox.new{title="",text=sentinel,chars=3,max_len=3,fct=function() end}
  if #witness.tmp ~= 3 or table.concat(witness.tmp) ~= sentinel or witness.cursor ~= 4 then fail("textbox.error.overlay") end
  local items = UTF8.require_items(initial)
  if #items > 96 then fail("textbox.error.request") end
  -- Real originals; this small layout/routing container is explicitly fixture code.
  local Group = {_NAME="diagnostic.NativeTextboxGroup"}
  class.inherit(Base, Focusable, UIGroup)(Group)
  function Group:init(t)
    self.child = t.child
    self.w, self.h = self.child.w + 16, self.child.h + 16
    Base.init(self, t)
  end
  function Group:generate()
    self.mouse:reset(); self.key:reset()
    self.uis = {{x=8, y=8, ui=self.child}}
    self.child.mouse.delegate_offset_x = 8
    self.child.mouse.delegate_offset_y = 8
    self.mouse:registerZone(0,0,self.w,self.h,function(...) self:mouseEvent(...) end)
    self.key.receiveKey = function(_,...) return self:keyEvent(...) end
    self:setInnerFocus(1)
  end
  function Group:keyEvent(...)
    if not self.focus_ui or not self.focus_ui.ui.key:receiveKey(...) then
      return KeyBind.receiveKey(self.key,...)
    end
  end
  function Group:mouseEvent(button,x,y,xrel,yrel,bx,by,event)
    local ui = self.uis[1]
    if bx >= ui.x and bx <= ui.x + ui.ui.w and by >= ui.y and by <= ui.y + ui.ui.h then
      self:setInnerFocus(1)
      return ui.ui.mouse:delegate(button,bx,by,xrel,yrel,bx,by,event)
    end
  end
  function Group:display(x,y,nb_keyframes)
    self.child:display(x+8,y+8,nb_keyframes)
  end
  local box = Textbox.new{title=field_title,text=initial,chars=24,max_len=96,
    fct=function(text) state.last_text=text; close("accepted") end,
    on_change=function(text) state.changed=state.changed+1; state.last_text=text end}
  if #box.tmp ~= #items or table.concat(box.tmp) ~= initial or box.cursor ~= #items+1 then fail("textbox.error.overlay") end
  if type(box.key.on_input) ~= "function" then fail("textbox.error.callback") end
  local group = Group.new{child=box}
  local cancel = Button.new{text=cancel_text,fct=function() close("canceled") end}
  local d = Dialog.new(title, math.max(group.w,cancel.w)+24, group.h+cancel.h+24,nil,nil,nil,nil,false)
  d:loadUI{{left=0,top=0,ui=group},{left=0,top=group.h+8,ui=cancel}}
  d:setupUI(true,true)
  d.key:addBind("EXIT",function() close("canceled") end)
  state.dialog, state.box, state.group = d, box, group
  state.initial = initial; state.last_text = initial
  state.changed, state.accepted, state.canceled = 0,0,0
  state.opened = state.opened+1; state.last_close = ""
  game:registerDialog(d)
  d:setFocus(group)
  return true
end
function api.close()
  close("canceled")
  return true
end
function api.font()
  if not active() then return nil end
  return raw_resolve(state.box,"font_mono")
end
function api.status_json()
  local box, d, group = state.box, state.dialog, state.group
  local parts = {'"protocol":1','"active":'..tostring(not not active()),
    '"opened":'..number(state.opened),'"accepted":'..number(state.accepted),
    '"changed":'..number(state.changed),'"canceled":'..number(state.canceled),
    '"last_text":'..quote(state.last_text or ""),'"initial":'..quote(state.initial or ""),
    '"last_close":'..quote(state.last_close or ""),
    '"native_iterator":'..tostring(type(string.iterateUTF)=="function" and type(core)=="table" and type(core.display)=="table" and string.nextUTF==core.display.stringNextUTF)}
  if box then
    parts[#parts+1]='"text":'..quote(rawget(box,"text") or "")
    parts[#parts+1]='"scalars":'..number(#(rawget(box,"tmp") or {}))
    parts[#parts+1]='"cursor":'..number(rawget(box,"cursor"))
    parts[#parts+1]='"scroll":'..number(rawget(box,"scroll"))
    parts[#parts+1]='"max_len":'..number(rawget(box,"max_len"))
    parts[#parts+1]='"focused":'..tostring(rawget(box,"focused")==true)
    parts[#parts+1]='"callback_installed":'..tostring(type(rawget(box.key,"on_input"))=="function")
    if active() then
      local wrapper = d.ui_by_ui[group]
      local x,y = rawget(d,"display_x"),rawget(d,"display_y")
      parts[#parts+1]='"box_x":'..number(x and wrapper and x+wrapper.x+8)
      parts[#parts+1]='"box_y":'..number(y and wrapper and y+wrapper.y+8)
      parts[#parts+1]='"box_w":'..number(rawget(box,"w"))
      parts[#parts+1]='"box_h":'..number(rawget(box,"h"))
      parts[#parts+1]='"mouse_zone_x":'..number(x and wrapper and x+wrapper.x+8+box.title_w+6)
      parts[#parts+1]='"mouse_zone_y":'..number(y and wrapper and y+wrapper.y+8)
      parts[#parts+1]='"mouse_zone_w":'..number(rawget(box,"fw"))
      parts[#parts+1]='"text_origin_x":'..number(x and wrapper and x+wrapper.x+8+1+box.text_x)
      parts[#parts+1]='"text_origin_y":'..number(y and wrapper and y+wrapper.y+8+1+box.text_y)
    end
  end
  return "{"..table.concat(parts,",").."}"
end
return api