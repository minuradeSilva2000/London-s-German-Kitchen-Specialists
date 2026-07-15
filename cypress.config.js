const { defineConfig } = require("cypress");
const path = require("path");

module.exports = defineConfig({
  allowCypressEnv: false,
  downloadsFolder: "cypress/downloads",

  e2e: {
    pageLoadTimeout: 180000,
    defaultCommandTimeout: 10000,
    setupNodeEvents(on, config) {
      on("before:browser:launch", (browser, launchOptions) => {
        if (browser.name === "electron") {
          launchOptions.preferences.automaticDownloads = true;
        }
        return launchOptions;
      });
    },
  },
});
