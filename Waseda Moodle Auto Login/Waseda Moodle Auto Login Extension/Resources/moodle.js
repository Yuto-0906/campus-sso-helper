(async function handleMoodleLogin() {
  "use strict";

  const core = globalThis.WasedaMoodleAutoLoginCore;
  const api = globalThis.browser;
  if (!core || !api?.storage?.local) return;

  let settings;
  try { settings = await core.credentialRequest("status"); } catch (_) { return; }
  const { enabled, userId, hasPassword, flowStartedAt } = settings;
  if (!enabled || !userId || !hasPassword) return;

  const isLoginPage = location.pathname === "/login/index.php" || location.pathname === "/login/";
  if (isLoginPage) {
    if (core.isFlowActive(flowStartedAt)) return;
    await api.storage.local.set({ [core.STORAGE_KEYS.flowStartedAt]: Date.now() });
    location.replace(core.MOODLE_SAML_LOGIN_URL);
    return;
  }

  if (core.isFlowActive(flowStartedAt)) {
    await api.storage.local.remove(core.STORAGE_KEYS.flowStartedAt);
  }
})();
