const AdmZip = require("adm-zip");
const {parseXML} = require("./xml");
const Roster = require("./9eRoster");
const DataModel = require("./10eDataModel");

const BS_10E_SYSTEM_ID = "sys-352e-adc2-7639-d6a9";
const FACTION_KEYWORD_PREFIX = "Faction: ";

function extractRosterXML(rawData) {
    let zip;
    try {
        zip = new AdmZip(rawData);
    } catch (err) {
        return rawData;
    }

    const zipEntries = zip.getEntries();

    if (zipEntries.length !== 1) {
        throw new Error("Invalid Rosz file, it should have only 1 file in archive");
    }

    return zip.readAsText(zipEntries[0]);
}

function parse10eRoster(forces) {
    let roster = new DataModel.Roster();

    for (const force of forces[0].force) {
        if (force.selections && force.selections[0]) {
            for (const selection of force.selections[0].selection) {
                if (selection.$.type == "unit" || selection.$.type == "model") {
                    roster.addUnit(parseUnit(selection));
                }
            }
        }
    }

    return roster;
}

function parseUnit(selection) {
    let unit = new DataModel.Unit(selection.$.name);

    if (selection.profiles && selection.profiles[0]) {
        for (const profile of selection.profiles[0].profile) {
            switch (profile.$.typeName) {
                case "Unit":
                    unit.addProfile(parseModelCharacteristics(profile));
                    break;

                case "Abilities":
                    unit.addAbility(parseAbility(profile));
                    break;
            }
        }
    }

    if (selection.$.type == "model") {
        // This is a single-model unit. Re-parse the selection
        // as a model.
        unit.addModel(parseModel(selection, unit));
    } else if (selection.selections && selection.selections[0]) {
        // This is a multi-model unit. Look for child models and upgrades.
        for (const childSelection of selection.selections[0].selection) {
            switch (childSelection.$.type) {
                case "model":
                    unit.addModel(parseModel(childSelection, unit));
                    break;

                case "upgrade":
                    parseAndAddUnitSelection(childSelection, unit);
                    break;
            }
        }
    }

    for (const category of selection.categories[0].category) {
        let keyword = category.$.name;
        if (keyword.startsWith(FACTION_KEYWORD_PREFIX)) {
            unit.addFactionKeyword(keyword.substring(FACTION_KEYWORD_PREFIX.length));
        } else {
            unit.addOtherKeyword(keyword);
        }
    }

    unit.completeParse();
    return unit;
}

function parseModelCharacteristics(profile) {
    let chrM, chrT, chrSv, chrW, chrLd, chrOC = null;
    for (const characteristic of profile.characteristics[0].characteristic) {
        switch (characteristic.$.name) {
            case "M":
                chrM = characteristic._;
                break;
            case "T":
                chrT = characteristic._;
                break;
            case "SV":
                chrSv = characteristic._;
                break;
            case "W":
                chrW = characteristic._;
                break;
            case "LD":
                chrLd = characteristic._;
                break;
            case "OC":
                chrOC = characteristic._;
                break;
        }
    }
    return new DataModel.ModelCharacteristics(profile.$.name, chrM, chrT, chrSv, chrW, chrLd, chrOC);
}

function parseModel(selection, unit) {
    let model = new DataModel.Model(selection.$.name, selection.$.number, unit);

    parseAndAddModelSelection(selection, model);

    if (selection.profiles && selection.profiles[0]) {
        for (const profile of selection.profiles[0].profile) {
            if (profile.$.typeName == "Unit") {
                // Model-specific characteristic profile.
                unit.addProfile(parseModelCharacteristics(profile));
            }
        }
    }

    return model;
}

function parseAndAddModelSelection(selection, model) {
    if (selection.selections && selection.selections[0]) {
        // This selection has children.
        for (const childSelection of selection.selections[0].selection) {
            parseAndAddModelSelection(childSelection, model);
        }
    }

    // In Battlescribe data, a selection of X models
    // with Y weapons each will contain X*Y weapons.
    // But our data model wants to know how many each
    // model has.
    let number = parseInt(selection.$.number) / model.number;
    if (selection.profiles && selection.profiles[0]) {
        for (const profile of selection.profiles[0].profile) {
            switch (profile.$.typeName) {
                case "Melee Weapons":
                case "Ranged Weapons":
                    model.addWeapon(parseWeapon(profile, number));
                    break;

                case "Abilities":
                    model.addAbility(parseAbility(profile));
                    break;
            }
        }
    }
}

function parseAndAddUnitSelection(selection, unit) {
    if (selection.selections && selection.selections[0]) {
        // This selection has children.
        for (const childSelection of selection.selections[0].selection) {
            parseAndAddUnitSelection(childSelection, unit);
        }
    }

    if (selection.profiles && selection.profiles[0]) {
        for (const profile of selection.profiles[0].profile) {
            switch (profile.$.typeName) {
                case "Melee Weapons":
                case "Ranged Weapons":
                    unit.addAllModelsWeapon(parseWeapon(profile, 1));
                    break;

                case "Abilities":
                    unit.addAbility(parseAbility(profile));
                    break;
            }
        }
    }
}

function parseWeapon(profile, number) {
    let chrRange, chrA, chrBSWS, chrS, chrAP, chrD, keywords = null;
    let name = profile.$.name;
    if (name.startsWith("➤ ")) {
        // We add each profile of a multi-profile weapon as a
        // separate weapon, but we don't want the arrow that
        // indicates it's a profile.
        name = name.substring(2);
    }

    for (const characteristic of profile.characteristics[0].characteristic) {
        switch (characteristic.$.name) {
            case "Range":
                chrRange = characteristic._;
                break;
            case "A":
                chrA = characteristic._;
                break;
            case "BS":
            case "WS":
                chrBSWS = characteristic._;
                break;
            case "S":
                chrS = characteristic._;
                break;
            case "AP":
                chrAP = characteristic._;
                break;
            case "D":
                chrD = characteristic._;
                break;
            case "Keywords":
                if (characteristic._) {
                    keywords = characteristic._;
                } else {
                    keywords = "-";
                }
                break;
        }
    }

    let weapon = new DataModel.Weapon(name, chrRange, chrA, chrBSWS, chrS, chrAP, chrD);
    weapon.setNumber(number)

    if (keywords != "-") {
        for (const keyword of keywords.split(", ")) {
            weapon.addAbility(new DataModel.Ability(keyword, "", []));
        }
    }

    weapon.completeParse();
    return weapon;
}

function parseAbility(profile) {
    return new DataModel.Ability(profile.$.name, profile.characteristics[0].characteristic[0]._, [])
}

module.exports.roszParse = (rawData) => {
    const xmlData = extractRosterXML(rawData);
    const result = parseXML(xmlData);
    if (result.roster.$.gameSystemId == BS_10E_SYSTEM_ID) {
        return parse10eRoster(result.roster.forces);
    } else {
        return Roster.parse(result.roster.forces);
    }
};