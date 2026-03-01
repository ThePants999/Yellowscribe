--[[ UTILITY FUNCTIONS ]]--


function none() end

-- Replacement for previous gsub-based version due to suspected
-- MoonSharp regression.
function interpolate(templateString, replacementValues)
    if templateString == nil then return "" end
    if replacementValues == nil then return templateString end

    local out = {}
    local idx = 1
    local templateLen = #templateString

    while idx <= templateLen do
        local startIdx = templateString:find("${", idx, true)

        if startIdx == nil then
            table.insert(out, templateString:sub(idx))
            break
        end

        if startIdx > idx then
            table.insert(out, templateString:sub(idx, startIdx - 1))
        end

        local endIdx = templateString:find("}", startIdx + 2, true)

        if endIdx == nil then
            table.insert(out, templateString:sub(startIdx))
            break
        end

        local key = templateString:sub(startIdx + 2, endIdx - 1)
        local replacement = replacementValues[key]

        -- Preserve old behavior: false/nil leave the token untouched.
        if replacement == nil or replacement == false then
            table.insert(out, templateString:sub(startIdx, endIdx))
        else
            table.insert(out, tostring(replacement))
        end

        idx = endIdx + 1
    end

    return table.concat(out)
end

-- same as includes() except includes assumes the table is array-like
function isInList(key, list)
    for _,k in pairs(list) do
        if k == key then return true end
    end
    return false
end

function len(t)
    local count = 0

    for _,_ in pairs(t) do
        count = count + 1
    end

    return count
end

function includes(tab, val)
    return find(tab, val) > 0
end

function find(tab, val)
    for index, value in ipairs(tab) do
        if value == val then
            return index
        end
    end

    return -1
end