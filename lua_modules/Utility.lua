--[[ UTILITY FUNCTIONS ]]--


function none() end

function interpolate(templateString, replacementValues)
    return (templateString:gsub('($%b{})', function(w) return replacementValues[w:sub(3, -2)] or w end))
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