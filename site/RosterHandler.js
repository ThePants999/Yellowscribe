const rosterInput = byID("rosterUpload"),
    rosterUploadContainer = byID("rosterUploadContainer"),
    loadingContainer = byID("loadingContainer"),
    preloadContainer = byID("preloadContainer"),
    rosterDisplayContainer = byID("rosterDisplayPage"),
    displayContainer = byID("displayContainer"),
    submitButton = byID("submit");

let fileToUpload, armyData;





/******* TODO *******/
/* set up hiding and showing individual pages */





on(rosterInput, 'input', (e) => {
    // TODO: hide stuff and show loading roster
    console.log(e.target.files);
    sendArmy(e.target.files[0]);
});

on(rosterUploadContainer, 'drag dragstart dragend dragover dragenter dragleave drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
})
on(rosterUploadContainer, 'dragover dragenter', () => {
    rosterInput.classList.add('dragging');
})
on(rosterUploadContainer, 'dragleave dragend drop', () => {
    rosterInput.classList.remove('dragging');
})
on(rosterUploadContainer, 'drop', (e) => {
    sendArmy(e.dataTransfer.files[0]);
});


on(submitButton, "click", () => {
    //displayContainer.classList.add("loading");

    let req = new XMLHttpRequest();

    on(req, "load", (e) => {
        if (req.status === 200) {
            let armyCode = JSON.parse(req.responseText).code,
                display = byID("loadedCodeDisplayTemplate").content.cloneNode(true),
                codeContainer = display.getElementById("codeContainer");
            
            codeContainer.value = armyCode;
            codeContainer.select();
            on(codeContainer, "focus", e => e.target.select());

            setTimeout(() => {
                clearNode(rosterDisplayContainer)

                rosterDisplayContainer.insertBefore(display, submitButton.parentNode);
                codeContainer.select();
                submitButton.parentElement.classList.add("hidden");
            }, 250);
        }
        else if (req.status === 500) {
            console.log("responded with 500");
            console.log(req.responseText);
        }
    });

    on(req, "error", transferFailed);

    let crusade = byID("crusadeModule");

    req.open("POST", "getArmyCode?" +
                            `uiHeight=${byID("uiHeight").value}` +
                            `&uiWidth=${byID("uiWidth").value}` +
                            `&decorativeNames=${byID("decorativeNames").checked}` +
                            `&modules=MatchedPlay${crusade.checked ? ",Crusade" : ""}`);

    req.send(JSON.stringify(finalizeData(armyData)));
});

for (const link of document.querySelectorAll("[data-page]"))
    on(link, "click", handleLinkClick);



    




function finalizeData(data) {
    for (const unit of Object.values(data.units)) {
        for (const model of Object.values(unit.models.models)) {
            if (model.assignedWeapons) {
                model.weapons = model.weapons.concat(model.assignedWeapons);
                delete model.assignedWeapons;
            }
        }
    }

    return data;
}

function handleLinkClick(e) {
    const pageName = e.target.getAttribute("data-page");

    // handle special cases
    switch (pageName) {
        case "rosterDisplay":
            byID("settingsContainer").classList.add("open");
            break;
        default:
            byID("settingsContainer").classList.remove("open");
            break;
    }

    for (const selected of document.querySelectorAll(".selected"))
        selected.classList.remove("selected");

    e.target.classList.add("selected");
    showPage(pageName);
}




function sendArmy(fileToUpload) {
    if (fileToUpload) {
        loadingContainer.classList.add("visible");
        preloadContainer.classList.add("hidden", "preventEvents");
        rosterInput.classList.add("preventEvents");
        rosterUploadContainer.classList.add("rosterUpload", "loading", "preventEvents");

        //$("header").addClass("loaded");
        clearNode(byID("errorContainer"), 0)

        formatArmy(fileToUpload);
    }
}

function formatArmy(rosterFile) {
    let oReq = new XMLHttpRequest();

    on(oReq, "load", (e) => {
        if (oReq.status === 200) {
            armyData = JSON.parse(oReq.responseText);
            loadArmy(armyData);
            submitButton.parentElement.classList.remove("hidden");
            showPage("rosterDisplay");
            byID("settingsContainer").classList.add("open");

            resetUploadContainer();
        }

        else {
            byID("errorContainer").innerHTML = JSON.parse(oReq.responseText).err;
            resetUploadContainer();
        }
    });

    on(oReq, "error", transferFailed);

    oReq.open("POST", "getFormattedArmy");
    oReq.send(rosterFile);
}

function transferFailed(e) {
    console.log("something went wrong");
    console.log(e);
}

function resetUploadContainer() {
    // wait just in case of fast loading;
    setTimeout(() => {
        byID("rosterUploadContainer").classList.remove("loading", "preventEvents");
        byID("loadingContainer").classList.remove("visible");
        byID("preloadContainer").classList.remove("hidden", "preventEvents");
        byID("rosterUpload").classList.remove("preventEvents");
    }, 500);
}

function clearNode(node, maxChildren = 1, fromFront = true) {
    while(node.children.length > maxChildren) {
        if (fromFront)
            node.firstChild.remove();
        else
            node.lastChild.remove();
    }
}



function loadArmy(data) {
    let sortedForUnassigned = Array.from(data.order),
        armyDisplay = new DocumentFragment();

    sortedForUnassigned.sort((idA, idB) => {
        if (data.units[idB].unassignedWeapons.length > 0 && data.units[idB].unassignedWeapons.length === 0)
            return 1;

        if (data.units[idA].unassignedWeapons.length > 0 && data.units[idB].unassignedWeapons.length === 0)
            return -1;

        return 0; // both have unassigned
    });

    armyDisplay.append(...sortedForUnassigned.map(id => formatUnitDisplay(data.units[id])));

    const rosterDisplay = byID("rosterDisplayPage");
    
    clearNode(rosterDisplay);

    rosterDisplay.insertBefore(armyDisplay, rosterDisplay.lastElementChild);
    document.querySelector('[data-page="rosterDisplay"]').classList.add("visible", "selected");
    document.querySelector('[data-page="rosterInput"]').classList.remove("selected");
}

function formatUnitDisplay(unit) {
    let unitDisplay = byID("unitDisplayTemplate").content.cloneNode(true),
        modelContainer = unitDisplay.querySelector(".modelContainer"),
        unitName = unitDisplay.querySelector(".unitName input");

    unitDisplay.querySelector("section").dataset.uuid = unit.uuid;
    unitName.value = unit.decorativeName || unit.name;
    on(unitName, "input", (e) => unit.decorativeName = e.target.value);

    for (const model of Object.values(unit.models.models).flat()) 
        modelContainer.appendChild(formatModelDisplay(model, unit));

    return unitDisplay;
}

function formatModelDisplay(model, unit) {
    let modelDisplay = byID("modelDisplayTemplate").content.cloneNode(true),
        modelNum = modelDisplay.querySelector(".modelNum");

    model.node = modelDisplay.querySelector(".modelDisplay");
    modelNum.setAttribute("data-num", model.number);
    modelNum.innerHTML = model.number;
    modelDisplay.querySelector(".modelName").innerHTML = model.name;

    if ((!model.weapons || !model.weapons.length) && (!model.assignedWeapons || !model.assignedWeapons.length))
        modelDisplay.querySelector(".weaponDisplay").style.display = "none";
    else {
        let weaponList = modelDisplay.querySelector(".weaponDisplay ul");
            
        for (const weapon of model.weapons) {
            let entry = document.createElement("li");
            
            entry.innerHTML = (weapon.number > 1 ? weapon.number + "x " : "") + weapon.name;

            weaponList.append(entry);
        }

        if (model.assignedWeapons) {
            for (const weapon of model.assignedWeapons) {
                let entry = document.createElement("li"),
                    buttonContainer = document.createElement("div");
                    
                buttonContainer.append(...formatWeaponAssignmentButtons(false, weapon, model, unit, entry));
                entry.className = "weaponUnassignmentContainer"    
                entry.innerHTML = (weapon.number > 1 ? weapon.number + "x " : "") + weapon.name;
                entry.append(buttonContainer);
    
                weaponList.append(entry);
            }
        }
    }

    if (!model.abilities || !model.abilities.length)
        modelDisplay.querySelector(".abilityDisplay").style.display = "none";
    else {
        let abilityList = modelDisplay.querySelector(".abilityDisplay ul");

        for (const ability of model.abilities) {
            let entry = document.createElement("li");

            entry.innerHTML = ability;

            abilityList.append(entry);
        }
    }

    let filteredUnassignedWeapons = !model.assignedWeapons ? 
                                        unit.unassignedWeapons :
                                        unit.unassignedWeapons.filter(weapon => 
                                            model.assignedWeapons.findIndex(assigned => 
                                                weapon.name === assigned.name
                                            ) < 0
                                        );
                                        
    if (!unit.unassignedWeapons || !unit.unassignedWeapons.length || !filteredUnassignedWeapons.length)
        modelDisplay.querySelector(".unassignedDisplay").style.display = "none";
    else {
        let unassignedList = modelDisplay.querySelector(".unassignedDisplay ul");

        for (const weapon of filteredUnassignedWeapons) {
            let entry = document.createElement("li");

            entry.className = "weaponAssignmentContainer"   
            entry.append(...formatWeaponAssignmentButtons(true, weapon, model, unit, entry));

            unassignedList.append(entry);
        }
    }

    return modelDisplay;
}

function formatWeaponAssignmentButtons(assigning, weapon, model, unit) {
    let buttons = [document.createElement("button"), document.createElement("button"), document.createElement("button")]; 

    buttons[0].innerHTML = assigning ? weapon.name : " X ";
    buttons[1].innerHTML = "All";
    buttons[2].innerHTML = "Unit";
    
    on(buttons[0], "click", () => handleSingleWeaponAssignment(assigning, weapon, model, unit));
    on(buttons[1], "click", () => { 
        assignWeapon(assigning, weapon, model, unit);
        combineMatchingLoadouts(model, unit);
    });
    on(buttons[2], "click", () => {
        for (const mod of Object.values(unit.models.models))
            assignWeapon(assigning, weapon, mod, unit);

        while(combineMatchingLoadouts(model, unit));
    });

    if (model.number === 1)
        buttons[1].style.display = "none";

    if (!assigning)
        buttons.splice(2, 1);
        
    return buttons;
}






function handleSingleWeaponAssignment(assigning, weapon, model, unit) {
    let newWeaponList = assigning ? 
                            (model.assignedWeapons ? model.assignedWeapons.concat([ weapon ]) : [weapon]) :
                            model.assignedWeapons.filter(filterWeapon => filterWeapon !== weapon),
        modelWithSameLoadout = Object.values(unit.models.models).filter(toCheck => haveSameLoadout(toCheck, model, newWeaponList))[0];

    if (modelWithSameLoadout) {
        let modelWithSameLoadoutNum = modelWithSameLoadout.node.querySelector(".modelNum"),
            modelNum = model.node.querySelector(".modelNum");

        modelWithSameLoadoutNum.innerHTML = ++modelWithSameLoadout.number;
        modelNum.innerHTML = --model.number;

        modelWithSameLoadoutNum.setAttribute("data-num", modelWithSameLoadout.number);
        modelNum.setAttribute("data-num", model.number);
        
        if (model.number === 0) {
            model.node.remove();
            for (const [key, toRemove] of Object.entries(unit.models.models)){
                if (toRemove === model) {
                    delete unit.models.models[key];
                    break;
                }
            }
        }

        else if (model.number === 1) {
            for (const node of model.node.querySelectorAll(".weaponAssignmentContainer :nth-child(2), .weaponUnassignmentContainer :nth-child(2)"))
                node.style.display = "none";
        }

        if (modelWithSameLoadout.number === 2)
            for (const node of modelWithSameLoadout.node.querySelectorAll(".weaponAssignmentContainer :nth-child(2), .weaponUnassignmentContainer :nth-child(2)"))
                node.style.display = "inline-block";
            
    }
    
    else {
        if (model.number > 1) {
            let newModelUUID = uuid(),
                newModel = JSON.parse(JSON.stringify(model)); // clone it so we dont mess with data structures
                
                model.node.querySelector(".modelNum").innerHTML = --model.number;

            unit.models.models[newModelUUID] = newModel;
            newModel.number = 1;

            assignWeapon(assigning, weapon, newModel, unit, false);
            model.node.parentNode.insertBefore(formatModelDisplay(newModel, unit), model.node.nextSibling);
        }

        else 
            assignWeapon(assigning, weapon, model, unit);
    }
}

function assignWeapon(assigning, weapon, model, unit, update = true) {
    if (assigning) {
        if (!model.assignedWeapons) model.assignedWeapons = [ weapon ];
        else if (model.assignedWeapons.findIndex(find => objectsAreEqual(find, weapon)) < 0)
            model.assignedWeapons.push(weapon);
    }
    
    else
        model.assignedWeapons.splice(model.assignedWeapons.indexOf(weapon), 1)
        
    if (update) {
        let oldNode = model.node;
        
        model.node.parentNode.insertBefore(formatModelDisplay(model, unit), oldNode);
        oldNode.remove();
    }
}

function combineMatchingLoadouts(model, unit) {
    for (const [key,mod] of Object.entries(unit.models.models)) {
        if (haveSameLoadout(model, mod)) {
            let modelNum = model.node.querySelector(".modelNum");

            model.number += mod.number;
            modelNum.innerHTML = model.number;
            modelNum.setAttribute("data-num", model.number);
            mod.node.remove();
            delete unit.models.models[key];
            return true;
        }
    }

    return false;
}






/********* UI HELPER FUNCTIONS *********/

function showPage(name) {
    const pageName = name + "Page";

    if (!hideAllPagesExcept(pageName))
        byID(pageName).classList.replace("hidden", "visible");
}

function hideAllPagesExcept(pageName) {
    let alreadyVisible = false;

    for (const page of document.querySelectorAll(".page.visible")) {
        if (page.id !== pageName)
            page.classList.replace("visible", "hidden");
        else
            alreadyVisible =true;
    }

    return alreadyVisible;
}









function areSameArray(first, second) {
    if (first === second) return true;
    if (!first || !second) return false;
    if (first.length !== second.length) return false;
      
    // .concat() to not mutate arguments
    const arr1 = first.concat().sort();
    const arr2 = second.concat().sort();
    
    for (let i = 0; i < arr1.length; i++)
        if (!objectsAreEqual(arr1[i], arr2[i]))
            return false;

    return true;
}

function objectsAreEqual(obj1, obj2) {
    let obj1Entries = Object.entries(obj1);

    if (obj1Entries.length !== Object.keys(obj2).length) return false;

    for (const [key, val] of obj1Entries)
        if (val !== obj2[key]) return false;

    return true;
}

function haveSameLoadout(firstModel, secondModel, alternateWeaponList) {
    return firstModel !== secondModel && 
        firstModel.name === secondModel.name &&
        areSameArray(firstModel.weapons, secondModel.weapons) &&
        areSameArray(firstModel.assignedWeapons, alternateWeaponList ? alternateWeaponList : secondModel.assignedWeapons) &&
        areSameArray(firstModel.abilities, secondModel.abilities);
}

function uuid() {
    return Math.random().toString(16).slice(2, 8);
}

function byID(id) {
    return document.getElementById(id);
}

function on(element, eventNames, callback) {
    for (const eName of eventNames.split(" "))
        element.addEventListener(eName, callback);
}