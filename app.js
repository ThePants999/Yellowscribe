const port = process.env.PORT || 3000,
    http = require('http'),
    //https = require('https'),
    fs = require('fs'),
    crypto = require('crypto'),
    AdmZip = require('adm-zip'),
    parseXML = require('xml2js').parseString,
    //html = fs.readFileSync('bs2tts.html'),
    util = require("util"),
    //url = require("url"),
    path = require('path'),
    statik = require("node-static"),
    //xmlBuilder = require("xmlbuilder2"),
    //FAVICON_PATH = path.join(__dirname, 'favicon.ico'),
    MODULE_PATH = "lua_modules",
    HOMEPAGE = "bs2tts.html",
    Roster = require("./bin/Roster");


const ONE_MINUTE = 60000,
    TEN_MINUTES = 600000,
    PATH_PREFIX = "files/",
    FILE_NAME_REGEX = /(?<name>.+?)(?=.json)/,
    weaponTypeRegex = /(?<type>.+?)(?:[0-9dD\/ ]+)?$/,

    ERRORS = {
        invalidFormat: `<h2 class='error'>I can only accept .rosz files.</h2>
        <p>
            Please make sure you are attempting to upload your roster and not another file by accident!
        </p>`
            .replace(/[\n\r]/g, "\\n"),
        unknown: `<h2 class='error'>Something went wrong.</h2>
        <p>
            Please reach out to Yellow Man in the <a href='https://discord.gg/kKT6JKsdek'>BS2TTS discord server</a>.
            Please send your .rosz file along with your bug report, and thank you so much for your patience!
        </p>`
            .replace(/[\n\r]/g, "\\n"),
        fileWrite: `<h2 class='error'>Something went wrong while creating your roster.</h2>
        <p>
            Please reach out to Yellow Man in the <a href='https://discord.gg/kKT6JKsdek'>BS2TTS discord server</a>.
            Please send your .rosz file along with your bug report, and thank you so much for your patience!
        </p>`
            .replace(/[\n\r]/g, "\\n"),
        rosterNotFound: "Your roster code appears to have expired, please upload it again and get a new code."
    },
    
    MODULES = {
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
    },
    
    WEAPON_TYPE_VALUES = {
        "rapid fire": 0,
        assault: 0,
        heavy: 0,
        macro: 0,
        pistol: 1,
        grenade: 2,
        melee: 3
    },
    
    SANITIZATION_MAPPING = {
        " & ": " and ",
        ">": "＞",
        "<": "＜"
    },
    
    SANITIZATION_REGEX = new RegExp(Object.keys(SANITIZATION_MAPPING).join("|"), "g");



Array.prototype.union = function(arr) {
    return Array.from(new Set(this.concat(arr))); // set removes duplicates
};

Array.prototype.isAllSameValue = function () {
    return Array.from(new Set(this)).length === 1;
};


const file = new statik.Server('./site'),
    currentFiles = new Set(fs.readdirSync(PATH_PREFIX).map(fileName => fileName.match(FILE_NAME_REGEX).groups.name)),
    server = http.createServer(function (req, res) {
        if (req.method === 'POST') {
            let data = [], dataLength = 0;

            req.on('data', chunk => {
                data.push(chunk);
                dataLength += chunk.length
            })
            .on('end', () => {
                let postURL = new URL(`http://${req.headers.host}${req.url}`),
                    buf = Buffer.alloc(dataLength),
                    uuid;

                do uuid = crypto.randomBytes(4).toString("hex"); 
                while (currentFiles.has(uuid));

                currentFiles.add(uuid);

                for (let i = 0, len = data.length, pos = 0; i < len; i++) { 
                    data[i].copy(buf, pos); 
                    pos += data[i].length; 
                } ;

                if (postURL.pathname === "/format_and_store_army" || postURL.pathname === "/getFormattedArmy") {
                    try {
                        let zip = new AdmZip(buf),
                            zipEntries = zip.getEntries();
                    
                        for (let i = 0; i < zipEntries.length; i++)
                            parseXML(zip.readAsText(zipEntries[i]), (_err, result) => {
                                fs.writeFile("output.json", JSON.stringify(result.roster.forces, null, 4), () =>{})
                                //parseRos(result.roster.forces);
                                let armyDataObj = Roster.parse(result.roster.forces);

                                if (postURL.pathname === "/format_and_store_army") {
                                    armyDataObj.uiHeight = postURL.searchParams.get('uiHeight');
                                    armyDataObj.uiWidth = postURL.searchParams.get('uiWidth');
                                    armyDataObj.baseScript = buildScript(postURL.searchParams.get("modules").split(","));

                                    fs.writeFile(`${PATH_PREFIX}${uuid}.json`, 
                                                JSON.stringify(armyDataObj, replacer)
                                                    .replace(" & ", " and "), 
                                                (err) => {
                                                    let content,status;
            
                                                    if (!err) {
                                                        content = `{ "id": "${uuid}" }`;
                                                        status = 200;
                                                    }
                                                    else {
                                                        content = `{ "err": "${ERRORS.fileWrite}" }`;
                                                        status = 500
                                                    }
            
                                                    sendHTTPResponse(res, content, status);
                                                });
                                }
                                else
                                    sendHTTPResponse(res, JSON.stringify(armyDataObj, replacer), 200);
                            });
                    }
                    catch (err) {
                        if (err.toString().includes("Invalid or unsupported zip format.")) {
                            sendHTTPResponse(res, `{ "err": "${ERRORS.invalidFormat}" }`, 415);
                            console.log(err);
                        }
                        else {
                            sendHTTPResponse(res, `{ "err": "${ERRORS.unknown}" }`, 500);
                            console.log(err);
                        }
                    }
                }

                else if (postURL.pathname === "/getArmyCode") {
                    try {                   
                        let armyData = JSON.parse(buf.toString());
                        
                        sendHTTPResponse(res, `{ "code": "${uuid}" }`, 200);
                        
                        formatAndStoreXML(  uuid, 
                                            armyData.order, 
                                            armyData.units,
                                            postURL.searchParams.get('uiHeight'),
                                            postURL.searchParams.get('uiWidth'),
                                            postURL.searchParams.get('decorativeNames'),
                                            buildScript(postURL.searchParams.get("modules").split(",")));

                        /* if (postURL.pathname === "/format_and_store_army") {
                            armyDataObj.uiHeight = postURL.searchParams.get('uiHeight');
                            armyDataObj.uiWidth = postURL.searchParams.get('uiWidth');
                            armyDataObj.baseScript = buildScript(postURL.searchParams.get("modules").split(","))

                            fs.writeFile(`${PATH_PREFIX}${uuid}.json`, 
                                        JSON.stringify(armyDataObj, replacer)
                                            .replace(" & ", " and "), 
                                        (err) => {
                                            let content,status;
    
                                            if (!err) {
                                                content = `{ "id": "${uuid}" }`;
                                                status = 200;
                                            }
                                            else {
                                                content = `{ "err": "${ERRORS.fileWrite}" }`;
                                                status = 500
                                            }
    
                                            sendHTTPResponse(res, content, status);
                                        });
                        }

                        else
                            sendHTTPResponse(res, JSON.stringify(armyDataObj, replacer).replace(" & ", " and "), 200); */
                    }
                    catch (err) {
                        sendHTTPResponse(res, `{ "err": "${ERRORS.unknown}" }`, 500);
                        console.log(err);
                    }
                }
            });
        } 
        else if (req.method === "GET") {
            if (req.url === "/favicon.ico")
                file.serveFile('/img/favicon.ico', 200, {}, req, res);
            
            else if (req.url === "/")
                file.serveFile(HOMEPAGE, 200, {}, req, res);
            
            else {
                let getURL = new URL(`http://${req.headers.host}${req.url}`);

                if (getURL.pathname === "/get_army_by_id") {
                    try {
                        const id = getURL.searchParams.get('id').trim(),
                            fileData = fs.readFileSync(`${PATH_PREFIX}${id}.json`);

                        if (!fileData) 
                            sendHTTPResponse(res, `{ "err": "Roster not found!" }`, 404);

                        else
                            sendHTTPResponse(res, fileData);
                    }

                    catch (err) {
                        sendHTTPResponse(res, `{ "err": "${ERRORS.rosterNotFound}" }`, 404);
                        console.log(err);
                    }
                }

                else
                    file.serve(req, res);
            } 
        }
    });

/**
 * Sends an http response with the given ServerResponse
 * @param {http.ServerResponse} response The response to write to
 * @param {*} data The data to be written to the response
 * @param {number} code The http header response code
 * @param {string} contentType The content type header to be sent with the response
 */
function sendHTTPResponse(response, data, code = 200, contentType = 'application/json') {
    response.writeHead(code, {'Content-Type': contentType});
    response.write(data);
    response.end();
}


// Listen on port 3000, IP defaults to 127.0.0.1
server.listen(port);
loadModules();

// Put a friendly message on the terminal
console.log('Server running at http://127.0.0.1:' + port + '/');

setInterval(() => {
    fs.readdir(PATH_PREFIX, (err, files) => {
        if (err) 
            return;

        if (!files || typeof files[Symbol.iterator] !== 'function') {
            console.log("for some reason files is not iterable");
            return;
        }

        for (const filePath of files) {
            if ((Date.now() - TEN_MINUTES) > fs.statSync(PATH_PREFIX + filePath).mtime) {

                fs.unlink(path.join(PATH_PREFIX, filePath), err => {});
            }
        }
    });

    //let stats = fs.statSync("/dir/file.txt");
    //let mtime = stats.mtime;
}, ONE_MINUTE);


function loadModules() {
    let moduleMapText = fs.readFileSync(path.join(MODULE_PATH, "module_mapping.json"));

    for (const [name, module] of Object.entries(JSON.parse(moduleMapText))) {
        if (!MODULES[name]) continue;
        for (const [field, fieldData] of Object.entries(module)) {
            if (field === "ScriptKeys")
                MODULES[name].ScriptKeys = fieldData;
            else
                MODULES[name][field] = fs.readFileSync(path.join(MODULE_PATH, fieldData));
        }
    }
}

/**
 * Formats the given modules into the appropriate lua scripting string to be given to units
 * @param {string[]} modules An array containing the names of the modules to be loaded
 * @returns A string containing the fully formatted lua scripting for the army
 */
function buildScript(modules) {
    let scripts = [],
        scriptingMap = [],
        modulesToLoad = modules.map(name => MODULES[name])
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





/********* ROSTER PARSING FOR .rosz FILES *********/










/********* UNIT DATA TO XML *********/

function formatAndStoreXML(id, order, armyData, uiHeight, uiWidth, decorativeNames, baseScript) {
    
    storeFormattedXML(id, undefined, undefined, armyData, uiHeight, uiWidth, decorativeNames, baseScript, order);
    return;


    const xml = xmlBuilder.create().ele("ROOT");
    let totalHeight = 0;
    // TODO: return total height for scrollContainer, and xml to add to it
    
    for (const unitID of order) {
        const unit = armyData[unitID],
            unitData = getUnitXMLData(unit);

        totalHeight += unitData.height;

        xml.ele("VerticalLayout", { class: "transparent", childForceExpandHeight: "false" })
            .ele("Text", { class: "unitName" }).txt(unit.name).up()
            .ele("VerticalLayout", { class: "unitContainer", childForceExpandHeight: "false", preferredHeight: unitData.height, spacing: "20" })
                .import(unitData.fragment)

        /*  <VerticalLayout class="transparent" childForceExpandHeight="false">
                <Text class="unitName">${unitName}</Text>
                <VerticalLayout class="unitContainer" childForceExpandHeight="false" preferredHeight="${height}" spacing="20">
                    ${unitData}
                </VerticalLayout>
            </VerticalLayout> */
    }

    storeFormattedXML(id, xml.end({ prettyPrint: false }).slice(27, -7), totalHeight, armyData, uiHeight, uiWidth, baseScript);
}

function getUnitXMLData(unit) {
    const fragment = xmlBuilder.fragment().ele("HorizontalLayout", { class: "groupingGontainer" });
    let maxHeight = 0;

    for (const [modelID, model] of Object.entries(unit.models.models)) {
        const modelData = getModelXMLData(model, modelID, unit);

        fragment.import(modelData.fragment); //
        maxHeight = Math.max(maxHeight, modelData.height);
    }

    return { fragment, height: maxHeight };

    /*  <HorizontalLayout class="groupingContainer">
            <VerticalLayout preferredWidth="500" childForceExpandHeight="false" class="modelContainer" id="${unitID}|${modelID}" preferredHeight="${height}">
                <Text class="modelDataName">${numberString}${modelName}</Text>
                ${weapons}
                ${abilities}
            </VerticalLayout> 
            .
            .
            .
        </HorizontalLayout>*/
}

function getModelXMLData(model, modelID, unit) {
    const fragment = xmlBuilder.fragment(),
        container = fragment.ele("VerticalLayout", { 
            preferredWidth: "500", 
            childForceExpandHeight: "false", 
            class: "modelContainer", 
            id: `${unit.uuid}|${modelID}`
        });
    let height = 40; // name
        
    combineAndSortWeapons(model, unit.weapons);

    container.ele("Text", { class: "modelDataName" }).txt((model.number > 1 ? `${model.number}x `: "") + model.name);

    if (model.weapons.length + (model.assignedWeapons ? model.assignedWeapons.length : 0) > 0) {
        const weaponSectionData = getModelSectionData("Weapons", model.weapons); // at this point, assigned weapons will already be in the list

        container.import(weaponSectionData.fragment);
        height += weaponSectionData.height;
    }

    if (model.abilities.length) {
        const abilitySectionData = getModelSectionData("Abilities", model.abilities);

        container.import(abilitySectionData.fragment);
        height += abilitySectionData.height;
    }

    container.att("preferredHeight", height);

    return { fragment, height };
    /*  <VerticalLayout preferredWidth="500" childForceExpandHeight="false" class="modelContainer" id="${unitID}|${modelID}" preferredHeight="${height}">
            <Text class="modelDataName">${numberString}${modelName}</Text>
            <VerticalLayout childForceExpandHeight="false" childForceExpandWidth="false">
                <Text height="15"><!-- spacer --></Text>
                <Text class="modelDataTitle">${weapons?}</Text>
                <Text class="modelData" preferredHeight="${height}">${data}</Text>
            </VerticalLayout>
            <VerticalLayout childForceExpandHeight="false" childForceExpandWidth="false">
                <Text height="15"><!-- spacer --></Text>
                <Text class="modelDataTitle">${abilities?}</Text>
                <Text class="modelData" preferredHeight="${height}">${data}</Text>
            </VerticalLayout>
        </VerticalLayout> */
}

function getModelSectionData (name, dataList) {
    const fragment = xmlBuilder.fragment();
    let height = (dataList.length * 40) + 60; // 37 for each line, 60 for title and spacer

    fragment.ele("VerticalLayout", { childForceExpandHeight: "false", childForceExpandWidth: "false" })
            .ele("Text", { height: "15" }).com("spacer").up()
            .ele("Text", { class: "modelDataTitle" }).txt(name).up()
            .ele("Text", { class: "modelData", preferredHeight: (height - 60)+"" })
                .txt(dataList.map(data => (data.number && data.number > 1 ? `${data.number}x ` : "") + (data.name || data)).join("\n"));

    return { fragment, height };

    /*  <VerticalLayout childForceExpandHeight="false" childForceExpandWidth="false">
            <Text height="15"><!-- spacer --></Text>
            <Text class="modelDataTitle">${title}</Text>
            <Text class="modelData" preferredHeight="${height}">${data}</Text>
        </VerticalLayout>
    */
}

function combineAndSortWeapons(model, characteristicProfiles) {
    if (model.assignedWeapons && model.assignedWeapons.length) 
        model.weapons = model.weapons.concat(model.assignedWeapons);

    model.weapons.sort((weaponA, weaponB) => {
        if (characteristicProfiles[weaponA.name].type === characteristicProfiles[weaponB.name].type) return 0;

        const typeA = characteristicProfiles[weaponA.name].type.match(weaponTypeRegex).groups.type.toLowerCase(),
            typeB = characteristicProfiles[weaponB.name].type.match(weaponTypeRegex).groups.type.toLowerCase(),
            typeAVal = WEAPON_TYPE_VALUES[typeA] ? WEAPON_TYPE_VALUES[typeA] : 0,
            typeBVal = WEAPON_TYPE_VALUES[typeB] ? WEAPON_TYPE_VALUES[typeB] : 0;
        
        if (typeAVal === typeBVal) return weaponA.name.localeCompare(weaponB.name);

        return typeAVal - typeBVal;
    });
}

function storeFormattedXML(id, xml, height, armyData, uiHeight, uiWidth, decorativeNames, baseScript, order) {
    fs.writeFileSync(`${PATH_PREFIX}${id}.json`, JSON.stringify({ 
        xml, 
        order, 
        height, 
        armyData: JSON.parse(sanitize(JSON.stringify(armyData))), // yes, I know this looks awful
        uiHeight, 
        uiWidth,  
        decorativeNames,
        baseScript 
    }));
}






/**
 * Replaces any troublesome characters with "sanitized" versions so as to not break scripting
 * @param {string} str The string to be sanitized
 * @returns {string} The sanitized string
 */
function sanitize(str) {
    return str.replace(SANITIZATION_REGEX, match => SANITIZATION_MAPPING[match]);
}



function replacer(key, value) {
    if (value instanceof Map) 
        return Object.fromEntries(value.entries());
    
    else if (value instanceof Set) 
        return Array.from(value);

    else 
        return value;
}


function log (data) {
    console.log(util.inspect(data, false, null, true));
} 