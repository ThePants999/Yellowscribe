const path = require("path");
const {roszParse} = require("../bin/roszParser");
const approvals = require("approvals");
const crypto = require("crypto");
const fs = require("fs");
const roszParser = require("../bin/Roster");
//const { default: test } = require("node:test");

function getTestNameSafe() {
    return expect.getState().currentTestName
        .replaceAll(" ", "-")
        .replaceAll("/", "-");
}

function performRosterTest(rosterFile) {
    var id = 0
    const spy = jest.spyOn(crypto, "randomBytes").mockImplementation((size) => {
        return Buffer.alloc(size, id++);
    });

    const fileContent = fs.readFileSync(path.join(__dirname, "../samples", rosterFile));

    const roster = roszParse(fileContent);

    approvals.verify(__dirname, getTestNameSafe(), roszParser.serialize(roster, 4))

    spy.mockRestore();
}

test("parse roster", () => {
    performRosterTest("sample-army.rosz");
});

test("celestine", () => {
    performRosterTest("adepta-sororitas-celestine.rosz");
});

test("tau commander", () => {
    performRosterTest("tau-commander.rosz");
});

test("vanguards", () => {
    performRosterTest("sample-sm-vanguard-vets.rosz");
});

test("sm bike squad", () => {
    performRosterTest("sample-sm-bike-squad.rosz");
});

test("blood angel librarian dreadnought", () => {
    performRosterTest("sample-sm-librarian-dreadnought.rosz");
});

test("grey knight land raider", () => {
    performRosterTest("sample-grey-knights-land-raider.rosz");
});

test("servitors", () => {
    performRosterTest("sample-servitors.rosz");
});

test("wound track monsters", () => {
    performRosterTest("sample-wound-track-monsters.ros");
});

test("hemlock", () => {
    performRosterTest("sample-hemlock.ros");
});

test("multi-model character units", () => {
    performRosterTest("sample-character-units.ros");
});

test("empty roster", () => {
    const fileContent = fs.readFileSync(path.join(__dirname, "../samples", "empty-roster.rosz"));
    const roster = roszParse(fileContent);
    expect(roster.units).toStrictEqual(new Map())
    expect(roster.order).toHaveLength(0)
})

test("uncompressed roster", () => {
    const fileContent = fs.readFileSync(path.join(__dirname, "../samples", "sample-army.ros"));
    const roster = roszParse(fileContent);
    expect(roster.units).toBeDefined()
    expect(roster.order).toBeDefined()
})