const AdmZip = require("adm-zip");
const {parseXML} = require("./xml");
const Roster = require("./Roster");

module.exports.roszParse = (rawData) => {
    const zip = new AdmZip(rawData);
    const zipEntries = zip.getEntries();

    if (zipEntries.length !== 1) {
        throw new Error("Invalid Rosz file, it should have only 1 file in archive");
    }

    const result = parseXML(zip.readAsText(zipEntries[0]));

    return Roster.parse(result.roster.forces);
};