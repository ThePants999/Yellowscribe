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

const MELEE_RANGE = "Melee";

class Roster {
    edition = "10e";
    order = [];
    units = new Map();
    errors = [];

    addUnit(unit) {
        this.order.push(unit.uuid);
        this.units.set(unit.uuid, unit);
    }

    addError(error) {
        this.errors.push(error);
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

    _internalAbilities = [];

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
        this._internalAbilities.push(ability);
    }

    addAnother() {
        this.number += 1;
    }

    setNumber(number) {
        this.number = number;
    }

    isMelee() {
        return this.range == MELEE_RANGE;
    }

    completeParse() {
        // Called when we've finished parsing this weapon. We
        // now need to convert abilitiesInternal into the strings
        // that the TTS mod needs.

        if (this._internalAbilities.length == 0) {
            // Well, that was easy.
            this.abilities = "-";
            this.shortAbilities = "-";
        } else {
            // Format the abilities into a single list, with
            // core abilities first and special abilities last.
            this.abilities = "";
            this.shortAbilities = "";
            let specialAbilities = [];

            for (let ability of this._internalAbilities) {
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
                        this.abilities += ability.name;
                        let lowerAbility = ability.name.toLowerCase();
                        if (weaponAbilityShortNames.has(lowerAbility)) {
                            // This ability has a short form - use it.
                            this.shortAbilities += weaponAbilityShortNames.get(lowerAbility);
                        } else {
                            // This ability doesn't have a short form:
                            // bump it to special abilities.
                            specialAbilities.push(ability);
                            this.shortAbilities += "*"
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

            for (let ability of specialAbilities) {
                this.abilities += "\n" + ability.name + ": " + ability.desc;
            }
        }

        delete this._internalAbilities;
    }
}

class Model {
    name;
    abilities = new Set();
    weapons = [];
    number;
    _internalAbilities = [];
    _parentUnit;

    constructor(name, number, parentUnit) {
        this.name = name;
        this.number = parseInt(number, 10);
        this._parentUnit = parentUnit;
    }

    addAbility(ability) {
        if (!this.abilities.has(ability.name)) {
            this.abilities.add(ability.name);
            this._internalAbilities.push(ability);
        }
    }

    addWeapon(weapon) {
        let found = false;
        for (let existingWeapon of this.weapons) {
            if (existingWeapon.name == weapon.name) {
                if (this._parentUnit.weapons.get(weapon.name).isMelee() == weapon.isMelee()) {
                    // Duplicate of one we already have
                    existingWeapon.number += weapon.number;
                    found = true;
                    break;
                } else {
                    // Dual-profile weapon. The Rosterizer parser is able to catch
                    // this in advance, but the Rosz parser isn't; we kindly help
                    // out by handling it here.
                    let meleeName = weapon.name + " (melee)";
                    let rangedName = weapon.name + " (ranged)";
                    if (weapon.isMelee()) {
                        this._parentUnit.renameWeapon(weapon.name, rangedName);
                        existingWeapon.name = rangedName;
                        weapon.name = meleeName;
                    } else {
                        this._parentUnit.renameWeapon(weapon.name, meleeName);
                        existingWeapon.name = meleeName;
                        weapon.name = rangedName;
                    }
                }
            }
        }

        if (!found) {
            // New one
            this.weapons.push({"name": weapon.name, "number": weapon.number});
        }

        this._parentUnit.addWeapon(weapon);
    }

    // This model's unit has been fully parsed.
    unitParseComplete() {
        delete this._internalAbilities;
        delete this._parentUnit;
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
    uuid = require('crypto').randomBytes(4).toString("hex");

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

    // These are weapons which all models in the unit have, stored
    // during unit parsing and then pushed onto all models once
    // we know we have them all.
    _allModelWeapons = [];

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
        this.models["models"].set(require('crypto').randomBytes(8).toString("hex"), model);
        this.models["totalNumberOfModels"] += model.number;
    }

    addProfile(profile) {
        this.modelProfiles.set(profile.name, profile);
    }

    addAllModelsWeapon(weapon) {
        this.weapons.set(weapon.name, weapon);
        this._allModelWeapons.push(weapon);
    }

    addWeapon(weapon) {
        this.weapons.set(weapon.name, weapon);
    }

    renameWeapon(oldName, newName) {
        let weapon = this.weapons.get(oldName);
        if (weapon) {
            this.weapons.set(newName, this.weapons.get(oldName));
            this.weapons.delete(oldName);
            weapon.name = newName;
        }
    }

    completeParse() {
        // Called when we've finished parsing this unit. We now
        // need to duplicate unit-scope abilities onto models, and
        // then collate all model-scope abilities onto the unit.
        // We also need to aggregate Core and Faction abilities, and
        // copy all-model weapons to all models.
        for (let ability of this.abilities.values()) {
            for (let model of this.models["models"].values()) {
                model.addAbility(ability);
            }
        }

        for (let model of this.models["models"].values()) {
            for (let ability of model._internalAbilities) {
                this.addAbility(ability);
            }
            for (let weapon of this._allModelWeapons) {
                model.addWeapon(weapon);
            }
            model.unitParseComplete();
        }
        delete this._allModelWeapons;

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

module.exports = {MELEE_RANGE, Roster, ModelCharacteristics, Ability, Weapon, Model, Unit}