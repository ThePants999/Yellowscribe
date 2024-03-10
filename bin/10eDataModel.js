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
weaponAbilityShortNames.set("twin linked", "TL");
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
    wargearAllocationMode;

    constructor(wargearAllocationMode = "allModels") {
        this.wargearAllocationMode = wargearAllocationMode;
    }

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
                            // This ability has a short form - use it. (Note - we're going to
                            // throw this away later, this is dead code - we may reinstate it
                            // later.)
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

            // The above logic was designed to provide brevity in weapon tooltips,
            // so "[Devastating Wounds, Sustained Hits 2]" could be shortened to
            // "DW, SH2". Feedback suggests that that's not as important as clarity,
            // so we're going to throw away the short form for now.
            this.shortAbilities = this.abilities;

            for (let ability of specialAbilities) {
                if (this.abilities.length > 0) {
                    this.abilities += "\n";
                }
                this.abilities += ability.name + ": " + ability.desc;
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

    maybeSplit() {
        // We want to modify a single model. If this is a stack of one,
        // it'll do. Otherwise, split one out from this stack.
        if (this.number == 1) {
            return this;
        } else {
            let newModel = new Model(this.name, 1, this.parentUnit);
            newModel._parentUnit = this._parentUnit;
            newModel._internalAbilities = [...this._internalAbilities];
            newModel.weapons = [...this.weapons];
            this.number--;
            this._parentUnit.models["totalNumberOfModels"] -= 1;
            this._parentUnit.addModel(newModel);
            return newModel;
        }
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
    _roster;

    // This one is an easy bit of backwards compatibility with 9e.
    // In the 9e data model, "rules" were any abilities so common-
    // place that the roster didn't bother including their rules
    // text, and the parser in TTS is expecting a list, but is fine
    // with it being empty. The 10e equivalent is Core/Faction
    // abilities, which we handle elsewhere, so this will forever
    // be empty.
    rules = [];

    // These are weapons and wargear abilities which aren't assigned
    // to a specific model. This only happens with rosz files;
    // Rosterizer is more accurate! Depending on the user's choice,
    // we'll assign these once we've got all the models.
    unassignedWeapons = [];
    _unassignedAbilities = [];

    // These are weapons which all models in the unit have, stored
    // during unit parsing and then pushed onto all models once
    // we know we have them all.
    _allModelWeapons = [];

    constructor(name, roster) {
        this.name = name;
        this._roster = roster;
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

    addUnassignedAbility(ability) {
        this._unassignedAbilities.push(ability);
    }

    addAllModelsWeapon(weapon) {
        this.weapons.set(weapon.name, weapon);
        this._allModelWeapons.push(weapon);
    }

    addUnassignedWeapon(weapon) {
        this.weapons.set(weapon.name, weapon);
        this.unassignedWeapons.push(weapon);
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
        // need to allocate anything that's unallocated. We also
        // need to duplicate unit-scope abilities onto models, and
        // then collate all model-scope abilities onto the unit.
        // We finally need to aggregate Core and Faction abilities, and
        // copy all-model weapons to all models.
        if (this._roster.wargearAllocationMode == "oneModel" ||
            this._roster.wargearAllocationMode == "separateModels") {
            // We need to auto-allocate unallocated wargear. We want to
            // go in the order of most to least boring models, which
            // likely means the ones there's most of in the unit.
            let modelsArr = Array.from(this.models["models"].values());
            modelsArr.sort((a, b) => b.number - a.number);
            let modelIndex = 0;
            let modelToModify = null;

            for (let weapon of this.unassignedWeapons) {
                if (modelToModify == null || this._roster.wargearAllocationMode == "separateModels") {
                    // We need to split out another model to modify.
                    if (modelToModify == modelsArr[modelIndex]) {
                        // We just modified the last model in the stack,
                        // move onto the next stack
                        modelIndex++;

                        if (modelIndex >= modelsArr.length) {
                            // We just wrapped round the set of models. That
                            // means we've probably got nonsense data - more
                            // weapons to assign than models in the unit!?
                            // Can't see any sensible logic for how to handle
                            // this, so we'll just start from the beginning
                            // again so we don't crash.
                            modelIndex = 0;
                        }
                    }
                    modelToModify = modelsArr[modelIndex].maybeSplit();
                }

                modelToModify.name += " w/ " + weapon.name;
                modelToModify.addWeapon(weapon);
            }

            for (let ability of this._unassignedAbilities) {
                if (modelToModify == null || this._roster.wargearAllocationMode == "separateModels") {
                    // We need to split out another model to modify.
                    if (modelToModify == modelsArr[modelIndex]) {
                        // We just modified the last model in the stack,
                        // move onto the next stack
                        modelIndex++;

                        if (modelIndex >= modelsArr.length) {
                            // We just wrapped round the set of models. That
                            // means we've probably got nonsense data - more
                            // weapons to assign than models in the unit!?
                            // Can't see any sensible logic for how to handle
                            // this, so we'll just start from the beginning
                            // again so we don't crash.
                            modelIndex = 0;
                        }
                    }
                    modelToModify = modelsArr[modelIndex].maybeSplit();
                }

                modelToModify.name += " w/ " + ability.name;
                modelToModify.addAbility(ability);
            }
        } else {
            // Unallocated wargear is to be treated as assigned to all
            // models - nice and easy.
            this._allModelWeapons = this._allModelWeapons.concat(this.unassignedWeapons);
            for (let ability of this._unassignedAbilities) {
                this.addAbility(ability);
            }
        }
        this.unassignedWeapons = [];
        delete this._unassignedAbilities;
        delete this._roster;

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