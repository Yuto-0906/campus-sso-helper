(async function initializePopup() {
  "use strict";

  const core = globalThis.WasedaMoodleAutoLoginCore;
  const api = globalThis.browser;
  const form = document.getElementById("settings-form");
  const enabledInput = document.getElementById("enabled");
  const userIdInput = document.getElementById("user-id");
  const status = document.getElementById("status");
  const openMoodleButton = document.getElementById("open-moodle");
  const clearSettingsButton = document.getElementById("clear-settings");

  if (!core || !api?.storage?.local) {
    status.textContent = "Safari拡張機能APIを利用できません。";
    status.classList.add("error");
    return;
  }

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  async function loadSettings() {
    await core.purgeLegacySecrets(api.storage.local);
    const settings = await api.storage.local.get([
      core.STORAGE_KEYS.enabled,
      core.STORAGE_KEYS.userId,
    ]);
    enabledInput.checked = Boolean(settings.enabled);
    userIdInput.value = settings.userId ?? "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const userId = userIdInput.value.trim();

    if (enabledInput.checked && !userId) {
      showStatus("メールアドレスを入力してください。", true);
      return;
    }

    await api.storage.local.set({
      [core.STORAGE_KEYS.enabled]: enabledInput.checked,
      [core.STORAGE_KEYS.userId]: userId,
    });
    showStatus("設定を保存しました。");
  });

  openMoodleButton.addEventListener("click", async () => {
    await api.tabs.create({ url: core.MOODLE_HOME_URL });
    window.close();
  });

  clearSettingsButton.addEventListener("click", async () => {
    await api.storage.local.remove([
      core.STORAGE_KEYS.enabled,
      core.STORAGE_KEYS.userId,
      core.STORAGE_KEYS.flowStartedAt,
    ]);
    enabledInput.checked = false;
    userIdInput.value = "";
    showStatus("保存データを削除しました。");
  });

  await loadSettings();
})();
