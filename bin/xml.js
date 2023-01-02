const xml2js = require("xml2js");

module.exports.parseXML = (xmlData) => {
    var error = null;
    var data = null;
    xml2js.parseString(xmlData, (innerError, innerData) => {
        error = innerError;
        data = innerData;
    });

    if (error) {
        throw error;
    }

    if (!error && !data) {
        throw new Error("parseXML error, xml2js maybe async");
    }

    return data;
};