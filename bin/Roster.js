const Unit = require("./Unit"),
    Util = require("./Util");

/**
 * Parses the given .ros data into the format we want for TTS
 * @param {any} data The roster data (parsed from XML) to be parsed
 * @returns An object containing the parsed units and their original order (for use later)
 */
module.exports.parse = (data) => {
    let units = new Map();

    for (const force of data[0].force) {
        let armyUnitData = force.selections[0].selection.filter(selection => {
            if (selection.$.type === "model" || selection.$.type === "unit") return true;
            if (selection.$.type === "upgrade" && Util.hasUnitSomewhereRecursive(selection)) return true;

            return false;
        });
    
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