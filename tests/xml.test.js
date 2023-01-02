const xml = require("../bin/xml");

test("parse xml with attributes", () => {
   const xmlData = "<foo><bar attr='someValue'>innerText</bar></foo>";

   const data = xml.parseXML(xmlData);

   expect(data).toStrictEqual({
       foo: {
           bar: [
               {
                   "$": {
                       attr:"someValue"
                   },
                   "_": "innerText"
               }
           ]
       }
   });
});

test("parse simple xml", () => {
    const xmlData = "<foo><bar></bar></foo>";

    const data = xml.parseXML(xmlData);

    expect(data).toStrictEqual({
        foo: { bar: [""] }
    });
});

test("parse single tag with attr", () => {
    const xmlData = '<foo value="2"/>';

    const data = xml.parseXML(xmlData);

    expect(data).toStrictEqual({
        foo: { "$": { value: "2"} }
    });
});
