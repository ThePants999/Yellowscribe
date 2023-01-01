const ModelCollection = require("./ModelCollection"),
    crypto = require('crypto'),
    Util = require("./Util"),

    factionKeywordRegex = /Faction: (?<keyword>.+)/,
    abilityTrimRegex = /(?:\d+(?:\.|:)|\d+\-\d+(?:\.|:))?\s*(?<ability>.+)/,
    woundTrackWoundsRemainingRegex = /(?<wounds>\d+\-\d+\+?|\d+\+)(?=\s*wounds(?: remaining)?)/i,
    woundTrackProfileNameRegex = /(?<name>^[^[\()]+?)\s*(?:(?:\[\d\]|\(\w\)| \w )\s*(?:\(\d+\-\d+\+?|\(\d+\+)|\s*\(\d+\-\d+\+?|\(\d+\+)/,
    statDamageCheckRegex = /^stat damage /i,
    bracketValueRegex = /(?<min>\d+)\-(?<max>\d+)/,
    weaponToIgnoreRegex = /of the profiles below|select one of the following profiles|select one of the profiles/i,
    woundTrackTypeNameRegex = /^wound track|wound track$/i,
    psykerNameRegex = /^Psyker \((?<name>.+?)\)/,
    smiteTestRegex = /^smite\b/i,
    
    keywordsToIgnore = ["HQ", "Troops", "Elites", "Fast Attack", "Heavy Support", "Flyer", "Dedicated Transport", "Lord of War", "No Force Org Slot", "Warlord"];

module.exports = class Unit {
    name;
    decorativeName;
    factionKeywords = new Set();
    keywords = new Set();
    abilities = {};
    models  = new ModelCollection();
    modelProfiles = {};
    weapons = {};
    //weapons  = [];
    rules = [];
    uuid = crypto.randomBytes(4).toString("hex"); 
    unassignedWeapons = [];
    pl = 0;
    isSingleModel;



    constructor (name, decorativeName, isSingleModel) {
        this.name = name.trim();
        this.decorativeName = decorativeName;
        this.isSingleModel = isSingleModel;
    }


    addModelProfileData (profileData, differentName) {
        //this.models.addModelFromData(profileData.$.name, selectionData, number);
        let profileName = differentName ? differentName.trim() : profileData.$.name.trim();

        if (!this.modelProfiles[profileName]) {
            let data = { name: profileName };

            for (const char of profileData.characteristics[0].characteristic)
                if (char.$.name.toLowerCase() === "save")
                    data.sv = char._ ? char._.trim() : "-";
                else
                    data[char.$.name.toLowerCase()] = char._ ? char._.trim() : "-";

            this.modelProfiles[profileName] = data;
        }
    }

    addModelSimpleData (name, selectionData, number) {
        this.models.addModelFromData(name.trim(), selectionData, number);
    }

    addAbility (profileData) {
        const trimmedName = profileData.$.name.match(abilityTrimRegex).groups.ability,
            dangerousReplace = { "[": "(", "]": ")", '"': '\\"' };

        if (!this.abilities[trimmedName])
            this.abilities[trimmedName] = { 
                name: trimmedName.replace(/[\[\]"]/g, m => dangerousReplace[m]), 
                desc: profileData.characteristics[0].characteristic[0]._.replace(/[\[\]"]/g, m => dangerousReplace[m])
            };
    }

    /**
     * Adds the given data as an ability to the unit.
     * @param {string} abilityName The name of the ability to be added
     * @param {string} abilityDescription The ability's description
     */
    addFormattedAbility (abilityName, abilityDescription) {
        const dangerousReplace = { "[": "(", "]": ")", '"': '\\"' };

        if (!this.abilities[abilityName])
            this.abilities[abilityName] = {
                name: abilityName.replace(/[\[\]"]/g, m => dangerousReplace[m]),
                desc: abilityDescription.replace(/[\[\]"]/g, m => dangerousReplace[m])
            };
    }

    addRule (ruleData) {
        let trimmedName = ruleData.$.name.match(abilityTrimRegex).groups.ability;

        if (!this.rules.includes(trimmedName))
            this.rules.push(trimmedName);
    }

    addWeapon (weaponData) {
        let data = { name: weaponData.$.name },
            mightIgnore = false;
        
        for (const char of weaponData.characteristics[0].characteristic) {
            if (char.$.name === "Type" && (char._ === "-" || !char._)) {
                if (mightIgnore) return;
                else mightIgnore = true;
            }

            if (char.$.name === "Abilities" && char._ && char._.match(weaponToIgnoreRegex)) {
                if (mightIgnore) return; // I don't want these sorts of profiles showing up
                else mightIgnore = true;
            }

            data[char.$.name.toLowerCase()] = char._;
        }

        if (!data.abilities) 
            data.abilities = "-";

        this.weapons[weaponData.$.name] = data;
    }

    addKeyword (keywordData) {
        let factionMatch = keywordData.$.name.match(factionKeywordRegex);

        if (factionMatch)
            this.factionKeywords.add(factionMatch.groups.keyword) //.push(factionMatch.groups.keyword);
        else if (!keywordsToIgnore.includes(keywordData.$.name))
            this.keywords.add(keywordData.$.name);
    }

    addPL (pl) {
        this.pl += pl;
    }

    addBracket (bracketData, modelName) {
        let data = [],
            bracket = "";
            
        for (const char of bracketData.characteristics[0].characteristic) {
            if (char.$.name !== "Remaining W" && char.$.name !== "Wounds")
                data.push(char._);
            
            else {
                if (!char._ || char._ === "-") return;

                bracket = char._;
            }
        }

        if (!this.woundTrack)
            this.woundTrack = {};
        
        if (statDamageCheckRegex.test(modelName)) {
            // first check for a predefined model profile that this bracket should match
            // this seems problematic
            let firstName = this.getFirstChangingProfile();

            if (firstName)
                modelName = firstName;
        }

        if (!this.woundTrack[modelName])
            this.woundTrack[modelName] = {};

        this.woundTrack[modelName][bracket] = data;
    }

    getFirstChangingProfile () {
        for (const profile of Object.values(this.modelProfiles))
            for (const val of Object.values(profile))
                if (val === "*")
                    return profile.name;

        return undefined;
    }


    handleSelectionDataRecursive (selectionData, parentSelectionData, isTopLevel = false) {
        //let selectionType = "";
        switch (selectionData.$.type.toLowerCase()) {
            case "model":
                // special case for Hellions because theyre formatted like the escpae below, but actually have a unit definition as well
                if (selectionData.profiles &&
                    selectionData.profiles[0] !== "" &&
                    selectionData.profiles[0].profile[0].$.name === selectionData.$.name) {
                        this.addModelSimpleData(selectionData.$.name, selectionData.selections, selectionData.$.number);
                        break;
                }
                
                // sometimes the data creators mark a unit as a "model" for whatever reason,
                // then later on describe the actual models in the unit (marking those as "unit" ugh)
                if (selectionData.selections && 
                    selectionData.selections[0] !== "" && 
                    selectionData.selections[0].selection.findIndex(selection => selection.$.type.toLowerCase() === "unit") >= 0)
                        break;

                this.addModelSimpleData(selectionData.$.name, selectionData.selections, selectionData.$.number);
                break;
            case "unit":
                if (selectionData.selections && selectionData.selections[0] !== "") {
                    let found = false;
        
                    // search selections for models or units.
                    // if we cant find any, assume the unit is supposed to be a model
                    for (const selection of selectionData.selections[0].selection) {
                        if (selection.$.type === "model" || selection.$.type === "unit") {
                            found = true;
                            break;
                        }
        
                        else if (selection.profiles && selection.profiles[0] !== "") {
                            for (const profile of selection.profiles[0].profile) {
                                if (profile.$.typeName.toLowerCase() === "unit") {
                                    found = true;
                                    break;
                                }
                            }
        
                            if (found) break;
                        }
                    }
        
                    if (!found)
                        this.addModelSimpleData(selectionData.$.name, selectionData.selections, selectionData.$.number);
                }
                break;
            case "upgrade":
                if (!parentSelectionData || parentSelectionData.$.type.toLowerCase() === "model") break;
                if (selectionData.profiles && selectionData.profiles[0] !== "") {
                    let found = false;

                    for (const profile of selectionData.profiles[0].profile){
                        if (profile.$.typeName.toLowerCase() === "unit" || profile.$.typeName.toLowerCase() === "model") {
                            found = true;
                            break;
                        }
                    }

                    if (found) break;
                }
                
                // Sometimes the data creators mark models as "upgrade"s without even providing 
                // a clue that theyre supposed to be models. This tries to catch that at least in a special
                // case (Space Marine Bike Squad). Basically, if the model profile's name can be found in an upgrade's name,
                // assume that the upgrade is referencing a model. I fear that this will have consequences with other units.
                // If it does, just make this an actual special case called out by name.
                if (Object.keys(this.modelProfiles).findIndex(name => 
                        selectionData.$.name.includes(name) && // if this selection's name includes a profile's name
                        !this.models.has(name) // but only if there isn't actually a model with that name
                    ) >= 0 &&
                    parentSelectionData.$.type.toLowerCase() === "unit") { // special case for heavy mortar batteries, the model will be added later so we dont need to add it here
                        this.addModelSimpleData(selectionData.$.name, selectionData.selections, selectionData.$.number);
                    
                        // by this point, since there were no models defined in the unit's selections,
                        // the "unit" will have already been added as a model, so we need to remove it if it exists
                        this.models.remove(parentSelectionData.$.name);
                }
                break;
        }

        if (selectionData.profiles && selectionData.profiles[0] !== "") {
            for (const profile of selectionData.profiles[0].profile) {
                switch (profile.$.typeName.toLowerCase()) {
                    case "unit": 
                    case "model":
                        if (//selectionData.$.name.includes(profile.$.name) && // hopefully this isn't necessary
                            selectionData.$.type.toLowerCase() !== "unit" &&
                            selectionData.$.type.toLowerCase() !== "model" &&
                            (!isTopLevel || // special case for top level of selection data being marked as upgrade
                                (selectionData.selections && selectionData.selections[0] !== "" &&
                                    selectionData.selections[0].selection.findIndex(selection => selection.$.type === "model") < 0))) // another special case for characters being marked as upgrade
                                this.addModelSimpleData(profile.$.name, selectionData.selections, selectionData.$.number);

                        if (selectionData.$.type.toLowerCase() === "model" && 
                            selectionData.$.name !== profile.$.name &&
                            !profile.$.name.match(woundTrackProfileNameRegex))
                            this.addModelProfileData(profile, selectionData.$.name);
                        else 
                            this.addModelProfileData(profile);
                        break;
                    case "abilities":
                        this.addAbility(profile);
                        break;
                    case "weapon":
                        this.addWeapon(profile);
                        break;
                    case "wound track":
                        this.addBracket(profile, selectionData.$.name);
                        break;
                    case "explosion":
                        let explosionData = profile.characteristics[0].characteristic.map(char => char._);
                        
                        this.addFormattedAbility(`Explodes (${explosionData.join("|")})`, 
                                        `When this model is destroyed, roll one D6 before removing it from play. On a ${explosionData[0]} it explodes, and each unit within ${explosionData[1]} suffers ${explosionData[2]} mortal wounds.`);
                        break;
                    case "psyker":
                        if (!this.psykerProfiles) this.psykerProfiles = [];
                        let matchedName = profile.$.name.match(psykerNameRegex),
                            psykerName = matchedName ? matchedName.groups.name : profile.$.name,
                            psykerProfile;//matchedName ? matchedName.groups.name : profile.$.name }; // there should only be one per profile

                        for (const model of this.models)
                            if (psykerName === model.name)
                                psykerProfile = { name: psykerName };

                        if (!psykerProfile)
                            psykerProfile = { name: this.name };

                        for (const char of profile.characteristics[0].characteristic) {
                            if (char.$.name.toLowerCase() === "powers known") psykerProfile.known = char._;
                            else psykerProfile[char.$.name.toLowerCase()] = char._;
                        }

                        this.psykerProfiles.push(psykerProfile)
                        break;
                    case "psychic power":
                        if (!this.powersKnown) this.powersKnown = [];
                        let power = { name: profile.$.name };

                        for (const char of profile.characteristics[0].characteristic) {
                            let name = char.$.name.replace(" ", "")
                            power[`${name.charAt(0).toLowerCase()}${name.slice(1)}`] = char._;
                        }

                        this.powersKnown.push(power);
                        break;
                    default:
                        // Special Cases
                        let isStatDamage = statDamageCheckRegex.test(profile.$.typeName.toLowerCase())

                        // handle IG vehicle wound tracks
                        if (isStatDamage)
                            this.addBracket(profile, parentSelectionData ? parentSelectionData.$.name : this.name);//this.name);

                        // sometimes the data creators like to put extra stuff before or after "Wound Track"
                        else if (profile.$.typeName.match(woundTrackTypeNameRegex))
                            this.addBracket(profile, selectionData.$.name)

                        // very rarely, a data creator will put an unexpected typeName for a model profile
                        else if (profile.$.name.match(woundTrackWoundsRemainingRegex))
                            this.addModelProfileData(profile)

                        // data creator got fancy with different types of data
                        // credit to @Caleth#9668 for this
                        if (profile.characteristics && profile.characteristics[0] !== "") {
                            const description = profile.characteristics[0].characteristic.find(char => char.$.name.toLowerCase() == "description");
                            
                            if (description)
                                this.addFormattedAbility(profile.$.name, description._);
                        }
                }
            }
        }

        if (selectionData.rules && selectionData.rules[0] !== "")
            for (const rule of selectionData.rules[0].rule)
                this.addRule(rule);

        if (selectionData.selections && selectionData.selections[0] !== "")
            for (const selection of selectionData.selections[0].selection)
                this.handleSelectionDataRecursive(selection, selectionData); // recursively search selections
                            

        if (selectionData.categories && selectionData.categories[0] !== "")
            for (const category of selectionData.categories[0].category)
                    this.addKeyword(category);

        if (selectionData.costs && selectionData.costs[0] !== "")
            for (const cost of selectionData.costs[0].cost)
                if (cost.$.name.trim() === "PL") {
                    this.addPL(parseInt(cost.$.value, 10));
                    break;
                }
    }

    update () {
        //Util.log(this)
        this.addAbilitiesToAllModels();
        this.checkWeapons();
        this.checkForStrangeWoundTrackFormatting();
        this.sortWoundTracks();
        this.addSmiteIfNecessary();
        this.makeSureWoundTrackNameExists();
        this.checkIfIsSingleModel();
        this.checkModelNames();
        //Util.log(this);
        
        return this;
    }

    /**
     * Adds all abilities that are only on the unit as a whole to every model in the unit
     */
    addAbilitiesToAllModels () {
        let currentlyAssignedAbilities = this.models.getAllAbilities(),
            abilitiesToAdd = Object.keys(this.abilities).filter(ability => !currentlyAssignedAbilities.includes(ability));

        for (const model of this.models)
            model.abilities = model.abilities
                                    .union(abilitiesToAdd)
                                    .union(this.rules); // I dont know which is more efficient: this or concat first then union
    }

    /**
     * Checks the weapons the unit has against the weapons that the models in the unit have.
     * Any weapons that are found on the unit but not on any models are added to unassignedWeapons.
     * Any weapons that are found on models but not on the unit (ie has no profile) are removed
     * If no model has any weapons, all unassigned weapons are added to every model. (and are no longer considered unassigned)
     * NOTE: this behavior may need to change depending on how some units are formatted.
     */
    checkWeapons () {
        let assignedWeapons = this.models.getAllWeaponNames(),
            unassignedWeapons = Object.keys(this.weapons)
                                    .filter(weaponName => !assignedWeapons.includes(weaponName))
                                    .map(weaponName => { return { name: weaponName, number: 1 }});
        
        /* for (const model of this.models)
            if (model.weapons.length === 0) {
                model.setWeapons(unassignedWeapons);
                assigned = true;
            } */
        if (assignedWeapons.length === 0) {
            for (const model of this.models)
                model.setWeapons(unassignedWeapons);
        }

        else {
            const weaponsToRemove = [];

            // if the number of wepaons on models isnt the same as the number of weapon definitions, somethings wrong
            if (assignedWeapons.length !== this.weapons.length) {
                // find any weapons that exist on model sbut have no profiles
                for (const weaponName of assignedWeapons)
                    if (!this.weapons[weaponName])
                        weaponsToRemove.push(weaponName);

                // if we found any, remove them from all models
                if (weaponsToRemove.length > 0)
                    for (const model of this.models)
                        model.weapons = model.weapons.filter(weapon => !weaponsToRemove.includes(weapon.name))
            }
                    
            this.unassignedWeapons = unassignedWeapons;
        }
    }

    /**
     * Some data creators (for some reason) don't use the wonderful wound track formatting,
     * they just input the wound track as multiple different profiles for a single model.
     * This is a workaround for those situations.
     * NOTE: this currently only works for single model units
     */
    checkForStrangeWoundTrackFormatting() {
        // if there is a profile with the words "wounds remaining",
        // it's safe to assume it's supposed to be a bracket
        if (Object.keys(this.modelProfiles).findIndex(name => !!name.match(woundTrackWoundsRemainingRegex)) >= 0) {
            let bracketProfiles = {}, //Object.entries(this.modelProfiles)
                                    //.filter(([name, bracket]) => !!name.match(woundTrackWoundsRemainingRegex))
                                    //.map(([name, bracket]) => bracket),
                otherProfiles = {},
                baseProfile,
                characteristics,
                defaultProfile,
                profileName;
                
            // hopefully fix some special cases where data creators named bracket profiles wrong
            // if there's only one kind of model in the unit, assume all the bracket profiles are for that model
            if (Object.keys(this.models.models).length == 1 && 
                    Object.keys(this.modelProfiles).findIndex(name => !name.match(woundTrackWoundsRemainingRegex)) < 0) {
                bracketProfiles[this.name] = Object.values(this.modelProfiles);
                profileName = this.name;
            }

            else { 
                for (const [name, profile] of Object.entries(this.modelProfiles)) {
                    if (name.match(woundTrackWoundsRemainingRegex)) {
                        profileName = name.match(woundTrackProfileNameRegex).groups.name.trim();
                        if (!bracketProfiles[profileName]) 
                            bracketProfiles[profileName] = [profile];
                        else
                            bracketProfiles[profileName].push(profile);

                        // if the data creator just included the already formatted profile, ignore it
                        if (otherProfiles[profileName])
                            delete otherProfiles[profileName];
                    }
                    else
                        otherProfiles[name] = profile;
                }
            }
            
            this.woundTrack = {}; // set up a wound track
            this.modelProfiles = otherProfiles;

            // if there are somehow model profiles that arent bracket profiles,
            // but there is only one model in the unit, something's weird (e.g. Canis Rex).
            // so, add the extraneous model to the unit
            if (Object.keys(this.models.models).length == 1 && Object.keys(otherProfiles).length > 0)
                for (const [key,profile] of Object.entries(otherProfiles))
                    this.models.add(new Model(key));
            
            // sort the profiles so that we can be sure to pick the one that has the wounds for later
            for (const profiles of Object.values(bracketProfiles)) {
                profiles.sort((a,b) => {
                    let aWounds = a.name.match(woundTrackWoundsRemainingRegex).groups.wounds,
                        bWounds = b.name.match(woundTrackWoundsRemainingRegex).groups.wounds;
    
                    if (bWounds.indexOf("+") > 0) return 1;
                    if (aWounds.indexOf("+") > 0) return -1;
    
                    let bMin = bWounds.match(bracketValueRegex).groups.min,
                        aMax = aWounds.match(bracketValueRegex).groups.max;
    
                    return bMin - aMax;
                });
            }

            let replaced = false;
            
            for (const [name, profiles] of Object.entries(bracketProfiles)) {
                this.woundTrack[profileName] = {};
                characteristics = { m:[],ws:[],bs:[],s:[],t:[],w:[],a:[],ld:[],sv:[] };
                defaultProfile = { name: profileName };
                baseProfile = profiles[0];

                for (const bracket of profiles) {

                    for (const model of this.models) {
                        if (model.name === bracket.name) {
                            if (replaced) 
                                this.models.remove(model.name);
                                
                            else {
                                replaced = true;
                                model.name = profileName;
                            }
                        }
                    }

                    for (const [key,characteristic] of Object.entries(bracket)){
                        if (key === "name")
                            this.woundTrack[profileName][characteristic.match(woundTrackWoundsRemainingRegex).groups.wounds] = [];
                        
                        else if (characteristics[key])
                            characteristics[key].push(characteristic);
                    }
                }

                let bracketNames = Object.keys(this.woundTrack[profileName]),
                current = 0;

                for (const [key,char] of Object.entries(characteristics)) {
                    if (!char.isAllSameValue() && key !== "w") {
                        defaultProfile[key] = "*";

                        for (const val of char)
                            this.woundTrack[profileName][bracketNames[current++]].push(val);
                        
                        current = 0;
                    }
                    else
                        defaultProfile[key] = baseProfile[key];
                }

                this.modelProfiles[profileName] = defaultProfile;
            }
        }
    }

    /**
     * Makes sure that the wound track is in the right order
     * (if it isn't then changing brackets doesn't work properly)
     */
    sortWoundTracks () {
        if (!this.woundTrack) return;
        
        let newTrack = {}
        for (const [name, track] of Object.entries(this.woundTrack)) {
            newTrack[name] = {};
            let brackets = Object.keys(track).sort((a,b) => {
                if (b.indexOf("+") > 0) return 1;
                if (a.indexOf("+") > 0) return -1;

                let bMin = b.match(bracketValueRegex).groups.min,
                    aMax = a.match(bracketValueRegex).groups.max;

                return bMin - aMax;
            });
    
            for (const bracket of brackets)
                newTrack[name][bracket] = this.woundTrack[name][bracket];
        }

        this.woundTrack = newTrack;
    }

    /**
     * If the unit is a psyker and doesn't ahve the Smite psychic power, add it.
     */
    addSmiteIfNecessary () {
        if (this.psykerProfiles) {
            if (!this.powersKnown) this.powersKnown = [];

            for (const power of this.powersKnown)
                if (smiteTestRegex.test(power.name))
                    return;

            // the only way to get here is if smite was not found
            this.powersKnown.splice(0, 0, {
                name: "Smite",
                warpCharge: "5",
                range: "18\"",
                details: "If manifested, the closest visible enemy unit within 18\" of the psyker suffers D3 mortal wounds. If the result of the Psychic test was more than 10 the target suffers D6 mortal wounds instead."
            });
        }
    }

    /**
     * If a name for a wound track doesnt exist, it might be a plural of one of the model profiles
     */
    makeSureWoundTrackNameExists () {
        if (this.woundTrack) {
            let found = [];

            loop1: for (const name of Object.keys(this.woundTrack)) {
                for (const model in this.models)
                    if (name === model.name) continue loop1;

                // only way to get here is if theres a wound track that hasn't matched a model name
                for (const model of this.models) { // yes I know this looks inefficient
                    if (name.slice(0, -1) === model.name) { // remove the last letter and compare (ie remove "s" from a plural)
                        found.push({ wtName: name, modelName: model.name });
                        continue loop1;
                    } 
                }
            }

            for (const find of found) {
                this.woundTrack[find.modelName] = this.woundTrack[find.wtName];
                delete this.woundTrack[find.wtName];
            }
        }
    }

    /**
     * Just makes sure single model units are marked as such
     */
    checkIfIsSingleModel () {
        if (this.models.totalNumberOfModels === 1)
            this.isSingleModel = true;
    }

    /**
     * Checks to makes sure that all model names match a model profile
     */
    checkModelNames () {
        for (const model of this.models) {
            if (!this.modelProfiles[model.name]) {
                const modelNameRegex = new RegExp(model.name + "$", "i");

                for (const profileName of Object.keys(this.modelProfiles)) {
                    if (modelNameRegex.test(profileName)) {
                        model.name = profileName;
                        break;
                    }

                    if (profileName.toLowerCase().includes(model.name.toLowerCase()) && !this.models.models[profileName]) {
                        if (this.woundTrack && this.woundTrack[model.name]) {
                            this.woundTrack[profileName] = this.woundTrack[model.name];
                            delete this.woundTrack[model.name];
                        }

                        model.name = profileName;
                    }
                }
            }
        }
    }
}