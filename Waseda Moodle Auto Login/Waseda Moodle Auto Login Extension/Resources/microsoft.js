(async function handleMicrosoftLogin() {
  "use strict";

  const core = globalThis.WasedaMoodleAutoLoginCore;
  const api = globalThis.browser;
  if (!core || !api?.storage?.local) return;

  const settings = await api.storage.local.get([
    core.STORAGE_KEYS.enabled,
    core.STORAGE_KEYS.userId,
    core.STORAGE_KEYS.password,
    core.STORAGE_KEYS.flowStartedAt,
  ]);

  if (!settings.enabled || !settings.userId || !settings.password) return;
  if (!core.isFlowActive(settings.flowStartedAt)) {
    await api.storage.local.remove(core.STORAGE_KEYS.flowStartedAt);
    return;
  }

  const tabFlowKey = "wasedaMoodleAutoLoginStartedAt";
  if (core.isWasedaSamlUrl(location.href)) {
    sessionStorage.setItem(tabFlowKey, String(settings.flowStartedAt));
  }
  if (!core.isFlowActive(sessionStorage.getItem(tabFlowKey))) return;

  const handledSteps = new Set();

  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isDisabled(element) {
    return (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) && element.disabled;
  }

  function scheduleClick(step, element, prepare) {
    if (!element || handledSteps.has(step) || isDisabled(element)) return;
    handledSteps.add(step);
    prepare?.();
    window.setTimeout(() => {
      if (document.contains(element) && !isDisabled(element)) {
        element.click();
      } else {
        handledSteps.delete(step);
      }
    }, 150);
  }

  function readPageState() {
    const accountTile = Array.from(document.querySelectorAll('[role="button"][data-test-id]')).find(
      (element) => element.getAttribute("data-test-id") === settings.userId,
    );
    return {
      accountTile,
      otherAccountTile: document.getElementById("otherTile"),
      passwordInput: document.querySelector('input[name="passwd"]'),
      loginInput: document.querySelector('input[name="login"]'),
      emailInput: document.querySelector('input[name="loginfmt"]'),
      submitButton: document.getElementById("idSIButton9"),
      kmsiForm: document.querySelector('form[action*="/kmsi"]'),
      kmsiBackButton: document.getElementById("idBtn_Back"),
    };
  }

  function proceed() {
    const state = readPageState();
    const step = core.classifyMicrosoftPage(state);

    if (step === "account") {
      scheduleClick(step, state.accountTile);
      return;
    }

    if (step === "password") {
      scheduleClick(step, state.submitButton, () => {
        if (state.loginInput) setInputValue(state.loginInput, settings.userId);
        if (state.emailInput) setInputValue(state.emailInput, settings.userId);
        setInputValue(state.passwordInput, settings.password);
      });
      return;
    }

    if (step === "email") {
      scheduleClick(step, state.submitButton, () => setInputValue(state.emailInput, settings.userId));
      return;
    }

    if (step === "otherAccount") {
      scheduleClick(step, state.otherAccountTile);
      return;
    }

    if (step === "kmsi") {
      api.storage.local.remove(core.STORAGE_KEYS.flowStartedAt);
      sessionStorage.removeItem(tabFlowKey);
      scheduleClick(step, state.kmsiBackButton);
    }
  }

  const observer = new MutationObserver(proceed);
  observer.observe(document, { attributes: true, childList: true, subtree: true });
  proceed();
})();
