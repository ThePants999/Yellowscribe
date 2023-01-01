const Model = require("./Model"),
    crypto = require('crypto');

module.exports = class ModelCollection {
    models = {}; /*
            {
                "model name": [
                    { name: ""... },
                    { name: ""...(different stuff) }
                ]
            }
    */
    //characteristicProfiles;
    totalNumberOfModels = 0;
    
    [Symbol.iterator]() { 
        let index = 0,
            models = Object.values(this.models).flat();

        return {
          next: () => {
            if (index < models.length) {
              return {value: models[index++], done: false}
            } else {
              return {done: true}
            }
          }
        }
    }


    constructor(firstModel) {
        //this.models = {};
        //this.characteristicProfiles = [];
        //this.totalNumberOfModels = 0;

        if (firstModel) {
            this.models[firstModel.name] = [firstModel];
            this.totalNumberOfModels += firstModel.number;
        }
    }



    addModelFromData (name, selectionData, number) {
        let newModel = new Model(name, number ? parseInt(number, 10) : number);
        //console.log(`Name: ${name}; Number: ${number}`);

        //log(selectionData);
        //console.log("selections: " + selectionData);

        if (selectionData && selectionData[0] !== "" && selectionData[0].selection)
            newModel.handleSelectionDataRecursive(selectionData);

        this.add(newModel);
    }

    /**
     * Looks to see if the collection contains the given model
     * @param {Model|String} model the model to look for
     * @returns {boolean} true if the model was found somewhere in the collection, false otherwise
     */
    has (model) {
        if (typeof model === "string") {
            if (!this.models[model]) return undefined;
            return this.models[model].find(curModel => curModel.number > 0); // ignore models with number 0
        }
            
        if (this.models[model.name])
            for (const m of this.models[model.name])
                if (model.isEqualTo(m))
                    return m;
        
        return undefined;
    }

    add(...models) {
        let foundModel;

        for (const model of models) {
            if (model === null) continue;

            if ((foundModel = this.has(model)) === undefined) {
                if (this.has(model.name))
                    this.models[model.name].push(model);
    
                else
                    this.models[model.name] = [model];
            }
            else foundModel.add(model);

            this.totalNumberOfModels += model.number
        }
    }

    /**
     * Assigns the given weapon to all models in the collection. Generally used with a weapon definition (not profile).
     * @param {Weapon[]} weaponArray the weapon to be assigned
     */
    /* assignWeaponsToAllModels(weaponArray) {
        for (const key of Object.keys(this.models))
            for (const model of this.models[key])
                model.setWeapons(weaponArray);
    } */

    getAllModels() {
        return Object.values(this.models).flat();
    }

    getAllWeaponNames () {
        return [...new Set(this.getAllModels().map(model => model.weapons.map(weapon => weapon.name)).flat())];
    }

    getAllAbilities () {
        return [...new Set(this.getAllModels().map(model => model.abilities).flat())];
    }


    toJSON() {
        return { 
            models: Object.fromEntries(
                        Object.values(this.models)
                                                /* .map(modelArray => modelArray.sort((a,b) => {
                                                    return a.name.localeCompare(b.name)
                                                })) */
                                                .flat()
                                                .map(model => [crypto.randomBytes(8).toString("hex"), model])),
            characteristicProfiles: this.characteristicProfiles,
            totalNumberOfModels: this.totalNumberOfModels
        };
    }

    remove (modelName) {
        for (const name of Object.keys(this.models))
            if (name === modelName) {
                this.totalNumberOfModels -= this.models[name].reduce((prev,curr) => prev + curr.number, 0);
                delete this.models[name];
            }
    }
}