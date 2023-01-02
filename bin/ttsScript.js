const fs = require("fs");
const path = require("path");

class ScriptBuilder {

    constructor(modulePath) {
        this.availableModules = this.loadModules(modulePath)
    }

    loadModules(modulePath) {
        let moduleMapText = fs.readFileSync(path.join(modulePath, "module_mapping.json"));

        let loadedModules = {
            MatchedPlay: {
                Constants: null,
                Module: null,
                ScriptKeys: null
            },
            Crusade: {
                Constants: null,
                Module: null,
                ScriptKeys: null
            }
        }

        for (const [name, module] of Object.entries(JSON.parse(moduleMapText))) {
            if (!loadedModules[name])
                continue;

            for (const [field, fieldData] of Object.entries(module)) {
                if (field === "ScriptKeys")
                    loadedModules[name].ScriptKeys = fieldData;
                else
                    loadedModules[name][field] = fs.readFileSync(path.join(modulePath, fieldData));
            }
        }

        return loadedModules;
    }

    /**
     * Formats the given modules into the appropriate lua scripting string to be given to units
     * @param {string[]} modules An array containing the names of the modules to be loaded
     * @returns A string containing the fully formatted lua scripting for the army
     */
    build(modules) {
        let scripts = [],
            scriptingMap = [],
            modulesToLoad = modules.map(name => this.availableModules[name])
                .filter(module => module);

        scriptingMap.length = 10;

        // load constants first because I always want them at the top
        scripts.push("local scriptingFunctions");
        scripts.push(...modulesToLoad.map(module => module.Constants));
        scripts.push(...modulesToLoad.map(module => module.Module));

        scriptingMap.fill("\tnone");

        for (const map of modulesToLoad.map(module => module.ScriptKeys))
            for (const [key, func] of Object.entries(map))
                scriptingMap[parseInt(key, 10)-1] = `\t--[[${key}]]${" ".repeat(3-key.length)+func}`;

        scripts.push(`-- this needs to be defined after all scripting functions\nscriptingFunctions = {\n${scriptingMap.join(",\n")}\n}`);

        return "\n".repeat(5) + scripts.join("\n".repeat(5));
    }
}

module.exports.ScriptBuilder = ScriptBuilder;