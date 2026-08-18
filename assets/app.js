(() => {
  "use strict";

  const FALLBACK_GATEWAYS = ["192.168.1.1", "192.168.0.1", "192.168.8.1"];
  const DIRECTORY_PAGE_SIZE = 12;
  const state = {
    catalog: null,
    country: "",
    selection: null,
    directoryTab: "providers",
    directoryLimit: DIRECTORY_PAGE_SIZE,
    device: null,
    connectionType: "unknown"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const elements = {
    header: $("[data-site-header]"),
    mobileNav: $("#mobile-nav"),
    menuToggle: $("[data-menu-toggle]"),
    country: $("#country-select"),
    directoryCountry: $("#directory-country"),
    setupSearch: $("#setup-search"),
    clearSetupSearch: $("#clear-setup-search"),
    suggestions: $("#setup-suggestions"),
    setupHint: $("#setup-hint"),
    quickPicks: $("#quick-picks"),
    recommendation: $("#recommendation"),
    recommendationTitle: $("#recommendation-title"),
    recommendationCopy: $("#recommendation-copy"),
    matchBadge: $("#match-badge"),
    primaryRoute: $("#primary-route"),
    primaryRouteLabel: $("#primary-route-label"),
    alternativeRoutes: $("#alternative-routes"),
    localRouteNote: $("#local-route-note"),
    stepCount: $("#step-count"),
    progressBar: $("#progress-bar"),
    deviceValue: $("#device-value"),
    connectionValue: $("#connection-value"),
    regionValue: $("#region-value"),
    connectionNotice: $("#connection-notice"),
    catalogCount: $("#catalog-count"),
    directorySearch: $("#directory-search"),
    directoryGrid: $("#directory-grid"),
    directorySummary: $("#directory-summary"),
    directoryEmpty: $("#directory-empty"),
    showMore: $("#show-more"),
    deviceGuideTitle: $("#device-guide-title"),
    deviceGuideCopy: $("#device-guide-copy"),
    deviceGuideSteps: $("#device-guide-steps"),
    copyGuide: $("#copy-guide"),
    toast: $("#toast")
  };

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function initials(name) {
    return String(name)
      .split(/[\s&+!.-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  function countryName(code) {
    if (!code) return "Unknown region";
    if (code === "XK") return "Kosovo";
    try {
      const names = new Intl.DisplayNames([navigator.language || "en"], { type: "region" });
      return names.of(code) || code;
    } catch (_) {
      return code;
    }
  }

  function routeUrl(address) {
    if (/^https?:\/\//i.test(address)) return address;
    return `http://${address}`;
  }

  function isLocalRoute(url) {
    return /^http:\/\//i.test(url);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 2800);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').setAttribute("content", theme === "dark" ? "#070b14" : "#2563eb");
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem("sautilink-router-theme"); } catch (_) { /* storage can be unavailable */ }
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(saved || preferred);
    $("[data-theme-toggle]").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("sautilink-router-theme", next); } catch (_) { /* ignore */ }
    });
  }

  function initNavigation() {
    const updateHeader = () => elements.header.classList.toggle("is-scrolled", window.scrollY > 8);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });

    elements.menuToggle.addEventListener("click", () => {
      const willOpen = elements.mobileNav.hidden;
      elements.mobileNav.hidden = !willOpen;
      elements.menuToggle.setAttribute("aria-expanded", String(willOpen));
    });
    $$("a", elements.mobileNav).forEach((link) => link.addEventListener("click", () => {
      elements.mobileNav.hidden = true;
      elements.menuToggle.setAttribute("aria-expanded", "false");
    }));
  }

  function detectDevice() {
    const ua = navigator.userAgent || "";
    const platform = navigator.userAgentData?.platform || navigator.platform || "";
    const isIPad = /iPad/i.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const mobileHint = navigator.userAgentData?.mobile;
    let type = "Desktop";
    let os = "desktop";

    if (isIPad || /Tablet|Android(?!.*Mobile)/i.test(ua)) {
      type = "Tablet";
      os = isIPad ? "ios" : "android";
    } else if (mobileHint || /Mobi|Android|iPhone|iPod/i.test(ua)) {
      type = "Mobile";
      if (/iPhone|iPod/i.test(ua)) os = "ios";
      else if (/Android/i.test(ua)) os = "android";
      else os = "mobile";
    } else if (/Win/i.test(platform) || /Windows/i.test(ua)) {
      type = "Windows PC";
      os = "windows";
    } else if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) {
      type = "Mac";
      os = "macos";
    } else if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
      type = "Linux PC";
      os = "linux";
    }

    state.device = { type, os };
    elements.deviceValue.textContent = type;
    renderDeviceGuide();
  }

  function renderDeviceGuide() {
    const guides = {
      windows: {
        title: "Find the gateway on Windows",
        copy: "Windows calls your router address the Default Gateway.",
        steps: ["Open Command Prompt.", "Run ipconfig.", "Find Default Gateway under the active Wi-Fi adapter."]
      },
      macos: {
        title: "Find the gateway on macOS",
        copy: "macOS shows the address in the connected network's TCP/IP details.",
        steps: ["Open System Settings, then Network.", "Select Wi-Fi and choose Details.", "Open TCP/IP and look for Router."]
      },
      ios: {
        title: "Find the gateway on iPhone or iPad",
        copy: "iOS shows the router address beside the connected Wi-Fi network.",
        steps: ["Open Settings, then Wi-Fi.", "Tap the information button beside the connected network.", "Look for Router under IPv4 Address."]
      },
      android: {
        title: "Find the gateway on Android",
        copy: "Android labels the address Router or Gateway, depending on the device.",
        steps: ["Open Settings, then Wi-Fi or Internet.", "Open the connected network's details.", "Expand Advanced and look for Gateway or Router."]
      },
      linux: {
        title: "Find the gateway on Linux",
        copy: "Your active default route points to the router.",
        steps: ["Open a terminal.", "Run ip route.", "Read the address after default via."]
      },
      mobile: {
        title: "Find the gateway on your phone",
        copy: "Your Wi-Fi details show the router or gateway address.",
        steps: ["Open Wi-Fi settings.", "Open the connected network's details.", "Look for Router, Gateway, or Default gateway."]
      },
      desktop: {
        title: "Find your exact gateway",
        copy: "Your operating system can show the local address used by the network.",
        steps: ["Open network settings.", "Select the active Wi-Fi or Ethernet connection.", "Look for Router, Gateway, or Default gateway."]
      }
    };
    const guide = guides[state.device?.os] || guides.desktop;
    elements.deviceGuideTitle.textContent = guide.title;
    elements.deviceGuideCopy.textContent = guide.copy;
    elements.deviceGuideSteps.replaceChildren(...guide.steps.map((step) => {
      const item = document.createElement("li");
      item.textContent = step;
      return item;
    }));
  }

  function updateConnectionNotice(type) {
    const notice = elements.connectionNotice;
    notice.className = "notice";
    const title = $("strong", notice);
    const detail = $("p span", notice);

    if (!navigator.onLine) {
      state.connectionType = "offline";
      elements.connectionValue.textContent = "Offline";
      notice.classList.add("notice-danger");
      title.textContent = "You appear to be offline";
      detail.textContent = "Connect to your router's Wi-Fi before opening its setup page.";
      return;
    }

    const normalized = String(type || "").toLowerCase();
    state.connectionType = normalized || "unknown";
    if (normalized === "wifi" || normalized === "ethernet") {
      elements.connectionValue.textContent = normalized === "wifi" ? "Wi-Fi" : "Ethernet";
      notice.classList.add("notice-success");
      title.textContent = normalized === "wifi" ? "Wi-Fi connection confirmed" : "Ethernet connection confirmed";
      detail.textContent = "You can open a local router gateway from this device.";
    } else if (normalized === "cellular") {
      elements.connectionValue.textContent = "Mobile data";
      notice.classList.add("notice-warning");
      title.textContent = "Connect to the router's Wi-Fi";
      detail.textContent = "Mobile data usually cannot reach a local router gateway.";
    } else {
      elements.connectionValue.textContent = "Online · not shared";
      notice.classList.add("notice-neutral");
      title.textContent = "Wi-Fi status is not shared";
      detail.textContent = "Your browser keeps this private. Confirm that you joined the router's network.";
    }
  }

  function detectConnection() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    updateConnectionNotice(connection?.type);
    connection?.addEventListener?.("change", () => updateConnectionNotice(connection.type));
    window.addEventListener("online", () => updateConnectionNotice(connection?.type));
    window.addEventListener("offline", () => updateConnectionNotice(connection?.type));
  }

  function inferCountryFromLocale() {
    const locale = navigator.languages?.[0] || navigator.language || "";
    const match = locale.match(/[-_]([A-Za-z]{2})$/);
    return match ? match[1].toUpperCase() : "";
  }

  async function detectRegion() {
    let code = "";
    try {
      const response = await fetch("/api/context", { headers: { Accept: "application/json" }, cache: "no-store" });
      if (response.ok) {
        const context = await response.json();
        code = String(context.country || "").toUpperCase();
      }
    } catch (_) {
      // Static and offline previews fall back to the browser locale.
    }
    if (!state.catalog?.countryCodes.includes(code)) code = inferCountryFromLocale();
    if (!state.catalog?.countryCodes.includes(code)) code = "";

    state.country = code;
    elements.country.value = code;
    elements.directoryCountry.value = code;
    elements.regionValue.textContent = code ? countryName(code) : "Choose manually";
    renderQuickPicks();
    renderDirectory();
    updateProgress();
  }

  function createCountryOptions() {
    const options = state.catalog.countryCodes
      .map((code) => ({ code, name: countryName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const append = (select, firstLabel) => {
      const fragment = document.createDocumentFragment();
      const first = document.createElement("option");
      first.value = "";
      first.textContent = firstLabel;
      fragment.append(first);
      options.forEach(({ code, name }) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = name;
        fragment.append(option);
      });
      select.replaceChildren(fragment);
    };
    append(elements.country, "Select your country");
    append(elements.directoryCountry, "All countries");
  }

  function searchableItems(query = "") {
    const term = normalize(query);
    const providers = state.catalog.providers
      .filter((item) => !state.country || item.country === state.country)
      .map((item) => ({ ...item, type: "provider", search: normalize([item.name, ...(item.aliases || [])].join(" ")) }));
    const brands = state.catalog.brands
      .map((item) => ({ ...item, type: "brand", search: normalize([item.name, ...(item.aliases || [])].join(" ")) }));
    return [...providers, ...brands]
      .filter((item) => !term || item.search.includes(term))
      .sort((a, b) => {
        const aStart = normalize(a.name).startsWith(term) ? 0 : 1;
        const bStart = normalize(b.name).startsWith(term) ? 0 : 1;
        return aStart - bStart || (a.type === "provider" ? -1 : 1) || a.name.localeCompare(b.name);
      });
  }

  function renderSuggestions(query = "") {
    const items = searchableItems(query).slice(0, 9);
    elements.suggestions.replaceChildren();
    if (!items.length) {
      elements.suggestions.hidden = true;
      elements.setupSearch.setAttribute("aria-expanded", "false");
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-button";
      button.setAttribute("role", "option");
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      const subtitle = document.createElement("small");
      const type = document.createElement("small");
      title.textContent = item.name;
      subtitle.textContent = item.type === "provider" ? countryName(item.country) : item.note || "Router manufacturer";
      type.textContent = item.type;
      copy.append(title, subtitle);
      button.append(copy, type);
      button.addEventListener("click", () => selectItem(item));
      fragment.append(button);
    });
    elements.suggestions.append(fragment);
    elements.suggestions.hidden = false;
    elements.setupSearch.setAttribute("aria-expanded", "true");
  }

  function renderQuickPicks() {
    if (!state.catalog || state.selection) return;
    const regional = state.catalog.providers.filter((item) => item.country === state.country).slice(0, 5);
    const fallbackIds = ["tp-link", "huawei", "zte", "mikrotik", "netgear"];
    const picks = regional.length
      ? regional.map((item) => ({ ...item, type: "provider" }))
      : state.catalog.brands.filter((item) => fallbackIds.includes(item.id)).map((item) => ({ ...item, type: "brand" }));

    elements.quickPicks.replaceChildren(...picks.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-pick";
      button.textContent = item.name;
      button.addEventListener("click", () => selectItem(item));
      return button;
    }));
    elements.setupHint.textContent = regional.length
      ? `Suggested providers in ${countryName(state.country)}. Choose one or search your router brand.`
      : "No regional profile selected. Search the name printed on your router.";
  }

  function selectItem(item) {
    state.selection = item;
    elements.setupSearch.value = item.name;
    elements.clearSetupSearch.hidden = false;
    elements.suggestions.hidden = true;
    elements.setupSearch.setAttribute("aria-expanded", "false");
    elements.quickPicks.replaceChildren();
    renderRecommendation();
    updateProgress();
  }

  function clearSelection(focus = false) {
    state.selection = null;
    elements.setupSearch.value = "";
    elements.clearSetupSearch.hidden = true;
    elements.recommendation.hidden = true;
    renderQuickPicks();
    updateProgress();
    if (focus) elements.setupSearch.focus();
  }

  function makeRouteLink(address, label) {
    const link = document.createElement("a");
    link.href = routeUrl(address);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label || address;
    return link;
  }

  function renderRecommendation() {
    const item = state.selection;
    if (!item) return;

    const gateways = [...new Set(item.gateways?.length ? item.gateways : FALLBACK_GATEWAYS)];
    let primaryUrl = routeUrl(gateways[0]);
    let primaryLabel = `Open ${gateways[0]}`;
    let alternatives = gateways.slice(1);
    let copy = "Try this local address first while connected to your router's Wi-Fi.";
    let localNote = true;

    if (item.type === "provider") {
      elements.matchBadge.textContent = "Provider match";
      elements.recommendationTitle.textContent = `${item.name} setup recommendation`;
      copy = `Based on a ${countryName(item.country)} provider profile. The supplied router model can vary, so try the routes in order.`;
    } else {
      elements.matchBadge.textContent = "Brand match";
      elements.recommendationTitle.textContent = `${item.name} setup recommendation`;
      copy = item.note || "Use this route while connected to the router's local network.";
      if (["app", "cloud", "managed"].includes(item.mode) && item.supportUrl) {
        primaryUrl = item.supportUrl;
        primaryLabel = item.mode === "app" ? "Open official setup app" : item.mode === "managed" ? "Open official support" : "Open official management portal";
        alternatives = gateways;
        localNote = false;
      }
    }

    elements.recommendationCopy.textContent = copy;
    elements.primaryRoute.href = primaryUrl;
    elements.primaryRouteLabel.textContent = primaryLabel;
    elements.alternativeRoutes.replaceChildren();
    if (alternatives.length) {
      const label = document.createElement("span");
      label.className = "sr-only";
      label.textContent = "Alternative routes";
      elements.alternativeRoutes.append(label, ...alternatives.slice(0, 4).map((gateway) => makeRouteLink(gateway, gateway)));
    }
    elements.localRouteNote.textContent = localNote
      ? "Local gateway links open directly on your own network. SautiLink never receives your router login."
      : "This recommendation opens an official product page. Local alternatives, when available, remain between your browser and router.";
    elements.recommendation.hidden = false;
  }

  function updateProgress() {
    const step = state.selection ? 3 : state.country ? 2 : 1;
    elements.stepCount.textContent = `${step} of 3`;
    elements.progressBar.style.width = `${step * 33.34}%`;
  }

  function directoryItems() {
    const term = normalize(elements.directorySearch.value);
    if (state.directoryTab === "providers") {
      return state.catalog.providers
        .filter((item) => !elements.directoryCountry.value || item.country === elements.directoryCountry.value)
        .filter((item) => normalize([item.name, countryName(item.country), ...(item.aliases || [])].join(" ")).includes(term))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    if (state.directoryTab === "brands") {
      return state.catalog.brands
        .filter((item) => normalize([item.name, ...(item.aliases || [])].join(" ")).includes(term))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return state.catalog.gateways
      .filter((item) => normalize([item.address, item.label, ...(item.tags || [])].join(" ")).includes(term));
  }

  function renderDirectory() {
    if (!state.catalog) return;
    const allItems = directoryItems();
    const visible = allItems.slice(0, state.directoryLimit);
    elements.directoryGrid.replaceChildren();
    elements.directoryEmpty.hidden = allItems.length !== 0;
    elements.showMore.hidden = visible.length >= allItems.length;
    elements.directorySummary.textContent = `${allItems.length.toLocaleString()} ${state.directoryTab} found`;

    const fragment = document.createDocumentFragment();
    visible.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "directory-card";
      const top = document.createElement("span");
      top.className = "card-topline";
      const icon = document.createElement("span");
      icon.className = "directory-card-icon";
      const type = document.createElement("span");
      type.className = "directory-card-type";
      const title = document.createElement("strong");
      const subtitle = document.createElement("span");

      if (state.directoryTab === "providers") {
        icon.textContent = initials(item.name);
        type.textContent = "Provider";
        title.textContent = item.name;
        subtitle.textContent = countryName(item.country);
        card.addEventListener("click", () => chooseFromDirectory({ ...item, type: "provider" }));
      } else if (state.directoryTab === "brands") {
        icon.textContent = initials(item.name);
        type.textContent = item.mode === "browser" ? "Router" : item.mode;
        title.textContent = item.name;
        subtitle.textContent = item.mode === "browser" ? "Local gateway setup" : "Official setup route";
        card.addEventListener("click", () => chooseFromDirectory({ ...item, type: "brand" }));
      } else {
        icon.textContent = "IP";
        type.textContent = item.tags?.[0] || "Gateway";
        title.textContent = item.address;
        subtitle.textContent = item.label;
        card.addEventListener("click", () => window.open(routeUrl(item.address), "_blank", "noopener,noreferrer"));
      }

      top.append(icon, type);
      card.append(top, title, subtitle);
      fragment.append(card);
    });
    elements.directoryGrid.append(fragment);
  }

  function chooseFromDirectory(item) {
    if (item.type === "provider" && item.country) {
      state.country = item.country;
      elements.country.value = item.country;
      elements.regionValue.textContent = countryName(item.country);
    }
    selectItem(item);
    $("#setup").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function initDirectory() {
    $$('[data-directory-tab]').forEach((button) => button.addEventListener("click", () => {
      state.directoryTab = button.dataset.directoryTab;
      state.directoryLimit = DIRECTORY_PAGE_SIZE;
      $$('[data-directory-tab]').forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-selected", String(active));
      });
      const providers = state.directoryTab === "providers";
      $(".country-filter-wrap").hidden = !providers;
      renderDirectory();
    }));
    elements.directorySearch.addEventListener("input", () => {
      state.directoryLimit = DIRECTORY_PAGE_SIZE;
      renderDirectory();
    });
    elements.directoryCountry.addEventListener("change", () => {
      state.directoryLimit = DIRECTORY_PAGE_SIZE;
      renderDirectory();
    });
    elements.showMore.addEventListener("click", () => {
      state.directoryLimit += DIRECTORY_PAGE_SIZE;
      renderDirectory();
    });
  }

  function initAssistant() {
    elements.country.addEventListener("change", () => {
      state.country = elements.country.value;
      elements.regionValue.textContent = state.country ? countryName(state.country) : "Choose manually";
      elements.directoryCountry.value = state.country;
      clearSelection();
      renderDirectory();
    });
    elements.setupSearch.addEventListener("focus", () => renderSuggestions(elements.setupSearch.value));
    elements.setupSearch.addEventListener("input", () => {
      const query = elements.setupSearch.value;
      elements.clearSetupSearch.hidden = !query;
      if (state.selection && normalize(query) !== normalize(state.selection.name)) state.selection = null;
      renderSuggestions(query);
      updateProgress();
    });
    elements.clearSetupSearch.addEventListener("click", () => clearSelection(true));
    $("#change-selection").addEventListener("click", () => clearSelection(true));
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".field-group")) {
        elements.suggestions.hidden = true;
        elements.setupSearch.setAttribute("aria-expanded", "false");
      }
    });
    elements.primaryRoute.addEventListener("click", () => {
      if (isLocalRoute(elements.primaryRoute.href)) showToast("Opening a local route. Stay connected to your router.");
    });
  }

  function initCopyGuide() {
    elements.copyGuide.addEventListener("click", async () => {
      const steps = $$("li", elements.deviceGuideSteps).map((item, index) => `${index + 1}. ${item.textContent}`).join("\n");
      const text = `${elements.deviceGuideTitle.textContent}\n${steps}`;
      try {
        await navigator.clipboard.writeText(text);
        showToast("Gateway steps copied");
      } catch (_) {
        showToast("Copy is unavailable in this browser");
      }
    });
  }

  async function loadCatalog() {
    const response = await fetch("/assets/router-catalog.json");
    if (!response.ok) throw new Error("Catalog could not be loaded");
    state.catalog = await response.json();
    createCountryOptions();
    const total = state.catalog.providers.length + state.catalog.brands.length + state.catalog.gateways.length;
    elements.catalogCount.textContent = `${total.toLocaleString()}+`;
    renderQuickPicks();
    renderDirectory();
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* Core functionality does not depend on the worker. */ });
    }
  }

  async function init() {
    initTheme();
    initNavigation();
    detectDevice();
    detectConnection();
    initAssistant();
    initDirectory();
    initCopyGuide();
    registerServiceWorker();

    try {
      await loadCatalog();
      await detectRegion();
    } catch (_) {
      elements.directorySummary.textContent = "The catalog is temporarily unavailable. Common gateways remain available below.";
      elements.regionValue.textContent = "Choose manually";
      elements.setupHint.textContent = "Use a common gateway below or refresh to load personalized guidance.";
    }
  }

  init();
})();
