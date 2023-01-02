const {Builder, By, until} = require("selenium-webdriver");
const chrome = require('selenium-webdriver/chrome');
const path = require("path");
const service = require("../service");
const exp = require("constants");

jest.setTimeout(15000);

class YellowScribeMainPage {
   constructor(driver) {
      this.driver = driver
   }

   async start(server) {
      return this.driver.get(server)
   }

   async rosterUploadForm() {
      return this.driver.wait(until.elementLocated(By.id('rosterUpload')));
   }

   async uploadRoster(file) {
      return this.rosterUploadForm()
          .then(e => e.sendKeys(file));
   }

   async submitRoster() {
      const submitRoster = By.id('submit');

      const button = await this.driver.findElement(submitRoster)
      return this.driver.executeScript("arguments[0].scrollIntoView(true);", button)
          .then(() => this.driver.sleep(500))
          .then(() => button.click())
   }

   async getCode() {
      return this.driver.wait(until.elementLocated(By.id('codeContainer')))
          .then(codeInput => codeInput.getAttribute("value"))
   }
}


describe("browser tests", () => {

   beforeAll(() => {
      service.loadModules()
      service.server.listen(0);
   })

   afterAll(done => {
      service.server.close(done);
   })

   test("upload a roster should give a code", async () => {
      const filePath = path.join(__dirname, "../samples", "sample-army.rosz")

      let driver = await new Builder()
          .forBrowser('chrome')
          .setChromeOptions(new chrome.Options().headless())
          .build();

      const port = service.server.address().port

      const mainPage = new YellowScribeMainPage(driver)
      const code = await mainPage.start(`http://127.0.0.1:${port}`)
          .then(() => mainPage.uploadRoster((filePath)))
          .then(() => mainPage.submitRoster())
          .then(() => mainPage.getCode())

      expect(code).toStrictEqual(expect.stringMatching(/[a-z0-9]+/))

      await driver.get(`http://127.0.0.1:${port}/get_army_by_id?id=${code}`)
      const content = await driver.getPageSource()
      expect(content).toStrictEqual(expect.stringMatching("<html>.*</html>"))
   });
});