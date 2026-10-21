(async function initializePopup() {
  "use strict";

  const core = globalThis.WasedaMoodleAutoLoginCore;
  const api = globalThis.browser;
  const form = document.getElementById("settings-form");
  const enabledInput = document.getElementById("enabled");
  const userIdInput = document.getElementById("user-id");
  const passwordInput = document.getElementById("password");
  const passwordNote = document.getElementById("password-note");
  const status = document.getElementById("status");
  const openMoodleButton = document.getElementById("open-moodle");
  const clearSettingsButton = document.getElementById("clear-settings");
  const clearTimetableButton = document.getElementById("clear-timetable");

  if (!core || !api?.storage?.local) {
    status.textContent = "Safari拡張機能APIを利用できません。";
    status.classList.add("error");
    return;
  }

  let hasPassword = false;

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  async function loadSettings() {
    const settings = await core.credentialRequest("status");
    enabledInput.checked = Boolean(settings.enabled);
    userIdInput.value = settings.userId ?? "";
    hasPassword = settings.hasPassword;
    passwordNote.textContent = hasPassword
      ? "パスワードは保存済みです。変更しない場合は空欄のまま保存できます。"
      : "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const userId = userIdInput.value.trim();
    const password = passwordInput.value;

    if (enabledInput.checked && (!userId || !password && !hasPassword)) {
      showStatus("メールアドレスとパスワードを入力してください。", true);
      return;
    }

    try {
      const saved = await core.credentialRequest("save", { enabled: enabledInput.checked, userId, password });
      hasPassword = saved.hasPassword;
      passwordInput.value = "";
      passwordNote.textContent = hasPassword ? "パスワードはKeychainに保存済みです。" : "";
      showStatus("設定を保存しました。");
    } catch (error) { showStatus(error.message, true); }
  });

  openMoodleButton.addEventListener("click", async () => {
    await api.tabs.create({ url: core.MOODLE_HOME_URL });
    window.close();
  });

  async function removeTimetableData() {
    const all = await api.storage.local.get(null);
    const keys = Object.keys(all).filter((key) => key.startsWith("csh-timetable-v1:"));
    if (keys.length) await api.storage.local.remove(keys);
  }

  clearTimetableButton.addEventListener("click", async () => {
    await removeTimetableData();
    showStatus("時間割データを削除しました。Moodleを再読み込みすると自動取得します。");
  });

  clearSettingsButton.addEventListener("click", async () => {
    try { await core.credentialRequest("clear"); }
    catch (error) { showStatus(error.message, true); return; }
    await removeTimetableData();
    enabledInput.checked = false;
    userIdInput.value = "";
    passwordInput.value = "";
    hasPassword = false;
    passwordNote.textContent = "";
    showStatus("資格情報と時間割データを削除しました。");
  });

  try { await loadSettings(); }
  catch (error) { showStatus(error.message, true); }
})();
