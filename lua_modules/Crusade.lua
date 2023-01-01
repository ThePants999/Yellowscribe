--[[ CRUSADE STUFF ]]--


function showTallyCard(playerColor)
    local agendaManager = getAgendaManager()

    -- dont do anything if the agenda manager isnt present
    if agendaManager == nil then
        broadcastToColor("That unit is not associated with an Agenda Manager!", playerColor, "Red")
        return
    else
        buildAgendas(agendaManager.call("getTalliesForUnit", unitData.uuid))

        Wait.frames(function ()  -- delay for building agendas
            showCard("tallyCard", playerColor, updateCounters) 
        end, 2)
    end
end

function showCrusadeCard(playerColor)
    loadCrusadeCard()
    -- delay to wait for update
    Wait.frames(function () showCard("crusadeCard", playerColor) end, 2)
end

function loadDecodedState(decodedState)
    crusadeCardData = decodedState.crusadeCard
end

function loadDefaultValues()
    crusadeCardData.fields.ccUnitName = unitData.unitDecorativeName
end

function getCrusadeCardSaveData()
    return {
        crusadeCard = crusadeCardData
    }
end

function buildCrusadeUI(guid)
    self.UI.setValue("tally-UnitName", unitData.unitDecorativeName)
    
    self.UI.setAttribute("crusadeCardCloseButton", "onClick", guid.."/hideCard(crusadeCard)")
    self.UI.setAttribute("tallyCardCloseButton", "onClick", guid.."/hideCard(tallyCard)")

    if crusadeCardData.fields.ccUnitName == "" then crusadeCardData.fields.ccUnitName = unitData.unitDecorativeName end

    for counter,val in pairs(crusadeCardData.counters) do
        self.UI.setAttribute(counter.."Up", "onClick", guid.."/incrementCounterText("..counter..")")
        self.UI.setAttribute(counter.."Down", "onClick", guid.."/decrementCounterText("..counter..")")
        self.UI.setValue(counter, val)
    end

    for id,val in pairs(crusadeCardData.fields) do
        self.UI.setValue(id, val)
        self.UI.setAttribute(id, "onEndEdit", guid.."/updateCrusadeCard()")
    end

    for id,val in pairs(crusadeCardData.toggles) do
        self.UI.setAttribute(id, "isOn", val)
        self.UI.setAttribute(id, "onValueChanged", guid.."/updateCrusadeCard()")
    end
end








--[[ TALLY CARD FUNCTIONS ]]--


function modTallyCounter(player, counter, mod)
    local agendaManager = getAgendaManager()
    
    -- dont do anything if the agenda manager isnt present
    if agendaManager == nil then
        broadcastToColor("Couldn't find the Agenda Manager!", playerColor, "Red")
        return
    else
        local newValue = agendaManager.call("updateTallyForUnit", {
            unitID = unitData.uuid,
            tally = counter,
            mod = mod
        })
        
        UI.setValue("agenda-"..counter, newValue)
    end
end


function incrementTallyCounter(player, counter)
    modTallyCounter(player, counter, 1)
end


function decrementTallyCounter(player, counter)
    modTallyCounter(player, counter, -1)
end


function buildAgendas(listToBuild)
    if listToBuild ~= nil then
        local tallyString = ""
        local height = 40

        for tally,value in pairs(listToBuild) do
            tallyString = tallyString..interpolate(uiTemplates.agenda, {
                counterName = tally, 
                counterID = "agenda-"..tally,
                guid = self.getGUID(),
                counterValue = value
            })

            height = height + 37
        end

        self.UI.setValue("tallyContainer", tallyString)
        self.UI.setAttribute("tallyCard", "height", height)
        return true
    end
    -- generally will only return false if it cant find the Agenda manager or there arent any agendas in the inputs
    return false
end

function getAgendaManager()
    for _,tag in pairs(self.getTags()) do
        local _,_,agendaManagerGUID = tag:find(AGENDA_MANAGER_TAG_PATTERN)

        if agendaManagerGUID ~= nil then
            return getObjectFromGUID(agendaManagerGUID)
        end
    end

    return nil
end








--[[ CRUSADE CARD UTILITY FUNCTIONS ]]--


function incrementCounterText(player, counter)
    crusadeCardData.counters[counter] = crusadeCardData.counters[counter] + 1
    UI.setValue(counter, crusadeCardData.counters[counter])
end


function decrementCounterText(player, counter)
    crusadeCardData.counters[counter] = crusadeCardData.counters[counter] - 1
    UI.setValue(counter, crusadeCardData.counters[counter])
end


function updateCrusadeCard(player, value, id)
    if crusadeCardData.fields[id] ~= nil then crusadeCardData.fields[id] = value
    else crusadeCardData.toggles[id] = value end
end


function loadCrusadeCard(fromData)
    if fromData ~= nil then crusadeCardData = fromData end

    for id,val in pairs(crusadeCardData.fields) do
        self.UI.setValue(id, val)
    end
    for id,val in pairs(crusadeCardData.toggles) do
        self.UI.setAttribute(id, "isOn", val)
    end
    for counter,val in pairs(crusadeCardData.counters) do
        self.UI.setValue(counter, val)
    end

    -- if fromData is provided, that means its a model becoming a leader
    if fromData ~= nil then
        buildCrusadeUI(self.getGUID())
    end
end