(async function handleMoodleLogin() {
  "use strict";

  const core = globalThis.WasedaMoodleAutoLoginCore;
  const api = globalThis.browser;
  if (!core || !api?.storage?.local) return;

  const { enabled, userId, password, flowStartedAt } = await api.storage.local.get([
    core.STORAGE_KEYS.enabled,
    core.STORAGE_KEYS.userId,
    core.STORAGE_KEYS.password,
    core.STORAGE_KEYS.flowStartedAt,
  ]);

  if (!enabled || !userId || !password) return;

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
