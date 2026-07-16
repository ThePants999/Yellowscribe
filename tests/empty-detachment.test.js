const fs = require("fs");
const path = require("path");
const {roszParse} = require("../bin/roszParser");

test("continues after an empty detachment", () => {
    const populatedRoster = fs.readFileSync(
        path.join(__dirname, "../samples/sample-hemlock.ros"),
        "utf8"
    );
    const rosterWithLeadingEmptyDetachment = populatedRoster.replace(
        "<forces>",
        '<forces><force id="empty-detachment" name="Empty Detachment" />'
    );

    const roster = roszParse(Buffer.from(rosterWithLeadingEmptyDetachment));

    expect([...roster.units.values()].map(unit => unit.name)).toStrictEqual([
        "Hemlock Wraithfighter"
    ]);
});
