const AdmZip = require("adm-zip");
const Model = require("./10eDataModel");
const { raw } = require("body-parser");
const { parse } = require("path");

// Explanation of Rosterizer data format:
// https://docs.google.com/document/d/1P9dSOkToVupxVkUiY6OKVkchw9zNqSWa--a2W2qix1k/edit?usp=sharing

function extractRegistryJSON(rawData) {
    let zip;
    try {
        zip = new AdmZip(rawData);
    } catch (err) {
        throw new Error("Uploaded file appears corrupt: not a valid zip file");
    }

    const zipEntries = zip.getEntries();
    if (zipEntries.length !== 1) {
        throw new Error("Uploaded file appears corrupt: valid zip file but contains multiple files");
    }

    let text = zip.readAsText(zipEntries[0]);
    return JSON.parse(text);
}

function parseRegistry(json) {
    let roster = new Model.Roster();

    discoverUnits(roster, json);

    for (let error of json.errors) {
        let errorText = error.message;
        if (error.name.length > 0) {
            errorText = error.name + ": " + errorText;
        }
        roster.addError(errorText);
    }

    return roster;
}

function discoverUnits(roster, asset) {
    for (let subAsset of asset.assets.included) {
        if (subAsset.lineage.includes("Unit")) {
            roster.addUnit(parseUnit(subAsset));
        }
        discoverUnits(roster, subAsset);
    }
}

function parseModel(modelAsset, unit) {
    let name = modelAsset.designation;
    let m = modelAsset.stats.M.processed.format.current;
    let t = modelAsset.stats.T.processed.format.current;
    let sv = modelAsset.stats.Sv.processed.format.current;
    let w = modelAsset.stats.W.processed.format.current;
    let ld = modelAsset.stats.Ld.processed.format.current;
    let oc = modelAsset.stats.OC.processed.format.current;
    let number = modelAsset.quantity;

    let model = new Model.Model(name, number, unit);
    let modelWargear = [];
    let modelSpecialWargear = [];
    for (let asset of modelAsset.assets.traits) {
        if (asset.classIdentity == "Weapon") {
            parseAndAddWeapon(asset, model, unit);
        } else if (asset.classification == "Ability" ||
                asset.classification == "Enhancement") {
            model.addAbility(parseAbility(asset));
        } else if (asset.classification == "Wargear") {
            model.addAbility(parseAbility(asset));
            modelWargear.push(asset.designation);
            if (asset.designation.toLowerCase().includes("shield") ||
                asset.designation.toLowerCase().includes("vexilla")) {
                modelSpecialWargear.push(asset.designation);
            }
        }
    }

    if (modelWargear.length > 0 && !modelAsset.lineage.includes("Unit")) {
        // For multi-model units, models carrying wargear should
        // be distinguished by name.  This is partly because it's
        // helpful to have a clear distinction for who's carrying
        // something like a medipack, and partly because some
        // wargear alters model characteristics and means we need
        // a separate statline for them on the datasheet.
        //
        // We check lineage because we don't want to do
        // this for single-model units, which are distinguished
        // by having the Unit represent the model. We only want to
        // add a single piece of wargear, because otherwise T'au
        // get stupid with battlesuit systems and drones - but we do
        // need to include all wargear that changes stats, e.g. shields
        // or vexillas, because as above we need models with unique
        // statlines to have unique names, but bloody T'au can have both
        // "Shield Drone" and "Shield Generator" on the same model, and
        // similarly Custodes can have models with vex, shield or both.
        if (modelSpecialWargear.length > 0) {
            for (let specialWargear of modelSpecialWargear) {
                model.name += " w/ " + specialWargear;
            }
        } else {
            model.name += " w/ " + modelWargear[0];
        }
    }

    // We do this last in case the model got renamed during child asset
    // processing.
    let profile = new Model.ModelCharacteristics(model.name, m, t, sv, w, ld, oc);
    unit.addProfile(profile);

    return model;
}

function parseAndAddWeapon(weaponAsset, model, unit, namePrefix = "", nameSuffix = "") {
    if (weaponAsset.keywords.Tags && weaponAsset.keywords.Tags.includes("Multi-weapon")) {
        // This is a weapon consisting of multiple profiles.
        // We treat each profile - profiles here are further weapons
        // nested underneath this one - as a separate weapon.
        let mixedClasses = false;
        let classFound = null;
        for (let subAsset of weaponAsset.assets.traits) {
            if (classFound == null) {
                classFound = subAsset.classification;
            } else if (classFound != subAsset.classification) {
                mixedClasses = true;
                break;
            }
        }

        for (let subAsset of weaponAsset.assets.traits) {
            if (!mixedClasses) {
                // This is multiple profiles of a strictly ranged or
                // strictly melee weapon. Sensible names for the profiles
                // are the overall weapon name plus the profile name.
                let weaponName = weaponAsset.stats.weaponName.processed.format.current + " - ";
                parseAndAddWeapon(subAsset, model, unit, weaponName);
            } else {
                // This weapon has both ranged and melee profiles. Sensible
                // names for the profiles are the profile name plus a type
                // indication.
                suffix = (subAsset.classification == "Melee Weapon") ? " (melee)" : " (ranged)";
                parseAndAddWeapon(subAsset, model, unit, "", suffix);
            }
        }
    } else {
        let name = namePrefix + weaponAsset.stats.weaponName.processed.format.current + nameSuffix;
        let isMelee = (weaponAsset.classification == "Melee Weapon");
        let range = isMelee ? Model.MELEE_RANGE : weaponAsset.stats.Range.processed.format.current;
        let a = weaponAsset.stats.A.processed.format.current;
        let bsws = isMelee ?
            weaponAsset.stats.WS.processed.format.current :
            weaponAsset.stats.BS.processed.format.current;
        let s = weaponAsset.stats.S.processed.format.current;
        let ap = weaponAsset.stats.AP.processed.format.current;
        let d = weaponAsset.stats.D.processed.format.current;

        let weapon = new Model.Weapon(name, range, a, bsws, s, ap, d);

        for (let asset of weaponAsset.assets.traits) {
            if (asset.classification == "Ability") {
                weapon.addAbility(parseAbility(asset));
            }
        }

        weapon.completeParse();

        model.addWeapon(weapon);
    }
}

function parseAbility(abilityAsset) {
    let text = abilityAsset.text;
    if (abilityAsset.keywords.Keywords && abilityAsset.keywords.Keywords.includes("Primarch")) {
        for (let childAsset of abilityAsset.assets.traits) {
            if (childAsset.classification == "Ability") {
                text += "\n" + childAsset.designation + ": " + childAsset.text;
            }
        }
    }

    let keywords = [];
    if (abilityAsset.keywords.Keywords) {
        keywords = abilityAsset.keywords.Keywords;
    }
    if (abilityAsset.keywords.Tags) {
        keywords = keywords.concat(abilityAsset.keywords.Tags);
    }

    return new Model.Ability(
        abilityAsset.designation,
        abilityAsset.text,
        keywords);
}

function parseUnitChildAsset(unit, childAsset) {
    switch (childAsset.classification) {
        case "Model":
            unit.addModel(parseModel(childAsset, unit));
            break;

        case "Ability":
        case "Enhancement":
        case "Wargear":
            unit.addAbility(parseAbility(childAsset));
            break;

        // Single-model units may also have Weapon child assets.
        // They'll be handled later by re-parsing this unit as a model.
    }
}

function parseUnit(unitAsset) {
    let unit = new Model.Unit(unitAsset.designation);

    for (let asset of unitAsset.assets.traits) {
         parseUnitChildAsset(unit, asset);
    }

    for (let asset of unitAsset.assets.included) {
        parseUnitChildAsset(unit, asset);
    }

    for (let keyword of unitAsset.keywords.Faction) {
        unit.addFactionKeyword(keyword);
    }

    for (let keyword of unitAsset.keywords.Keywords) {
        unit.addOtherKeyword(keyword);
    }

    if (unit.models["models"].size == 0) {
        // If a unit has no child models, that means it consists of
        // a single model whose name matches the unit, and contains
        // the same child assets that a model asset would contain.
        // We can simply re-parse this asset as a model.
        unit.addModel(parseModel(unitAsset, unit));
    }

    unit.completeParse();

    return unit;
}

module.exports.rosterizerParse = (rawData) => {
    const json = extractRegistryJSON(rawData);
    let roster = parseRegistry(json);
    return roster;
}