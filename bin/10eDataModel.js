crypto = require('crypto');

// You may scratch your head at some elements of how this is
// structured. Me too, buddy! It's simply matching the 9e
// data model, because that allows the client side to be
// completely unchanged, and the TTS side to be mostly
// unchanged.

let weaponAbilityShortNames = new Map();
weaponAbilityShortNames.set("assault", "AS");
weaponAbilityShortNames.set("rapid fire", "RF");
weaponAbilityShortNames.set("ignores cover", "IC");
weaponAbilityShortNames.set("twin-linked", "TL");
weaponAbilityShortNames.set("pistol", "PL");
weaponAbilityShortNames.set("torrent", "TO");
weaponAbilityShortNames.set("lethal hits", "LH");
weaponAbilityShortNames.set("lance", "LC");
weaponAbilityShortNames.set("indirect fire", "IF");
weaponAbilityShortNames.set("precision", "PR");
weaponAbilityShortNames.set("blast", "BL");
weaponAbilityShortNames.set("melta", "ML");
weaponAbilityShortNames.set("heavy", "HV");
weaponAbilityShortNames.set("hazardous", "HZ");
weaponAbilityShortNames.set("devastating wounds", "DW");
weaponAbilityShortNames.set("sustained hits", "SH");
weaponAbilityShortNames.set("extra attacks", "EA");

class Roster {
    edition = "10e";
    order = [];
    units = new Map();

    addUnit(unit) {
        this.order.push(unit.uuid);
        this.units.set(unit.uuid, unit);
    }
}

class ModelCharacteristics {
    name;
    m;
    t;
    sv;
    w;
    ld;
    oc;

    constructor(name, m, t, sv, w, ld, oc) {
        this.name = name;
        this.m = m;
        this.t = t;
        this.sv = sv;
        this.w = w;
        this.ld = ld;
        this.oc = oc;
    }

    characteristicsMatch(other) {
        return (
            (this.m == other.m) &&
            (this.t == other.t) &&
            (this.sv == other.sv) &&
            (this.w == other.w) &&
            (this.ld == other.ld) &&
            (this.oc == other.oc));
    }
}

class Ability {
    name;
    desc;
    keywords;

    constructor(name, text, keywords) {
        this.name = name;
        this.desc = text;
        this.keywords = keywords;
    }
}

class Weapon {
    name;
    range;
    a;
    bsws;
    s;
    ap;
    d;
    number = 1;
    abilities = "";
    shortAbilities = "";

    internalAbilities = [];

    constructor(name, range, a, bsws, s, ap, d) {
        this.name = name;
        this.range = range;
        this.a = a;
        this.bsws = bsws;
        this.s = s;
        this.ap = ap;
        this.d = d;
    }

    addAbility(ability) {
        this.internalAbilities.push(ability);
    }

    addAnother() {
        this.number += 1;
    }

    completeParse() {
        // Called when we've finished parsing this weapon. We
        // now need to convert abilitiesInternal into the strings
        // that the TTS mod needs.

        if (this.internalAbilities.length == 0) {
            // Well, that was easy.
            this.abilities = "-";
            this.shortAbilities = "-";
        } else {
            // Format the abilities into a single list, with
            // core abilities first and special abilities last.
            this.abilities = "";
            this.shortAbilities = "";
            let specialAbilities = [];

            for (let ability of this.internalAbilities) {
                if (ability.keywords.includes("Special")) {
                    specialAbilities.push(ability);
                } else {
                    if (this.abilities.length > 0) {
                        this.abilities += ", ";
                        this.shortAbilities += ",";
                    }

                    let finalSpaceIndex = ability.name.lastIndexOf(" ");
                    if ((finalSpaceIndex < 0) ||
                        isNaN(ability.name.substring(finalSpaceIndex))) {
                        // This is a standalone ability with no
                        // numeric portion.
                        let lowerAbility = ability.name.toLowerCase();
                        if (weaponAbilityShortNames.has(lowerAbility)) {
                            // This ability has a short form - use it.
                            this.abilities += ability.name;
                            this.shortAbilities += weaponAbilityShortNames.get(lowerAbility);
                        } else {
                            // This ability doesn't have a short form:
                            // bump it to special abilities.
                            specialAbilities.push(ability);
                        }
                    } else {
                        // This ability has a numeric final component.
                        // We'll need to use the short form without
                        // the numeric part, then add the number.
                        let initialPart = ability.name.substring(0, finalSpaceIndex).toLowerCase();
                        let numericPart = ability.name.substring(finalSpaceIndex + 1);
                        this.abilities += ability.name;
                        this.shortAbilities += weaponAbilityShortNames.get(initialPart) + numericPart;
                    }
                }
            }

            if (specialAbilities.length > 0) {
                // We have at least one special ability to append.
                if (this.abilities.length > 0) {
                    this.shortAbilities += ",";
                }
                this.shortAbilities += "*";

                for (let ability of specialAbilities) {
                    if (this.abilities.length > 0) {
                        this.abilities += ", ";
                    }
                    this.abilities += ability.name + ": " + ability.text;
                }
            }
        }

        delete this.internalAbilities;
    }
}

class Model {
    name;
    abilities = new Set();
    weapons = [];
    number;
    internalAbilities = [];

    constructor(name, number) {
        this.name = name;
        this.number = parseInt(number, 10);
    }

    addAbility(ability) {
        if (!this.abilities.has(ability.name)) {
            this.abilities.add(ability.name);
            this.internalAbilities.push(ability);
        }
    }

    addWeapon(weapon) {
        let found = false;
        for (let existingWeapon of this.weapons) {
            if (existingWeapon.name == weapon.name) {
                // Duplicate of one we already have
                existingWeapon.number += 1;
                found = true;
                break;
            }
        }

        if (!found) {
            // New one
            this.weapons.push({"name": weapon.name, "number": 1});
        }
    }

    // This model's unit has been fully parsed.
    unitParseComplete() {
        delete this.internalAbilities;
    }
}

class Unit {
    name;
    factionKeywords = new Set();
    keywords = new Set();
    abilities = new Map();
    models = {};
    modelProfiles = new Map();
    weapons = new Map();
    isSingleModel = false;
    uuid = crypto.randomBytes(4).toString("hex");

    // This one is an easy bit of backwards compatibility with 9e.
    // In the 9e data model, "rules" were any abilities so common-
    // place that the roster didn't bother including their rules
    // text, and the parser in TTS is expecting a list, but is fine
    // with it being empty. The 10e equivalent is Core/Faction
    // abilities, which we handle elsewhere, so this will forever
    // be empty.
    rules = [];

    // Similarly - we don't have a problem in 10e assigning weapons
    // to models.
    unassignedWeapons = [];

    constructor(name) {
        this.name = name;
        this.models["models"] = new Map();
        this.models["totalNumberOfModels"] = 0;
    }

    addFactionKeyword(keyword) {
        this.factionKeywords.add(keyword);
    }

    addOtherKeyword(keyword) {
        this.keywords.add(keyword);
    }

    addAbility(ability) {
        this.abilities.set(ability.name, ability);
    }

    addModel(model) {
        this.models["models"].set(crypto.randomBytes(8).toString("hex"), model);
        this.models["totalNumberOfModels"] += model.number;
    }

    addProfile(profile) {
        let found = false;
        for (let existingCharacteristics of this.modelProfiles.values()) {
            if (existingCharacteristics.characteristicsMatch(profile)) {
                // This set of characteristics would duplicate one
                // that we already have - we only want unique sets.
                if (profile.name != existingCharacteristics.name) {
                    // Two models with different names exhibiting the
                    // same characteristics means that this is the
                    // "common" set of characteristics for the unit,
                    // and is best represented with the unit name.
                    existingCharacteristics.name = this.name;
                }
                found = true;
                break;
            }
        }
        if (!found) {
            this.modelProfiles.set(profile.name, profile);
        }
    }

    addWeapon(weapon) {
        this.weapons.set(weapon.name, weapon);
    }

    completeParse() {
        // Called when we've finished parsing this unit. We now
        // need to duplicate unit-scope abilities onto models, and
        // then collate all model-scope abilities onto the unit.
        // We also need to aggregate Core and Faction abilities.
        for (let ability of this.abilities.values()) {
            for (let model of this.models["models"].values()) {
                model.addAbility(ability);
            }
        }

        for (let model of this.models["models"].values()) {
            for (let ability in model.internalAbilities.values()) {
                this.addAbility(ability);
            }
            model.unitParseComplete();
        }

        // Extract abilities tagged Core or Faction.
        let coreAbilities = [];
        let factionAbilities = [];
        for (let ability of this.abilities.values()) {
            if (ability.keywords.includes("Core")) {
                coreAbilities.push(ability.name);
            } else if (ability.keywords.includes("Faction")) {
                factionAbilities.push(ability.name);
            }
        }

        // Aggregate abilities tagged Faction into a single Faction ability.
        // Add it to the unit.
        let factionAbilitiesStr = "";
        for (let ability of factionAbilities) {
            this.abilities.delete(ability);
            if (factionAbilitiesStr.length > 0) { factionAbilitiesStr += ", "; }
            factionAbilitiesStr += ability;
        }
        if (factionAbilitiesStr.length > 0) {
            let newAbility = new Ability("Faction", factionAbilitiesStr, []);
            this.addAbility(newAbility);
        }

        // Aggregate abilities tagged Core into a single Core ability.
        // Add it to the unit.
        let coreAbilitiesStr = "";
        for (let ability of coreAbilities) {
            this.abilities.delete(ability);
            if (coreAbilitiesStr.length > 0) { coreAbilitiesStr += ", "; }
            coreAbilitiesStr += ability;
        }
        if (coreAbilitiesStr.length > 0) {
            let newAbility = new Ability("Core", coreAbilitiesStr, []);
            this.addAbility(newAbility);
        }

        // Finally, remove keywords from abilities - TTS isn't interested.
        for (let ability of this.abilities.values()) {
            delete ability.keywords;
        }
    }
}

module.exports = {Roster, ModelCharacteristics, Ability, Weapon, Model, Unit}