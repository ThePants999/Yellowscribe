local WOUND_COLOR_CUTOFFS = {
    {g=0}, -- 1
    {g=1}, -- 2
    {g=2, o=1}, -- 3
    {g=2, o=1}, -- 4
    {g=3, o=1}, -- 5
    {g=4, o=2}, -- 6
    {g=5, o=2}, -- 7
    {g=6, o=3}, -- 8
    {g=6, o=3}, -- 9
}
local WOUND_TRACK_COLORS = {
    { "[00ff16]" },
    { "[00ff16]", "[ff0000]" },
    { "[00ff16]", "[ffca00]", "[ff0000]" },
    { "[00ff16]", "[ffca00]", "[ff7900]", "[ff0000]" },
    { "[00ff16]", "[8bff00]", "[ffca00]", "[ff7900]", "[ff0000]" }
}
local BRACKET_VALUE_COLORS = {
    { "[98ffa7]" },
    { "[98ffa7]", "[e9a2a2]" },
    { "[98ffa7]", "[ffe298]", "[e9a2a2]" },
    { "[98ffa7]", "[ffe298]", "[feb17e]", "[e9a2a2]" },
    { "[98ffa7]", "[c8ff98]", "[ffe298]", "[feb17e]", "[e9a2a2]" }
}
local BRACKET_VALUE = "${color}${val}[-]"