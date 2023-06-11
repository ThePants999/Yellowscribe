const { existsSync } = require("fs");

class Roster {
    units = [];

    addUnit(unit) {
        this.units.push(unit);
    }
}

class ModelCharacteristics {
    name;
    M;
    T;
    Sv;
    W;
    Ld;
    OC;

    constructor(name, m, t, sv, w, ld, oc) {
        this.name = name;
        this.M = m;
        this.T = t;
        this.Sv = sv;
        this.W = w;
        this.Ld = ld;
        this.OC = oc;
    }

    clone() {
        return new ModelCharacteristics(
            this.name,
            this.M,
            this.T,
            this.Sv,
            this.W,
            this.Ld,
            this.OC);
    }

    characteristicsMatch(other) {
        return (
            (this.M == other.M) &&
            (this.T == other.T) &&
            (this.Sv == other.Sv) &&
            (this.W == other.W) &&
            (this.Ld == other.Ld) &&
            (this.OC == other.OC));
    }
}

class Ability {
    name;
    text;
    keywords;

    constructor(name, text, keywords) {
        this.name = name;
        this.text = text;
        this.keywords = keywords;
    }
}

class Weapon {
    name;
    isMelee;
    range;
    A;
    BSWS;
    S;
    AP;
    D;
    number = 1;
    abilities = [];

    constructor(name, isMelee, range, a, bsws, s, ap, d) {
        this.name = name;
        this.isMelee = isMelee;
        this.range = range;
        this.A = a;
        this.BSWS = bsws;
        this.S = s;
        this.AP = ap;
        this.D = d;
    }

    addAbility(ability) {
        this.abilities.push(ability);
    }

    addAnother() {
        this.number += 1;
    }
}

class Model {
    name;
    stats;
    number;
    rangedWeapons = new Map();
    meleeWeapons = new Map();
    abilities = [];

    constructor(name, m, t, sv, w, ld, oc, number) {
        this.name = name;
        this.stats = new ModelCharacteristics(name, m, t, sv, w, ld, oc);
        this.number = number;
    }

    addAbility(ability) {
        this.abilities.push(ability);
    }

    addWeapon(weapon) {
        let map = weapon.isMelee ? this.meleeWeapons : this.rangedWeapons;
        if (map.has(weapon.name)) {
            // Duplicate of one we already have
            map.get(weapon.name).addAnother();
        } else {
            map.set(weapon.name, weapon);
        }
    }
}

class Unit {
    name;
    factionKeywords = new Set();
    otherKeywords = new Set();
    rangedWeapons = new Map();
    meleeWeapons = new Map();
    abilities = new Map();
    models = [];
    modelProfiles = [];

    constructor(name) {
        this.name = name;
    }

    addFactionKeyword(keyword) {
        this.factionKeywords.add(keyword);
    }

    addOtherKeyword(keyword) {
        this.otherKeywords.add(keyword);
    }

    addAbility(ability) {
        this.abilities.set(ability.name, ability);
    }

    addModel(model) {
        this.models.push(model);

        let found = false;
        for (let existingCharacteristics of this.modelProfiles.values()) {
            if (existingCharacteristics.characteristicsMatch(model.stats)) {
                // This set of characteristics would duplicate one
                // that we already have - we only want unique sets.
                if (model.stats.name != existingCharacteristics.name) {
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
            // Clone this object, we want our own copy so we can
            // modify it
            this.modelProfiles.push(model.stats.clone());
        }

        for (let ability of model.abilities) {
            this.addAbility(ability);
        }

        for (let weapon of model.rangedWeapons.values()) {
            this.rangedWeapons.set(weapon.name, weapon);
        }
        for (let weapon of model.meleeWeapons.values()) {
            this.meleeWeapons.set(weapon.name, weapon);
        }
    }
}

module.exports = {Roster, ModelCharacteristics, Ability, Weapon, Model, Unit}