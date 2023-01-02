const approvals = require("approvals");
const request = require("supertest");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const server = require("../service").server;

function getTestNameSafe() {
    return expect.getState().currentTestName
        .replaceAll(" ", "-")
        .replaceAll("/", "-");
}

test("getFormattedArmy", (done) => {
    const spy = jest.spyOn(crypto, "randomBytes").mockImplementation((size) => {
        return Buffer.alloc(size, "X")
    })

    const fileContent = fs.readFileSync(path.join(__dirname, "../samples", "sample-army.rosz"))
    request(server)
        .post("/getFormattedArmy")
        .send(fileContent)
        .expect(200)
        .then((response) => {
            const data = JSON.parse(response.text)
            approvals.verify(__dirname, getTestNameSafe(), JSON.stringify(data, null, 4))
            spy.mockRestore()
            done();
        })
        .catch(done);
});