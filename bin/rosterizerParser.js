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

    // We need to find the set of Unit assets. They could be
    // at the top level, or underneath a Detachment asset, or
    // underneath an Army asset.
    let unitContainer = json.assets.included;
    while (unitContainer[0].classification != "Unit") {
        unitContainer = unitContainer[0].assets.included;
    }

    for (let unitAsset of unitContainer) {
        let unit = parseUnit(unitAsset);
        roster.addUnit(unit);
    }

    return roster;
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

    let model = new Model.Model(name, number);
    let profile = new Model.ModelCharacteristics(name, m, t, sv, w, ld, oc);
    unit.addProfile(profile);

    for (let asset of modelAsset.assets.traits) {
        switch (asset.classification) {
            case "Ability":
            case "Enhancement":
                let ability = parseAbility(asset);
                model.addAbility(ability);
                unit.addAbility(ability);
                break;

            case "Melee Weapon":
            case "Ranged Weapon":
                let weapon = parseWeapon(asset);
                model.addWeapon(weapon);
                unit.addWeapon(weapon);
                break;

            case "Wargear":
                // Wargear could be a piece of wargear with a wargear
                // ability, or it could be a weapon with multiple profiles.
                // We treat the former as an ability, and the latter as
                // multiple weapons, except they need to be prefixed with
                // the name of the overall weapon.
                let weaponFound = false;
                for (let subAsset of asset.assets.traits) {
                    if (subAsset.classification == "Melee Weapon" ||
                        subAsset.classification == "Ranged Weapon") {
                        let weapon = parseWeapon(subAsset, asset.designation + " - ");
                        model.addWeapon(weapon);
                        unit.addWeapon(weapon);
                        weaponFound = true;
                    }
                }
                if (!weaponFound) {
                    let ability = parseAbility(asset);
                    model.addAbility(ability);
                    unit.addAbility(ability);
                }
                break;
        }
    }

    return model;
}

function parseWeapon(weaponAsset, namePrefix = "") {
    let name = namePrefix + weaponAsset.designation;
    let isMelee = (weaponAsset.classification == "Melee Weapon");
    let range = isMelee ? "Melee" : weaponAsset.stats.Range.processed.format.current;
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

    return weapon;
}

function parseAbility(abilityAsset) {
    return new Model.Ability(
        abilityAsset.designation,
        abilityAsset.text,
        abilityAsset.keywords.Keywords);
}

function parseUnit(unitAsset) {
    let unit = new Model.Unit(unitAsset.designation);

    for (let asset of unitAsset.assets.traits) {
        switch (asset.classification) {
            case "Model":
                let model = parseModel(asset, unit);
                unit.addModel(model);
                break;

            case "Ability":
            case "Enhancement":
                unit.addAbility(parseAbility(asset));
                break;

            case "Wargear":
                // Two possibilities here - this might be a unit-scope
                // wargear ability, or it might be a weapon with multiple
                // profiles on a single-model unit. We'll deal with the
                // latter case later, so just handle the former case here.
                let weaponFound = false;
                for (let subAsset of asset.assets.traits) {
                    if ((subAsset.classification == "Melee Weapon") ||
                        (subAsset.classification == "Ranged Weapon")) {
                        weaponFound = true;
                        break;
                    }
                }
                if (!weaponFound) {
                    unit.addAbility(parseAbility(asset));
                }
                break;

            // Single-model units may also have "Melee Weapon" or
            // "Ranged Weapon" child assets; again, they'll be handled
            // later by re-parsing this unit as a model.
         }
    }

    for (let asset of unitAsset.assets.included) {
        if (asset.classification == "Model") {
            let model = parseModel(asset, unit);
            unit.addModel(model);
        }
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
        unit.isSingleModel = true;
        let model = parseModel(unitAsset, unit);
        unit.addModel(model);
    }

    unit.completeParse();

    return unit;
}

module.exports.rosterizerParse = (rawData) => {
    const json = extractRegistryJSON(rawData);
    let roster = parseRegistry(json);
    return roster;
}