(function initializeCore(root, factory) {
  const api = factory();
  root.WasedaMoodleAutoLoginCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis, function createCore() {
  "use strict";

  const WASEDA_TENANT_PATH = "/b3865172-9887-4b3a-89ff-95a35b92f4c3/saml2";
  const FLOW_TIMEOUT_MS = 2 * 60 * 1000;
  const STORAGE_KEYS = Object.freeze({
    enabled: "enabled",
    userId: "userId",
    password: "password",
    flowStartedAt: "flowStartedAt",
  });
  const MOODLE_HOME_URL = "https://wsdmoodle.waseda.jp/my/";
  const MOODLE_SAML_LOGIN_URL =
    "https://wsdmoodle.waseda.jp/auth/saml2/login.php?wants=https%3A%2F%2Fwsdmoodle.waseda.jp%2F&idp=fcc52c5d2e034b1803ea1932ae2678b0&passive=off";

  function isWasedaSamlUrl(href) {
    try {
      const url = new URL(href);
      return (
        url.hostname === "login.microsoftonline.com" &&
        url.pathname.toLowerCase() === WASEDA_TENANT_PATH &&
        url.searchParams.has("SAMLRequest") &&
        url.searchParams.has("RelayState")
      );
    } catch {
      return false;
    }
  }

  function isFlowActive(startedAt, now = Date.now()) {
    const timestamp = Number(startedAt);
    return Number.isFinite(timestamp) && timestamp > 0 && now - timestamp >= 0 && now - timestamp <= FLOW_TIMEOUT_MS;
  }

  function classifyMicrosoftPage(state) {
    if (state.accountTile) return "account";
    if (state.passwordInput && state.submitButton) return "password";
    if (state.emailInput && state.submitButton) return "email";
    if (state.otherAccountTile) return "otherAccount";
    if (state.kmsiForm && state.kmsiBackButton) return "kmsi";
    return null;
  }

  return Object.freeze({
    FLOW_TIMEOUT_MS,
    STORAGE_KEYS,
    MOODLE_HOME_URL,
    MOODLE_SAML_LOGIN_URL,
    classifyMicrosoftPage,
    isFlowActive,
    isWasedaSamlUrl,
  });
});
