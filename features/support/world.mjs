import { setDefaultTimeout, setWorldConstructor } from "@cucumber/cucumber";

setDefaultTimeout(30_000);

class OperatorWorld {
  browser;
  context;
  page;
  expectedYaml = "";
  submittedBody;
}

setWorldConstructor(OperatorWorld);
