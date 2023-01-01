const util = require("util");

/**
 * Utilities to be used in other files
 */
module.exports.hasUnitSomewhereRecursive = hasUnitSomewhereRecursive; // weird, but handles recursion properly
module.exports.log = (data) => {
    console.log(util.inspect(data, false, null, true));
} 






function hasUnitSomewhereRecursive (selection) {
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