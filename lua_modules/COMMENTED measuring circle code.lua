--[[ CONSTANTS ]]--

local previousHighlightColor = nil
local MM_TO_INCH = 0.0393701
local MEASURING_RING_Y_OFFSET = 0.17
local VALID_BASE_SIZES_IN_MM = {
    {x = 25, z = 25},
    {x = 28, z = 28},
    {x = 30, z = 30},
    {x = 32, z = 32},
    {x = 40, z = 40},
    {x = 50, z = 50},
    {x = 55, z = 55},
    {x = 60, z = 60},
    {x = 65, z = 65},
    {x = 80, z = 80},
    {x = 90, z = 90},
    {x = 100, z = 100},
    {x = 130, z = 130},
    {x = 160, z = 160},
    {x = 25, z = 75},
    {x = 75, z = 25},
    {x = 35.5, z = 60},
    {x = 60, z = 35.5},
    {x = 40, z = 95},
    {x = 95, z = 40},
    {x = 52, z = 90},
    {x = 90, z = 52},
    {x = 70, z = 105},
    {x = 105, z = 70},
    {x = 92, z = 120},
    {x = 120, z = 92},
    {x = 95, z = 150},
    {x = 150, z = 95},
    {x = 109, z = 170},
    {x = 170, z = 109}
}



--[[ MEASURING CIRCLE FUNCTIONS ]]--
  
-- tries to determine the size of the model's base by starting with the model's size and
-- the smallest predefined base size (see above), and growing until we get a size
-- that has the smallest error in the z and x dimensions
-- model: the model to be checked
function determineBaseInInches(model)
    local savedBase = model.getTable("chosenBase")

    -- check to see if the model already has a defined base size
    if savedBase ~= nil then 
        return savedBase.base
    else
        -- start with the smallest valid base size
        local chosenBase =  VALID_BASE_SIZES_IN_MM[1]
        local modelSize = model.getBoundsNormalized().size
        local modelSizeX = modelSize.x
        local modelSizeZ = modelSize.z
        local closestSum = 10000000000
        local chosenBaseIdx = 1

        for k, base in pairs(VALID_BASE_SIZES_IN_MM) do
            local baseInchX = (MM_TO_INCH - 0.001) * base.x -- convert to inches
            local baseInchZ = (MM_TO_INCH - 0.001) * base.z -- convert to inches
            -- if the model's size is bigger than the current base size in both the x and z dimensions, check the error distance
            if modelSizeX > baseInchX and modelSizeZ > baseInchZ then
                local distSum = (modelSizeX - baseInchX) + (modelSizeZ - baseInchZ)
                -- if the error is smaller than the current smallest error, 
                -- set this as the smallest error and the current chosen base
                if distSum < closestSum then
                    closestSum = distSum
                    chosenBase = base
                    chosenBaseIdx = k
                end
            end
        end
        
        -- if we didnt find an appropriate base, default to the model's size
        if chosenBase == nil then
            chosenBase = { x=modelSizeX/2, z=modelSizeZ/2}
        else
            -- otherwise save the chosen base
            chosenBase = { 
                x = (chosenBase.x * MM_TO_INCH)/2, 
                z = (chosenBase.z * MM_TO_INCH)/2
            }
        end

        -- assign the chosen base to the model
        model.setTable("chosenBase", { baseIdx=chosenBaseIdx, base=chosenBase })

        -- return the chosen base so we dont have to look it up on the model again
        return chosenBase
    end
end


-- does the actual drawing of measuring rings
-- change: size to change, ie 1 to increase by 1 inch, -1 to decrease by 1 inch
-- target: the object to draw the ring around
-- presetBase: if the object has determined its base size already, it gets passed here
function changeMeasurementCircle(change, target, presetBase)
    local measuringRings = target.getTable("ym-measuring-circles") -- the collection of rings already around the object
    local currentColor = target.getVar("currentHighlightColor") -- gets the current ring color
    local currentColorRadius
    
    -- if no rings have been drawn yet
    if measuringRings == nil then 
        measuringRings = {}
        currentColorRadius = 0
    else
        -- if there are already rings around it, we need to overwrite the ring we are modifying
        -- so, go through the collection of rings and remove the one thats going to be overwritten
        for idx=#measuringRings,1,-1 do
            -- if we find the ring, get the current radius (before changing it), then remove it from the collection
            if (measuringRings[idx].name == currentColor) or (measuringRings[idx].name == nil and currentColor == nil) then
                currentColorRadius = measuringRings[idx].radius
                table.remove(measuringRings, idx)
            -- we always want to remove the one that goes around the base to redraw it
            elseif measuringRings[idx].name == "base" then
                table.remove(measuringRings, idx)
            end
        end

        -- if we didnt find a ring in the current color, set the current radius to 0 and pretend we did
        if currentColorRadius == nil then currentColorRadius = 0 end
    end
    
    -- just get the new radius by applying the change
    -- if the new radius is somehow less than 0, cap it at 0
    local newRadius = math.max(currentColorRadius + change, 0)

    -- if the new radius of the ring is 0, we want to remove it, so do nothing
    -- remember that we already removed it from the collection earlier, 
    -- so by not redrawing it, we have effectively removed it altogether
    if newRadius == 0 then
        
    else
        -- check to see if we should draw the ring as a rectangle or not
        local isRectangular = target.hasTag("rectangularMeasuring")
        -- define the parameters for the ring to be drawn (other than the points, which will be determiend later)
        local measuring = {
            name = currentColor,
            color = currentColor == nil and {1,0,1} or Color.fromString(currentColor),
            radius = newRadius,
            thickness = 0.1 * 1/(target.getScale().x),
            rotation  = {270,0,0}
        }
        -- do the same for the base ring
        local base = {
            name = "base",
            color = currentColor == nil and {1,0,1} or Color.fromString(currentColor),
            thickness = 0.1 * 1/(target.getScale().x),
            rotation  = {270,0,0}--isRectangular and {0,0,0} or {270,0,0}
        }
        local measuringPoints,basePoints
    
        -- get the points to draw
        -- what TTS does is draws a straight line between a set of give points, so we approximate a circle
        -- by giving it lots of points close together in the shape of a circle (or rectangle as the case may be)
        if isRectangular then
            local modelBounds = target.getBoundsNormalized()
    
            measuringPoints = getRectangleVectorPoints(newRadius, modelBounds.size.x/2, modelBounds.size.z/2, target)
            basePoints = getRectangleVectorPoints(0, modelBounds.size.x/2, modelBounds.size.z/2, target)
        else
            local baseRadiuses = (presetBase == nil) and determineBaseInInches(target) or presetBase
    
            measuringPoints = getCircleVectorPoints(newRadius, baseRadiuses.x, baseRadiuses.z, target)
            basePoints = getCircleVectorPoints(0, baseRadiuses.x, baseRadiuses.z, target)
        end
        
        -- set the points collections in the objects we made earlier
        measuring.points = measuringPoints
        base.points = basePoints
    
        -- add the newly defined measuring rings back into the collection of rings
        table.insert(measuringRings, measuring)
        table.insert(measuringRings, base)
        -- tell everyone we're measuring
        broadcastToAll("Measuring "..tostring(newRadius).."\"")
    end
    
    -- actually draw the rings
    -- note that this draws all the separately defined rings in the collection, not just the one we defined
    target.setVectorLines(measuringRings)

    -- update the collection of defined rings on the object
    target.setTable("ym-measuring-circles", measuringRings)
end



-- gets all the points necessary to describe a circle to be drawn
-- important note: because the ring is drawn on its side, a bug with TTS causes the end points to not
-- meet up, and so youre left with a point being drawn perpendicular to how you want it drawn (this is super frustrating)
-- radius: the radius of the ring to be drawn (in inches away from the base)
-- baseX: the x-dimension size of the base
-- baseZ: the z-dimension size of the base
-- obj: the object the ring is beign drawn around
function getCircleVectorPoints(radius, baseX, baseZ, obj)
    local result = {}
    local scaleFactor = 1/obj.getScale().x -- need the scale factor to compensate for objects not being scaled to 1,1,1.
    -- if a model is at a different scale (eg 0.5, 0.5, 0.5), then the ring will be either too large or too small
    local rotationDegrees =  obj.getRotation().y
    local steps = 64 -- this can be changed to make the ring technically more accurate, but this is a good amount of steps
    local degrees,sin,cos,toRads = 360/steps, math.sin, math.cos, math.rad

    for i = 0,steps do
        -- describe a circle
        table.insert(result,{
            x = cos(toRads(degrees*i))*((radius+baseX)*scaleFactor),
            z = MEASURING_RING_Y_OFFSET,
            y = sin(toRads(degrees*i))*((radius+baseZ)*scaleFactor)
        })
    end

    return result
end




-- not sure if you need this, but I left it in just in case
-- works the same way as drawing a circle except that it splits the four quadrants and spaces them
-- appropriately with straight lines in between to create a rectangle with rounded corners
-- radius: the radius of the ring to be drawn (in inches away from the base)
-- sizeX: the x-dimension size of the model
-- sizeZ: the z-dimension size of the model
-- obj: the object the ring is beign drawn around
function getRectangleVectorPoints(radius, sizeX, sizeZ, obj)
    local result = {}
    local scaleFactor = 1/obj.getScale().x -- need the scale factor to compensate for objects not being scaled to 1,1,1.
    -- if a model is at a different scale (eg 0.5, 0.5, 0.5), then the ring will be either too large or too small
    
    -- do the scaling
    sizeX = sizeX*scaleFactor
    sizeZ = sizeZ*scaleFactor
    radius = radius*scaleFactor

    local steps = 65 -- this can be changed to make the ring technically more accurate, but this is a good amount of steps
    local degrees,sin,cos,toRads = 360/(steps-1), math.sin, math.cos, math.rad
    local xOffset,zOffset = sizeX,sizeZ
    -- compensate for ignoring vertical line
    -- note: this doesnt actually help, its just a problem with TTS's rendering, but it doesnt hurt so I left it in
    table.insert(result,{
        x = (cos(toRads(degrees*0))*radius)+sizeX-0.001,
        y = (sin(toRads(degrees*0))*radius)+sizeZ,
        z = MEASURING_RING_Y_OFFSET
    })

    for i = 1,steps-1 do
        -- each of these creates a straight line between different parts of a circle to create a rectangle with rounded corners
        if i == 16 then
            table.insert(result,{ x= sizeX, y=(radius+sizeZ), z=MEASURING_RING_Y_OFFSET })
            table.insert(result,{ x=-sizeX, y=(radius+sizeZ), z=MEASURING_RING_Y_OFFSET })
            xOffset = -sizeX
        elseif i == 33 then
            table.insert(result,{ x=-radius-sizeX,       y= sizeZ, z=MEASURING_RING_Y_OFFSET })
            table.insert(result,{ x=-radius-sizeX-0.001, y=-sizeZ, z=MEASURING_RING_Y_OFFSET })
            table.insert(result,{ x=-radius-sizeX,       y=-sizeZ, z=MEASURING_RING_Y_OFFSET })
            zOffset = -sizeZ
        elseif i == 49 then
            table.insert(result,{ x=-sizeX, y=-radius-sizeZ, z=MEASURING_RING_Y_OFFSET })
            table.insert(result,{ x= sizeX, y=-radius-sizeZ, z=MEASURING_RING_Y_OFFSET })
            xOffset = sizeX
        elseif i == 65 then
            table.insert(result,{ x=radius+sizeX,       y=-sizeZ, z=MEASURING_RING_Y_OFFSET })
            table.insert(result,{ x=radius+sizeX-0.001, y= sizeZ, z=MEASURING_RING_Y_OFFSET })
        else
            -- describe a circle
            table.insert(result,{
                x = (cos(toRads(degrees*i))*radius)+xOffset,
                y = (sin(toRads(degrees*i))*radius)+zOffset,
                z = MEASURING_RING_Y_OFFSET
            })
        end
    end
    -- compensate for ignoring vertical line
    -- again, doesnt do anything but eh
    table.insert(result,{
        x = (cos(toRads(degrees*0))*radius)+sizeX-0.001,
        y = (sin(toRads(degrees*0))*radius)+sizeZ,
        z = MEASURING_RING_Y_OFFSET
    })
    
    return result
end