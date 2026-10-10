-- Original configuration, followed by browser platform choices only.
-- Gameplay rules and data remain in the original Pascal/Lua source.
-- TLuaConfig's dofile resolves paths relative to its existing /data/ root.
dofile('config.lua')
-- Browser turn suspension supplies the cooperative input seam even at zero delay.
RunDelay = 0
Graphics = 'CONSOLE'
SoundEngine = 'NONE'
GameMusic = false
GameSound = false
AllowHighAscii = false
ForceRaw = true
DataPath = '/data/'
WritePath = '/user/'
ScorePath = '/user/'
