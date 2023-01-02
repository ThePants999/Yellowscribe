const Unit = require("./Unit");

/**
 * Parses the given .ros data into the format we want for TTS
 * @param {any} data The roster data (parsed from XML) to be parsed
 * @returns An object containing the parsed units and their original order (for use later)
 */
module.exports.parse = (data) => {
    let units = new Map();

    for (const force of data[0].force) {
        if (force.selections === undefined || force.selections.length !== 1) {
            break;
        }

        let armyUnitData = force.selections[0].selection.filter(hasUnitSomewhereRecursive);

        for (let unitData of armyUnitData) {
            let unit = new Unit(unitData.$.name, unitData.$.customName, unitData.$.type === "model");

            unit.handleSelectionDataRecursive(unitData, null, true);

            units.set(unit.uuid, unit.update());
        }
    }

    let order = [];

    for (const uuid of units.keys())
        order.push(uuid);

    return { units, order }
}

function hasUnitSomewhereRecursive(selection) {
    if (selection.$.type === "model" || selection.$.type === "unit") return true; // we found it!

    // check the profiles in the selection data, if a unit exists, assume its a unit
    if (selection.profiles && selection.profiles[0] !== "")
        for (const profile of selection.profiles[0].profile)
            if (profile.$.typeName.toLowerCase() === "unit")
                return true;

    if (!selection.selections || selection.selections[0] === "") return false; // if there arent any children, return false
    // (we would have returned true already if this current selection was a unit or model)

    // else search the children
    for (const childSelection of selection.selections[0].selection)
        if (hasUnitSomewhereRecursive(childSelection)) // recurse
            return true;

    return false; // we didn't find it
}

function replacer(key, value) {
    if (value instanceof Map)
        return Object.fromEntries(value.entries());

    else if (value instanceof Set)
        return Array.from(value);

    else
        return value;
}

module.exports.serialize = (roster, spaces = 0) =>  {
    return JSON.stringify(roster, replacer, spaces)
}