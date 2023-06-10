const AdmZip = require("adm-zip");
const {parseXML} = require("./xml");
const Roster = require("./9eRoster");

function extractRosterXML(rawData) {
    let zip;
    try {
        zip = new AdmZip(rawData);
    } catch (err) {
        return rawData;
    }

    const zipEntries = zip.getEntries();

    if (zipEntries.length !== 1) {
        throw new Error("Invalid Rosz file, it should have only 1 file in archive");
    }

    return zip.readAsText(zipEntries[0]);
}

module.exports.roszParse = (rawData) => {
    const xmlData = extractRosterXML(rawData);
    const result = parseXML(xmlData);
    return Roster.parse(result.roster.forces);
};