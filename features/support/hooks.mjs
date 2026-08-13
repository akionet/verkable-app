import { After, Before } from "@cucumber/cucumber";
import { chromium } from "playwright";

Before(async function () {
  this.browser = await chromium.launch({ headless: true });
  this.context = await this.browser.newContext();
  this.page = await this.context.newPage();
  this.pageErrors = [];
  this.page.on("pageerror", (error) => this.pageErrors.push(error.message));
});

After(async function () {
  await this.context?.close();
  await this.browser?.close();
});
