--[[ WOUND CHANGING ]]--


function changeModelWoundCount(mod, target)
    local name = target.getName()
    local _,_, current, total = name:find("([0-9]+)/([0-9]+)")
    local colors,newName,currentBracket,updatedName,currentColor

    if current == nil then return end

    current = math.max(tonumber(current) + mod, 0)
    total = tonumber(total)
    newName = name:gsub("([0-9]+)/([0-9]+)", current.."/"..total, 1)

    if current == 0 then
        currentColor = "[ff0000]"
    else
        local bracketData,bracketName,bracketProfileName
        
        if unitData.woundTrack ~= nil then
            if len(unitData.woundTrack) == 1 then
                for key,bracket in pairs(unitData.woundTrack) do
                    bracketData = bracket
                    bracketName = key
                end
            else
                -- not using hasTag because we don't know what tag to look for, only prefix
                for _,tag in pairs(target.getTags()) do
                    if tag:find("^wt:") ~= nil then
                        _,_,bracketName = tag:find("^wt:(.+)")
                        bracketData = unitData.woundTrack[bracketName]
                    end
                end
            end
        end

        if bracketData == nil then
            colors = WOUND_COLOR_CUTOFFS[total]
            currentColor =  current > colors.g and "[00ff16]" 
                            or (colors.o ~= nil and current > colors.o) and "[ffca00]" or "[ff0000]"
        else
            currentBracket = 1

            for key,_ in pairs(bracketData) do
                local cutoff,_ = key:gsub("(%d+)%-%d+%+?", "%1")
                if current >= tonumber(cutoff) then 
                    bracketProfileName = bracketName.." ("..key..")"
                    break 
                end

                currentBracket = currentBracket + 1
            end

            updateBracketCharacteristics(currentBracket, bracketData, bracketName, bracketProfileName, target)
            currentColor = WOUND_TRACK_COLORS[len(bracketData)][currentBracket]
        end
    end

    updatedName = string.gsub(newName, "^%[%w+]", currentColor, 1)
    
    target.setName(updatedName)
end

function updateBracketCharacteristics(bracket, bracketData, bracketName, bracketProfileName, target)
    local desc = target.getDescription()
    local updatedBracketCharacteristics,updatedHeadings = "","[56f442]"
    local bracketProfile,changingCharacteristics

    for _,profile in pairs(unitData.models) do
        if profile.name == bracketProfileName then bracketProfile = profile end
    end
    
    for heading,value in pairs(bracketProfile) do 
        if heading ~= "name" and heading ~= "rowParity" then 
            updatedBracketCharacteristics = updatedBracketCharacteristics..(isInList(heading, unitData.changingCharacteristics[bracketName]) 
                                and interpolate(BRACKET_VALUE, { 
                                    color = BRACKET_VALUE_COLORS[len(bracketData)][bracket],
                                    val = value 
                                }) 
                                or value).."   "

            updatedHeadings = updatedHeadings..formatHeading(heading, value)
        end
    end

    updatedBracketCharacteristics = updatedHeadings.."[-]\n"..updatedBracketCharacteristics.."[-][-]"

    target.setDescription(desc:gsub("%[56f442].-%[%-%]%[%-%]",updatedBracketCharacteristics))
end

-- formats the heading line for the characteristics section in a model's description
-- the spacing is based on the values given so that they line up properly
function formatHeading(heading, value)
    local spacing = value:gsub("\\",""):len()-heading:len()
    
    if heading == "ws" or heading == "m" or heading =="a" then 
        spacing = spacing + 2
    else
        spacing = spacing + 3
    end

    if (heading == "m" and value:len() > 2) or ((heading == "a" or heading == "s" or heading == "t") and value:len() > 1) then
        if heading == "m" and value ~= "-" and value:find('%-') ~= nil then
            heading = heading.."   "
        end

        heading = " "..heading
    end

    return capitalize(heading)..string.rep(" ", spacing)
end

-- decides whether to fully capitalize or (in the case of ld and sv) titlecase a string
function capitalize(heading)
    if heading == "ld" or heading == "sv" then return titlecase(heading) end
    return heading:upper()
end

-- only use this for changing ld and sv to Ld and Sv
function titlecase(s)
    return s:gsub("^(%w)", function (a) return a:upper() end)
end