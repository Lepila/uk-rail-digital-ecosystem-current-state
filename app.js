const state = {
  data: null,
  mode: "overview",
  search: "",
  stage: "all",
  family: "all",
  organisation: "all",
  brand: "all",
  orgType: "all",
  audience: "all",
  propertyType: "all",
  transaction: "all",
  prevalence: "all",
  confidence: "all",
  validationOnly: false,
  showHandoffs: true,
  filtersOpen: false,
  highlightComplexity: false,
  showExceptions: false,
  controlsCollapsed: false,
  presentationMode: false,
  zoom: 0.8,
  focusType: null,
  focusValue: null,
  sortOfferings: "Provider type",
  expandedCapabilities: new Set(),
  collapsedFamilies: new Set(),
  collapsedStages: new Set(),
  exportingSnapshot: false,
};

const app = document.querySelector("#app");
const panel = document.querySelector("#evidence-panel");
const sourcePill = document.querySelector("#source-pill");

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const missing = (value) => value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
const compact = (value, fallback = "Not captured in audit") => (missing(value) ? fallback : value);
const unique = (items) => [...new Set(items.filter((item) => !missing(item)))];
const slug = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const textForSearch = (item) => JSON.stringify(item ?? "").toLowerCase();
const matchesSearch = (item) => !state.search || textForSearch(item).includes(state.search.toLowerCase());
const zoomLevels = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5];

let indexes = {};

function rebuildIndexes() {
  indexes = {
    properties: Object.fromEntries(state.data.digitalProperties.map((item) => [item.id, item])),
    capabilities: Object.fromEntries(state.data.capabilities.map((item) => [item.id, item])),
    needs: Object.fromEntries(state.data.passengerNeeds.map((item) => [item.id, item])),
    families: Object.fromEntries(state.data.serviceFamilies.map((item) => [item.id, item])),
    handoffs: Object.fromEntries(state.data.externalHandoffs.map((item) => [item.id, item])),
  };
}

function setupControls() {
  const data = state.data;
  const organisations = unique(data.organisations.map((item) => item.organisation)).sort();
  const brands = unique(data.brands.map((item) => item.brandService)).sort();
  const orgTypes = unique(data.organisations.map((item) => item.organisationType)).sort();
  const audiences = unique(data.digitalProperties.map((item) => item.audienceType)).sort();
  const propertyTypes = unique(data.digitalProperties.map((item) => item["Website type"])).sort();
  const transactions = unique(data.digitalProperties.map((item) => item.transactionType).concat(data.capabilities.map((item) => item.transactionType))).sort();
  const prevalences = unique(data.capabilities.map((item) => item.classification)).sort();
  const confidence = unique(data.digitalProperties.map((item) => item.statusState).concat(data.capabilities.map((item) => item.statusState))).sort();

  document.querySelector(".nav").innerHTML = `
    <div class="view-switcher" role="tablist" aria-label="View level">
      <span>View</span>
      <button class="nav-button active" data-mode="overview" role="tab" aria-selected="true">Overview</button>
      <button class="nav-button" data-mode="explore" role="tab" aria-selected="false">Explore</button>
      <button class="nav-button" data-mode="full" role="tab" aria-selected="false">Full landscape</button>
    </div>
    ${renderZoomControls("nav-zoom")}
    <button class="nav-button compact-search" id="quick-search">Search</button>
    <button class="nav-button" id="toggle-presentation" aria-pressed="false">Presentation view</button>
    <button class="nav-button" id="toggle-controls" aria-expanded="true">Collapse controls</button>
    <span id="export-status" class="export-status" aria-live="polite"></span>
  `;

  document.querySelector(".filters").innerHTML = `
    <div class="search-shell">
      <label>
        <span>Search the landscape</span>
        <input id="filter-search" type="search" placeholder="LNER, parking, Sherpr, Wi-Fi, Delay Repay, business" aria-describedby="search-count" />
      </label>
      <span id="search-count" class="filter-count" aria-live="polite">No search active</span>
    </div>
    <button class="small-button" id="toggle-filters" aria-expanded="false" aria-controls="filter-drawer">Filters</button>
    <button class="small-button" id="toggle-complexity" aria-pressed="false">Highlight complexity</button>
    <button class="small-button" id="toggle-exceptions" aria-pressed="false">Show exceptions</button>
    <label class="toggle compact-toggle">
      <input id="filter-handoffs" type="checkbox" checked />
      <span>Hand-offs</span>
    </label>
    <button class="small-button" data-export="current">Export current view as PDF</button>
    <button class="small-button" data-export="full">Export full landscape as PDF</button>
    <button class="small-button reset-button" id="reset-filters">Reset</button>
    <div id="active-filters" class="active-filters" aria-live="polite"></div>
    <div id="filter-drawer" class="filter-drawer" hidden>
      ${selectControl("filter-stage", "Journey stage", data.journeyStages.map((item) => item.stage), "All stages")}
      ${selectControl("filter-family", "Service family", data.serviceFamilies.map((item) => item.name), "All families")}
      ${selectControl("filter-organisation", "Organisation", organisations, "All organisations")}
      ${selectControl("filter-brand", "Brand / service", brands, "All brand/service labels")}
      ${selectControl("filter-org-type", "Provider type", orgTypes, "All provider types")}
      ${selectControl("filter-audience", "Audience", audiences, "All audiences")}
      ${selectControl("filter-property-type", "Property type", propertyTypes, "All property types")}
      ${selectControl("filter-transaction", "Transactional", transactions, "All transaction states")}
      ${selectControl("filter-prevalence", "Prevalence", prevalences, "All prevalence")}
      ${selectControl("filter-confidence", "Verification", confidence, "All evidence states")}
      ${sortControl("filter-sort", "Sort expanded services", ["Provider type", "Organisation", "Service type", "Confidence"])}
      <label class="toggle">
        <input id="filter-validation" type="checkbox" />
        <span>Show SME validation items</span>
      </label>
    </div>
  `;

  document.querySelector(".nav").addEventListener("click", async (event) => {
    const modeButton = event.target.closest("[data-mode]");
    if (modeButton) {
      state.mode = modeButton.dataset.mode;
      syncModeButtons();
      render();
      return;
    }
    const zoomButton = event.target.closest("[data-zoom]");
    if (zoomButton) {
      handleZoomAction(zoomButton.dataset.zoom);
      return;
    }
    const presentationButton = event.target.closest("#toggle-presentation");
    if (presentationButton) {
      state.presentationMode = !state.presentationMode;
      syncControls();
      render();
      return;
    }
    const quickSearchButton = event.target.closest("#quick-search");
    if (quickSearchButton) {
      state.controlsCollapsed = false;
      state.presentationMode = false;
      syncControls();
      requestAnimationFrame(() => document.querySelector("#filter-search")?.focus());
      return;
    }
    const controlsButton = event.target.closest("#toggle-controls");
    if (controlsButton) {
      state.controlsCollapsed = !state.controlsCollapsed;
      syncControls();
      return;
    }
  });

  bindInput("filter-search", "input", (event) => {
    state.search = event.target.value.trim();
  });
  bindSelect("filter-stage", "stage");
  bindSelect("filter-family", "family");
  bindSelect("filter-organisation", "organisation");
  bindSelect("filter-brand", "brand");
  bindSelect("filter-org-type", "orgType");
  bindSelect("filter-audience", "audience");
  bindSelect("filter-property-type", "propertyType");
  bindSelect("filter-transaction", "transaction");
  bindSelect("filter-prevalence", "prevalence");
  bindSelect("filter-confidence", "confidence");
  bindInput("filter-validation", "change", (event) => {
    state.validationOnly = event.target.checked;
  });
  bindInput("filter-handoffs", "change", (event) => {
    state.showHandoffs = event.target.checked;
  });
  bindSelect("filter-sort", "sortOfferings");
  document.querySelector("#toggle-filters").addEventListener("click", () => {
    state.filtersOpen = !state.filtersOpen;
    syncControls();
  });
  document.querySelector("#toggle-complexity").addEventListener("click", () => {
    state.highlightComplexity = !state.highlightComplexity;
    syncControls();
    render();
  });
  document.querySelector("#toggle-exceptions").addEventListener("click", () => {
    state.showExceptions = !state.showExceptions;
    syncControls();
    render();
  });
  document.querySelector("#reset-filters").addEventListener("click", () => {
    resetFilters();
    syncControls();
    render();
  });
  document.querySelector(".filters").addEventListener("click", (event) => {
    const exportButton = event.target.closest("[data-export]");
    if (exportButton) {
      exportPdf(exportButton.dataset.export);
      return;
    }
    const chipButton = event.target.closest("[data-clear-filter]");
    if (!chipButton) return;
    const key = chipButton.dataset.clearFilter;
    if (key === "all") resetFilters();
    else if (key === "focus") clearFocus();
    else if (key === "search") state.search = "";
    else if (key === "validationOnly" || key === "highlightComplexity" || key === "showExceptions") state[key] = false;
    else state[key] = "all";
    syncControls();
    render();
  });
  syncControls();
}

function bindSelect(id, stateKey) {
  bindInput(id, "change", (event) => {
    state[stateKey] = event.target.value;
  });
}

function bindInput(id, eventName, update) {
  document.querySelector(`#${id}`).addEventListener(eventName, (event) => {
    update(event);
    syncControls();
    render();
  });
}

function syncControls() {
  syncBodyState();
  const setValue = (id, value) => {
    const node = document.querySelector(`#${id}`);
    if (node) node.value = value;
  };
  setValue("filter-search", state.search);
  setValue("filter-stage", state.stage);
  setValue("filter-family", state.family);
  setValue("filter-organisation", state.organisation);
  setValue("filter-brand", state.brand);
  setValue("filter-org-type", state.orgType);
  setValue("filter-audience", state.audience);
  setValue("filter-property-type", state.propertyType);
  setValue("filter-transaction", state.transaction);
  setValue("filter-prevalence", state.prevalence);
  setValue("filter-confidence", state.confidence);
  setValue("filter-sort", state.sortOfferings);
  const validation = document.querySelector("#filter-validation");
  if (validation) validation.checked = state.validationOnly;
  const handoffs = document.querySelector("#filter-handoffs");
  if (handoffs) handoffs.checked = state.showHandoffs;
  const drawer = document.querySelector("#filter-drawer");
  if (drawer) drawer.hidden = !state.filtersOpen;
  const filtersButton = document.querySelector("#toggle-filters");
  if (filtersButton) {
    filtersButton.setAttribute("aria-expanded", String(state.filtersOpen));
    filtersButton.classList.toggle("active", state.filtersOpen || activeFilterCount() > 0);
    filtersButton.textContent = `Filters (${activeFilterCount()})`;
  }
  const complexityButton = document.querySelector("#toggle-complexity");
  if (complexityButton) {
    complexityButton.classList.toggle("active", state.highlightComplexity);
    complexityButton.setAttribute("aria-pressed", String(state.highlightComplexity));
  }
  const exceptionsButton = document.querySelector("#toggle-exceptions");
  if (exceptionsButton) {
    exceptionsButton.classList.toggle("active", state.showExceptions);
    exceptionsButton.setAttribute("aria-pressed", String(state.showExceptions));
  }
  const searchCount = document.querySelector("#search-count");
  if (searchCount) {
    const matches = searchMatchCount();
    searchCount.textContent = matches === null ? "No search active" : `${matches} matching records`;
  }
  const activeFilters = document.querySelector("#active-filters");
  if (activeFilters) activeFilters.innerHTML = renderActiveFilters();
  document.querySelectorAll(".zoom-value").forEach((node) => {
    node.textContent = `${Math.round(state.zoom * 100)}%`;
  });
  const presentationButton = document.querySelector("#toggle-presentation");
  if (presentationButton) {
    presentationButton.classList.toggle("active", state.presentationMode);
    presentationButton.setAttribute("aria-pressed", String(state.presentationMode));
    presentationButton.textContent = state.presentationMode ? "Exit presentation" : "Presentation view";
  }
  const controlsButton = document.querySelector("#toggle-controls");
  if (controlsButton) {
    controlsButton.setAttribute("aria-expanded", String(!state.controlsCollapsed));
    controlsButton.textContent = state.controlsCollapsed ? "Expand controls" : "Collapse controls";
  }
  syncModeButtons();
}

function syncBodyState() {
  document.body.classList.toggle("controls-collapsed", state.controlsCollapsed);
  document.body.classList.toggle("presentation-mode", state.presentationMode);
  document.body.classList.toggle("mode-overview", state.mode === "overview");
  document.body.classList.toggle("mode-explore", state.mode === "explore");
  document.body.classList.toggle("mode-full", state.mode === "full");
}

function resetFilters() {
  Object.assign(state, {
    search: "",
    stage: "all",
    family: "all",
    organisation: "all",
    brand: "all",
    orgType: "all",
    audience: "all",
    propertyType: "all",
    transaction: "all",
    prevalence: "all",
    confidence: "all",
    validationOnly: false,
    showHandoffs: true,
    highlightComplexity: false,
    showExceptions: false,
    focusType: null,
    focusValue: null,
  });
}

function clearFocus() {
  state.focusType = null;
  state.focusValue = null;
  state.stage = "all";
}

function syncModeButtons() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-selected", String(active));
  });
}

function activeFilterCount() {
  return [
    state.stage,
    state.family,
    state.organisation,
    state.brand,
    state.orgType,
    state.audience,
    state.propertyType,
    state.transaction,
    state.prevalence,
    state.confidence,
  ].filter((value) => value !== "all").length + Number(Boolean(state.search)) + Number(state.validationOnly) + Number(state.highlightComplexity) + Number(state.showExceptions) + Number(Boolean(state.focusType));
}

function renderActiveFilters() {
  const chips = [];
  const add = (key, label, value = state[key]) => {
    if (value && value !== "all") chips.push(`<button class="active-filter-chip" data-clear-filter="${esc(key)}">${esc(label)}: ${esc(value)} ×</button>`);
  };
  if (state.search) chips.push(`<button class="active-filter-chip" data-clear-filter="search">Search: ${esc(state.search)} ×</button>`);
  add("stage", "Stage");
  add("family", "Family");
  add("organisation", "Organisation");
  add("brand", "Brand/service");
  add("orgType", "Provider");
  add("audience", "Audience");
  add("propertyType", "Property type");
  add("transaction", "Transactional");
  add("prevalence", "Prevalence");
  add("confidence", "Evidence");
  if (state.validationOnly) chips.push(`<button class="active-filter-chip verify" data-clear-filter="validationOnly">SME validation ×</button>`);
  if (state.highlightComplexity) chips.push(`<button class="active-filter-chip" data-clear-filter="highlightComplexity">Complexity highlighted ×</button>`);
  if (state.showExceptions) chips.push(`<button class="active-filter-chip" data-clear-filter="showExceptions">Exceptions only ×</button>`);
  if (state.focusType) chips.push(`<button class="active-filter-chip" data-clear-filter="focus">Focus: ${esc(focusLabel())} ×</button>`);
  if (!chips.length) return "";
  return `${chips.join("")}<button class="active-filter-chip clear" data-clear-filter="all">Clear all</button>`;
}

function selectControl(id, label, values, allLabel) {
  return `
    <label>
      <span>${esc(label)}</span>
      <select id="${esc(id)}">
        <option value="all">${esc(allLabel)}</option>
        ${values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}
      </select>
    </label>
  `;
}

function sortControl(id, label, values) {
  return `
    <label>
      <span>${esc(label)}</span>
      <select id="${esc(id)}">
        ${values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderZoomControls(extraClass = "") {
  return `
    <div class="zoom-controls ${esc(extraClass)}" aria-label="Landscape zoom controls">
      <button class="small-button" data-zoom="out" aria-label="Zoom out">−</button>
      <span class="zoom-value" aria-live="polite">${Math.round(state.zoom * 100)}%</span>
      <button class="small-button" data-zoom="in" aria-label="Zoom in">+</button>
      <button class="small-button" data-zoom="fit">Fit</button>
      <button class="small-button" data-zoom="reset">Reset</button>
    </div>
  `;
}

function handleZoomAction(action) {
  if (action === "fit") {
    fitJourney();
    return;
  }
  if (action === "reset") {
    setLandscapeZoom(1);
    return;
  }
  const currentIndex = zoomLevels.reduce((best, level, index) => Math.abs(level - state.zoom) < Math.abs(zoomLevels[best] - state.zoom) ? index : best, 0);
  const nextIndex = action === "in" ? Math.min(zoomLevels.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
  setLandscapeZoom(zoomLevels[nextIndex]);
}

function fitJourney() {
  const shell = document.querySelector(".view-shell");
  const width = shell?.clientWidth || window.innerWidth;
  const baseWidth = landscapeBaseWidth();
  const chromeBuffer = 24;
  const target = (width - chromeBuffer) / baseWidth;
  setLandscapeZoom(target);
}

function setLandscapeZoom(nextZoom) {
  const scroller = document.querySelector("#matrix-scroll");
  const oldZoom = state.zoom || 1;
  const centerX = scroller ? (scroller.scrollLeft + scroller.clientWidth / 2) / oldZoom : null;
  const centerY = scroller ? (scroller.scrollTop + scroller.clientHeight / 2) / oldZoom : null;
  state.zoom = clampZoom(nextZoom);
  syncControls();
  render();
  requestAnimationFrame(() => {
    updateZoomFrame();
    const nextScroller = document.querySelector("#matrix-scroll");
    if (!nextScroller || centerX === null || centerY === null) return;
    nextScroller.scrollLeft = Math.max(0, centerX * state.zoom - nextScroller.clientWidth / 2);
    nextScroller.scrollTop = Math.max(0, centerY * state.zoom - nextScroller.clientHeight / 2);
  });
}

function clampZoom(value) {
  return Math.min(1.5, Math.max(0.5, Number(value) || 1));
}

function landscapeStageWidth(stage) {
  if (state.collapsedStages.has(stage.stage)) return 76;
  if (state.mode === "overview") return 220;
  if (state.mode === "full") return 320;
  return 280;
}

function landscapeFamilyWidth() {
  return state.mode === "overview" ? 210 : 240;
}

function landscapeBaseWidth() {
  return landscapeFamilyWidth() + state.data.journeyStages.reduce((total, stage) => total + landscapeStageWidth(stage), 0) + state.data.journeyStages.length * 6;
}

function updateZoomFrame() {
  const canvas = document.querySelector(".landscape-canvas");
  const frame = document.querySelector(".landscape-frame");
  if (!canvas || !frame) return;
  frame.style.width = `${Math.ceil(canvas.scrollWidth * state.zoom)}px`;
  frame.style.height = `${Math.ceil(canvas.scrollHeight * state.zoom)}px`;
}

function render() {
  syncBodyState();
  const matches = searchMatchCount();
  app.innerHTML = `
    <section id="landscape-export-root" class="map-page mode-${esc(state.mode)} ${state.mode === "full" ? "is-full" : ""} ${state.highlightComplexity ? "highlight-complexity" : ""} ${state.showExceptions ? "exceptions-only" : ""}">
      <div class="map-title">
        <div>
          <p class="eyebrow">AS-IS service landscape map</p>
          <h2>UK Rail Digital Landscape — Current State</h2>
          <p>This map represents the best evidenced current-state view of UK rail's passenger-facing digital ecosystem captured in the audit.</p>
        </div>
        <div class="mode-badge">${esc(modeLabel())}</div>
      </div>
      ${renderSummary(matches)}
      ${renderStrategicSignals()}
      ${renderStageNavigator()}
      ${renderFocusNotice()}
      ${renderLandscapeMatrix()}
      ${renderLegend()}
      ${renderCoverageNotice()}
      ${state.showHandoffs && state.mode !== "overview" ? renderHandoffs() : ""}
      ${renderAuditLayer()}
      <footer class="export-footer">
        UK Rail Digital Landscape — Current State · Audit date ${esc(state.data.meta.auditDate)} · Source: expanded current-state web audit · Unverified items explicitly marked
      </footer>
    </section>
  `;
  requestAnimationFrame(updateZoomFrame);
}

function modeLabel() {
  return {
    overview: "Level 1 overview",
    explore: "Level 2 explore",
    full: "Level 3 full landscape",
  }[state.mode];
}

function searchMatchCount() {
  if (!state.search) return null;
  const all = [
    ...state.data.digitalProperties,
    ...state.data.capabilities,
    ...state.data.passengerNeeds,
    ...state.data.organisations,
    ...state.data.externalHandoffs,
    ...state.data.evidenceGaps,
  ];
  return all.filter(matchesSearch).length;
}

function renderSummary(matches) {
  const metrics = state.data.metrics;
  return `
    <div class="map-summary">
      ${metric("organisations", metrics.organisations)}
      ${metric("brand / service labels", metrics.brands)}
      ${metric("digital properties", metrics.digitalProperties)}
      ${metric("capabilities", metrics.capabilities)}
      ${metric("specialist / microsite services", metrics.specialistMicrositeServices)}
      ${metric("third-party hand-offs", metrics.thirdPartyHandoffs)}
      ${metric("items requiring validation", metrics.itemsRequiringValidation)}
    </div>
    <div class="search-readout">${matches === null ? "What am I looking at? Digital offerings are grouped by passenger journey stage and service family; expand any capability to see the individual websites and services behind it." : `${matches} matching records highlighted for "${esc(state.search)}".`}</div>
  `;
}

function metric(label, value) {
  return `<div class="map-metric"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
}

function renderStrategicSignals() {
  const signals = strategicSignals();
  return `
    <section class="signals-strip" aria-label="Current-state signals">
      <div>
        <p class="eyebrow">Current-state signals</p>
        <p>Evidence flags, not recommendations.</p>
      </div>
      ${signals
        .map(
          (signal) => `
            <button class="signal-card ${signal.className || ""}" data-signal="${esc(signal.id)}">
              <b>${esc(signal.count)}</b>
              <span>${esc(signal.label)}</span>
            </button>
          `,
        )
        .join("")}
    </section>
  `;
}

function strategicSignals() {
  const capabilities = state.data.capabilities;
  const externalProperties = state.data.digitalProperties.filter((property) => typeClassFor(property.organisationType) === "third").length;
  const specialistCapabilities = capabilities.filter((capability) => capabilityIsException(capability)).length;
  const complexCapabilities = capabilities.filter((capability) => capabilityIsComplex(capability)).length;
  return [
    { id: "complexity", label: "capabilities with concentrated complexity", count: complexCapabilities },
    { id: "handoffs", label: "explicit digital hand-offs", count: state.data.metrics.thirdPartyHandoffs, className: "handoff-chip" },
    { id: "exceptions", label: "specialist or unusual capabilities", count: specialistCapabilities, className: "specialist" },
    { id: "external", label: "external-provider digital properties", count: externalProperties, className: "third" },
    { id: "validation", label: "items requiring SME validation", count: state.data.metrics.itemsRequiringValidation, className: "verify" },
  ];
}

function renderStageNavigator() {
  return `
    <nav class="stage-nav no-export" aria-label="Passenger journey stages">
      <button class="stage-button ${state.stage === "all" ? "active" : ""}" data-focus-stage="all" aria-pressed="${state.stage === "all"}">Show all journey stages</button>
      ${state.data.journeyStages
        .map((stage) => {
          const active = state.stage === stage.stage;
          return `<button class="stage-button ${active ? "active" : ""}" data-focus-stage="${esc(stage.stage)}" aria-pressed="${active}">${esc(stage.shortLabel)}</button>`;
        })
        .join("")}
    </nav>
  `;
}

function renderFocusNotice() {
  if (!state.focusType && state.stage === "all" && !state.showExceptions && !state.highlightComplexity) return "";
  return `
    <div class="focus-strip">
      <span>${esc(focusLabel())}</span>
      <button class="small-button no-export" data-return-landscape>Return to full landscape</button>
    </div>
  `;
}

function focusLabel() {
  if (state.focusType === "capability") return indexes.capabilities[state.focusValue]?.capability || "selected capability";
  if (state.stage !== "all") return state.stage;
  if (state.showExceptions) return "showing exceptions";
  if (state.highlightComplexity) return "complexity highlighted";
  return "full landscape";
}

function renderLegend() {
  return `
    <div class="legend">
      <div><b>Provider type</b>${chip("National Rail / national service", "national")}${chip("TOC", "toc")}${chip("Industry / shared", "industry")}${chip("External / third-party", "third")}${chip("Specialist", "specialist")}</div>
      <div><b>Evidence state</b>${chip("Verified", "verified")}${chip("Partially verified", "partial")}${chip("SME validation required", "verify")}${chip("Not found in audit", "not-found")}</div>
      <div><b>Prevalence</b>${chip("Universal / near-universal")}${chip("Common")}${chip("Specialist")}${chip("Unique")}</div>
      <div><b>Hand-off</b><span class="handoff-mark">↳</span> Cross-domain / cross-organisation transition</div>
    </div>
  `;
}

function renderCoverageNotice() {
  const c = state.data.coverage;
  return `
    <div class="coverage-strip">
      <b>Coverage test:</b>
      Digital properties ${esc(c.digitalProperties.represented)}/${esc(c.digitalProperties.excel)} represented, unmapped ${esc(c.digitalProperties.unmapped)}.
      Capabilities ${esc(c.capabilities.represented)}/${esc(c.capabilities.excel)} represented, unmapped ${esc(c.capabilities.unmapped)}.
      ${esc(c.digitalProperties.withoutJourneyMapping)} digital properties have no explicit journey-stage relationship in the workbook and remain available in the audit layer.
    </div>
  `;
}

function chip(label, className = "") {
  return `<span class="chip ${esc(className)}">${esc(compact(label))}</span>`;
}

function formatDate(value) {
  if (!value) return "date not captured";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function renderLandscapeMatrix() {
  const stages = state.data.journeyStages;
  const families = state.data.serviceFamilies.filter((family) => state.family === "all" || family.name === state.family);
  const columns = `${landscapeFamilyWidth()}px ${stages.map((stage) => `${landscapeStageWidth(stage)}px`).join(" ")}`;
  return `
    <section class="landscape-section">
      <div class="landscape-toolbar no-export">
        <div>
          <p class="eyebrow">Primary visual</p>
          <h3>Passenger journey × service family landscape</h3>
        </div>
        <div class="toolbar-actions">
          ${renderZoomControls("map-zoom")}
          <button class="small-button" data-collapse-all>Collapse all</button>
          <button class="small-button" data-expand-relevant>${state.mode === "full" ? "Expand all" : "Expand relevant"}</button>
        </div>
      </div>
      <div class="matrix-scroll" id="matrix-scroll">
        <div class="landscape-frame">
          <div class="landscape-canvas" style="--landscape-zoom:${state.zoom}">
            <div class="landscape-grid" style="grid-template-columns: ${columns} !important">
              <div class="corner-cell">Service family</div>
              ${stages.map(renderStageHeader).join("")}
              ${families.map((family) => renderFamilyRow(family, stages)).join("")}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderStageHeader(stage) {
  const number = stage.stage.match(/^\d+/)?.[0] || "";
  const muted = state.stage !== "all" && state.stage !== stage.stage ? "is-stage-muted" : "";
  const collapsed = state.collapsedStages.has(stage.stage);
  return `
    <div class="matrix-stage-head ${muted} ${collapsed ? "is-collapsed-stage" : ""}">
      <button class="collapse-button no-export" data-toggle-stage="${esc(stage.stage)}" aria-expanded="${!collapsed}" aria-label="${collapsed ? "Expand" : "Collapse"} ${esc(stage.shortLabel)}">${collapsed ? "›" : "▾"}</button>
      <span>${esc(number)}</span>
      <b>${esc(stage.shortLabel)}</b>
      ${collapsed ? "" : `<p>${esc(stage.outcome)}</p>`}
    </div>
  `;
}

function renderFamilyRow(family, stages) {
  const filteredCaps = family.capabilityIds.map((id) => indexes.capabilities[id]).filter(Boolean).filter(capabilityPassesBaseFilters);
  if (state.mode !== "full" && state.family === "all" && !filteredCaps.length && !state.search) return "";
  const stats = familyStats(family, filteredCaps);
  const collapsed = state.collapsedFamilies.has(family.name);
  return `
    <div class="family-label ${collapsed ? "is-collapsed-family" : ""}">
      <button class="collapse-button no-export" data-toggle-family="${esc(family.name)}" aria-expanded="${!collapsed}" aria-label="${collapsed ? "Expand" : "Collapse"} ${esc(family.name)}">${collapsed ? "›" : "▾"}</button>
      <b>${esc(family.name)}</b>
      <span>${esc(filteredCaps.length)} capabilities · ${esc(stats.offerings)} offerings · ${esc(stats.complex)} complexity signals</span>
    </div>
    ${stages.map((stage) => renderLandscapeCell(family, stage, collapsed)).join("")}
  `;
}

function renderLandscapeCell(family, stage, familyCollapsed = false) {
  const cell = state.data.landscapeMatrix.find((item) => item.family === family.name && item.stage === stage.stage);
  const caps = (cell?.capabilityIds || [])
    .map((id) => indexes.capabilities[id])
    .filter(Boolean)
    .filter(capabilityPassesBaseFilters)
    .filter(capabilityPassesPropertyFilters)
    .sort(sortCapabilitiesForView);
  const cellSearchMatch = matchesSearch(cell) || caps.some((capability) => matchesSearch(capability) || offeringLinks(capability).some(matchesSearch));
  const searchDim = state.search && !cellSearchMatch ? "is-dimmed" : "";
  const stageMuted = state.stage !== "all" && state.stage !== stage.stage ? "is-stage-muted" : "";
  const stageCollapsed = state.collapsedStages.has(stage.stage);
  if (familyCollapsed || stageCollapsed) return `<div class="landscape-cell collapsed-cell ${searchDim} ${stageMuted}">${caps.length ? `<span>${esc(caps.length)}</span>` : ""}</div>`;
  if (!caps.length) return `<div class="landscape-cell empty ${searchDim} ${stageMuted}"></div>`;
  const limit = state.mode === "overview" && !state.search && state.stage === "all" ? 1 : state.mode === "explore" && !state.search ? 4 : caps.length;
  const visible = caps.slice(0, limit);
  const hidden = caps.length - visible.length;
  return `
    <div class="landscape-cell ${searchDim} ${stageMuted}">
      ${visible.map((capability) => renderCapability(capability, stage.stage)).join("")}
      ${hidden > 0 ? `<span class="more-pill">+${hidden} more capabilities</span>` : ""}
    </div>
  `;
}

function capabilityPassesBaseFilters(capability) {
  if (state.family !== "all" && !capability.familyIds.includes(state.family)) return false;
  if (state.prevalence !== "all" && capability.classification !== state.prevalence) return false;
  if (state.transaction !== "all" && capability.transactionType !== state.transaction) return false;
  if (state.confidence !== "all" && capability.statusState !== state.confidence) return false;
  if (state.validationOnly && !capability.needsValidation && !offeringLinks(capability).some((item) => item.needsValidation)) return false;
  if (state.focusType === "capability" && state.focusValue !== capability.id) return false;
  if (state.showExceptions && !capabilityIsException(capability)) return false;
  return true;
}

function sortCapabilitiesForView(a, b) {
  if (state.mode === "overview") {
    return capabilityStats(b).complexityScore - capabilityStats(a).complexityScore || (b.providerCount || 0) - (a.providerCount || 0) || String(a.capability).localeCompare(String(b.capability));
  }
  return String(a.capability).localeCompare(String(b.capability));
}

function capabilityPassesPropertyFilters(capability) {
  if (propertyFiltersClear()) return true;
  return offeringLinks(capability).some((link) => link.kind === "property" && propertyPassesFilters(indexes.properties[link.propertyId]));
}

function propertyFiltersClear() {
  return [state.organisation, state.brand, state.orgType, state.audience, state.propertyType].every((value) => value === "all");
}

function propertyPassesFilters(property) {
  if (!property) return false;
  if (state.organisation !== "all" && property.organisation !== state.organisation) return false;
  if (state.brand !== "all" && property.brandService !== state.brand) return false;
  if (state.orgType !== "all" && property.organisationType !== state.orgType) return false;
  if (state.audience !== "all" && property.audienceType !== state.audience) return false;
  if (state.propertyType !== "all" && property["Website type"] !== state.propertyType) return false;
  if (state.transaction !== "all" && property.transactionType !== state.transaction) return false;
  if (state.confidence !== "all" && property.statusState !== state.confidence) return false;
  if (state.validationOnly && !property.needsValidation) return false;
  return true;
}

function renderCapability(capability, stage) {
  const links = sortOfferingLinks(offeringLinks(capability).filter((link) => offeringPassesFilters(link)));
  const stats = capabilityStats(capability, links);
  const match = matchesSearch(capability) || links.some(matchesSearch);
  const handoff = links.some((link) => link.handoff) || capability.externalProvider !== "No";
  const complex = capabilityIsComplex(capability, links);
  const exception = capabilityIsException(capability);
  if (state.mode === "overview" && !state.exportingSnapshot) return renderOverviewCapability(capability, stats, match, handoff, complex, exception);
  if (state.exportingSnapshot) {
    return `
      <article class="capability-node export-capability ${state.search && !match ? "is-dimmed" : "is-match"} ${complex ? "is-complex" : ""} ${exception ? "is-exception" : ""}">
        <div class="export-capability-head">
          <b>${highlight(capability.capability)}</b>
          <span>${esc(stats.serviceCount)} offerings</span>
        </div>
        <p class="glance-line">${esc(glanceLine(stats))}</p>
        <div class="cap-meta">
          ${chip(capability.classification)}
          ${capability.matrixAvailability?.nationalRailState === "available" ? chip("National Rail present", "national") : ""}
          ${handoff ? chip("handoff", "handoff-chip") : ""}
          ${capability.needsValidation ? chip("Needs validation", "verify") : ""}
        </div>
      </article>
    `;
  }
  const open = state.mode === "full" || state.expandedCapabilities.has(capability.id);
  return `
    <details class="capability-node ${state.search && !match ? "is-dimmed" : "is-match"} ${complex ? "is-complex" : ""} ${exception ? "is-exception" : ""}" data-capability-id="${esc(capability.id)}" ${open ? "open" : ""}>
      <summary>
        <span>
          <b>${highlight(capability.capability)}</b>
          <small>${highlight(capability.passengerNeed)}</small>
          <small class="glance-line">${esc(glanceLine(stats))}</small>
        </span>
        <span class="count-pill">${esc(stats.serviceCount)} offerings</span>
      </summary>
      <div class="cap-meta">
        ${chip(capability.classification)}
        ${providerBreakdown(stats)}
        ${capability.matrixAvailability?.nationalRailState === "available" ? chip("National Rail present", "national") : ""}
        ${capability.matrixAvailability ? chip(`TOC matrix ${capability.matrixAvailability.availableTocCount}/${capability.matrixAvailability.tocProviderCount}`) : ""}
        ${capabilitySignalChips(capability, stats, handoff)}
        ${capability.needsValidation ? chip("Needs validation", "verify") : ""}
      </div>
      ${
        open && !state.exportingSnapshot
          ? `<div class="cap-actions no-export">
              <span class="sort-note">Services sorted by ${esc(state.sortOfferings.toLowerCase())}</span>
              <button class="small-button" data-focus-capability="${esc(capability.id)}">Focus on this capability</button>
              ${handoff ? `<button class="small-button" data-signal="handoffs">View hand-offs</button>` : ""}
            </div>`
          : ""
      }
      <div class="service-cloud">${renderOfferings(capability, links)}</div>
      <button class="small-button no-export" data-detail="capability" data-id="${esc(capability.id)}">Details</button>
    </details>
  `;
}

function renderOverviewCapability(capability, stats, match, handoff, complex, exception) {
  return `
    <article class="capability-node overview-capability ${state.search && !match ? "is-dimmed" : "is-match"} ${complex ? "is-complex" : ""} ${exception ? "is-exception" : ""}" data-capability-id="${esc(capability.id)}">
      <button class="overview-capability-button" data-focus-capability="${esc(capability.id)}">
        <span>
          <b>${highlight(capability.capability)}</b>
          <small>${esc(stats.serviceCount)} providers · ${highlight(capability.classification)}</small>
        </span>
      </button>
      <div class="overview-signals">
        ${capabilityOverviewSignals(capability, stats, handoff)}
      </div>
    </article>
  `;
}

function capabilityOverviewSignals(capability, stats, handoff) {
  const signals = [];
  if (stats.serviceCount >= 20 || classificationIncludes(capability, ["universal"])) signals.push(`<button data-signal="complexity">◎ High duplication</button>`);
  if (handoff || stats.handoffCount > 0) signals.push(`<button data-signal="handoffs">↗ Multiple hand-offs</button>`);
  if (stats.third > 0 || String(capability.externalProvider || "").toLowerCase() !== "no") signals.push(`<button data-signal="external">↗ External dependency</button>`);
  if (classificationIncludes(capability, ["unique", "specialist", "limited"])) signals.push(`<button data-signal="exceptions">◇ Specialist</button>`);
  if (stats.validation > 0 || capability.needsValidation) signals.push(`<button data-signal="validation">? Needs validation</button>`);
  return signals.slice(0, 2).join("");
}

function offeringLinks(capability) {
  const precise = capability.serviceLinks.map((link) => {
    const property = indexes.properties[link.propertyId];
    return {
      ...link,
      kind: "property",
      needsValidation: property?.needsValidation || link.relationshipConfidence === "needs_verification",
      statusState: property?.statusState || capability.statusState,
      audienceType: property?.audienceType,
      transactionType: property?.transactionType,
      propertyType: property?.["Website type"],
      searchText: JSON.stringify([link, property]),
    };
  });
  if (precise.length) return precise;
  return capability.providerReferences.map((reference) => ({
    ...reference,
    kind: "provider",
    serviceName: reference.name,
    organisation: "Provider reference",
    brandService: reference.name,
    organisationType: "Provider reference",
    websiteType: "Provider reference",
    needsValidation: false,
    statusState: capability.statusState,
    searchText: JSON.stringify(reference),
  }));
}

function offeringPassesFilters(link) {
  if (link.kind === "property") return propertyPassesFilters(indexes.properties[link.propertyId]);
  if (!propertyFiltersClear()) return false;
  if (state.confidence !== "all" && link.statusState !== state.confidence) return false;
  return true;
}

function familyStats(family, capabilities) {
  const offeringIds = new Set();
  const complex = capabilities.filter((capability) => capabilityIsComplex(capability)).length;
  capabilities.forEach((capability) => {
    offeringLinks(capability).forEach((link) => offeringIds.add(link.propertyId || link.serviceName || link.name));
  });
  return { offerings: Math.max(offeringIds.size, family.propertyIds.length), complex };
}

function capabilityStats(capability, links = offeringLinks(capability)) {
  const properties = links.map((link) => indexes.properties[link.propertyId]).filter(Boolean);
  const typeCounts = {
    national: 0,
    industry: 0,
    toc: 0,
    third: 0,
    specialist: 0,
    provider: links.filter((link) => link.kind === "provider").length,
    unclear: 0,
  };
  properties.forEach((property) => {
    const type = typeClassFor(property.organisationType);
    if (typeCounts[type] !== undefined) typeCounts[type] += 1;
    else typeCounts.unclear += 1;
  });
  const handoffCount = unique([
    ...links.filter((link) => link.handoff).map((link) => link.handoff?.id || link.handoff),
    ...capability.serviceLinks.flatMap((link) => link.handoff ? [link.handoff] : []),
  ]).length;
  const separateProperties = properties.filter(isSeparateDigitalProperty).length;
  const validation = Number(capability.needsValidation) + links.filter((link) => link.needsValidation).length;
  const serviceCount = Math.max(links.length, capability.providerCount || 0);
  const complexityScore =
    serviceCount +
    handoffCount * 4 +
    typeCounts.third * 3 +
    validation * 3 +
    separateProperties * 2 +
    (classificationIncludes(capability, ["unique", "specialist", "limited"]) ? 4 : 0);
  return {
    ...typeCounts,
    serviceCount,
    handoffCount,
    separateProperties,
    validation,
    complexityScore,
  };
}

function isSeparateDigitalProperty(property) {
  if (!property) return false;
  const type = String(property["Website type"] || "").toLowerCase();
  return Boolean(property["Parent website"]) || ["portal", "microsite", "subdomain", "tool", "platform", "landing", "wifi", "wi-fi"].some((term) => type.includes(term));
}

function classificationIncludes(capability, terms) {
  const text = String(capability.classification || "").toLowerCase();
  return terms.some((term) => text.includes(term));
}

function capabilityIsComplex(capability, links) {
  const stats = capabilityStats(capability, links || offeringLinks(capability));
  return stats.complexityScore >= 24 || stats.handoffCount > 0 || stats.third > 0 || stats.separateProperties >= 4 || stats.validation > 0;
}

function capabilityIsException(capability) {
  if (capability.needsValidation || classificationIncludes(capability, ["unique", "specialist", "limited"])) return true;
  if (String(capability.externalProvider || "").toLowerCase() !== "no") return true;
  const exceptionTerms = ["airport", "international", "onboard", "on board", "wi-fi", "wifi", "microsite", "portal", "business", "corporate", "agent", "ancillary", "loyalty", "parking", "luggage", "legacy", "supplier"];
  if (exceptionTerms.some((term) => textForSearch(capability).includes(term))) return true;
  return offeringLinks(capability).some((link) => {
    const property = indexes.properties[link.propertyId];
    return property && (typeClassFor(property.organisationType) === "third" || typeClassFor(property.organisationType) === "specialist" || exceptionTerms.some((term) => textForSearch(property).includes(term)));
  });
}

function propertyIsException(property) {
  if (!property) return false;
  if (property.needsValidation) return true;
  if (typeClassFor(property.organisationType) === "third" || typeClassFor(property.organisationType) === "specialist") return true;
  if (isSeparateDigitalProperty(property)) return true;
  const exceptionTerms = ["airport", "international", "onboard", "on board", "wi-fi", "wifi", "microsite", "portal", "business", "corporate", "agent", "ancillary", "loyalty", "parking", "luggage", "legacy", "supplier"];
  return exceptionTerms.some((term) => textForSearch(property).includes(term));
}

function glanceLine(stats) {
  const parts = [];
  if (stats.national) parts.push(`${stats.national} national/shared`);
  if (stats.toc) parts.push(`${stats.toc} TOC`);
  if (stats.third) parts.push(`${stats.third} external`);
  if (stats.specialist) parts.push(`${stats.specialist} specialist`);
  if (stats.provider) parts.push(`${stats.provider} provider references`);
  if (stats.separateProperties) parts.push(`${stats.separateProperties} separate portals/microsites`);
  if (stats.handoffCount) parts.push(`${stats.handoffCount} hand-offs`);
  if (stats.validation) parts.push(`${stats.validation} validation flags`);
  return parts.length ? parts.join(" · ") : "Evidence captured at capability level";
}

function providerBreakdown(stats) {
  const pieces = [
    stats.national ? chip(`National ${stats.national}`, "national") : "",
    stats.toc ? chip(`TOC ${stats.toc}`, "toc") : "",
    stats.industry ? chip(`Industry ${stats.industry}`, "industry") : "",
    stats.third ? chip(`External ${stats.third}`, "third") : "",
    stats.specialist ? chip(`Specialist ${stats.specialist}`, "specialist") : "",
    stats.provider ? chip(`Provider refs ${stats.provider}`) : "",
  ];
  return pieces.join("");
}

function capabilitySignalChips(capability, stats, handoff) {
  const chips = [];
  if (stats.serviceCount >= 20 || classificationIncludes(capability, ["universal"])) chips.push(chip("High duplication", "signal"));
  if (handoff || stats.handoffCount > 0) chips.push(chip("Hand-off", "handoff-chip"));
  if (stats.third > 0 || String(capability.externalProvider || "").toLowerCase() !== "no") chips.push(chip("External dependency", "third"));
  if (classificationIncludes(capability, ["unique", "specialist", "limited"])) chips.push(chip("Specialist / isolated", "specialist"));
  if (stats.validation > 0) chips.push(chip("Evidence gap", "verify"));
  return chips.join("");
}

function sortOfferingLinks(links) {
  const order = { national: 0, industry: 1, toc: 2, third: 3, specialist: 4, "": 5 };
  return [...links].sort((a, b) => {
    const pa = indexes.properties[a.propertyId];
    const pb = indexes.properties[b.propertyId];
    if (state.sortOfferings === "Organisation") return String(a.organisation || "").localeCompare(String(b.organisation || "")) || String(a.serviceName || "").localeCompare(String(b.serviceName || ""));
    if (state.sortOfferings === "Service type") return String(a.websiteType || pa?.["Website type"] || "").localeCompare(String(b.websiteType || pb?.["Website type"] || "")) || String(a.serviceName || "").localeCompare(String(b.serviceName || ""));
    if (state.sortOfferings === "Confidence") return String(a.statusState || "").localeCompare(String(b.statusState || "")) || String(a.organisation || "").localeCompare(String(b.organisation || ""));
    return (order[typeClassFor(a.organisationType)] ?? 6) - (order[typeClassFor(b.organisationType)] ?? 6) || String(a.organisation || "").localeCompare(String(b.organisation || ""));
  });
}

function renderOfferings(capability, links) {
  if (!links.length) return `<p class="meta-line">No offering/provider reference matches the active filters.</p>`;
  const limit = state.mode === "overview" && !state.search ? 4 : state.mode === "explore" && !state.search ? 8 : links.length;
  const visible = links.slice(0, limit);
  return `
    ${visible
      .map((link) => {
        const property = indexes.properties[link.propertyId];
        const typeClass = typeClassFor(link.organisationType);
        return `
          <button class="service-chip ${typeClass} ${link.needsValidation ? "verify" : ""}" data-detail="${link.kind}" data-id="${esc(property?.id || capability.id)}">
            <b>${highlight(link.serviceName)}</b>
            <span>${highlight(link.organisation)} · ${highlight(link.websiteType)}</span>
            ${link.domain ? `<em>${highlight(link.domain)}</em>` : ""}
            ${link.relationshipConfidence === "needs_verification" ? "<em>Needs verification</em>" : ""}
          </button>
        `;
      })
      .join("")}
    ${links.length > visible.length ? `<span class="more-pill">+${links.length - visible.length} more offerings</span>` : ""}
  `;
}

function renderHandoffs() {
  const handoffs = state.data.externalHandoffs.filter((handoff) => {
    if (state.confidence !== "all" && handoff.statusState !== state.confidence) return false;
    if (state.search && !matchesSearch(handoff)) return false;
    return true;
  });
  const visible = state.mode === "overview" && !state.search ? handoffs.slice(0, 8) : handoffs;
  if (!visible.length) return "";
  return `
    <section class="handoff-section">
      <div class="section-heading">
        <p class="eyebrow">Digital hand-offs</p>
        <h3>Explicit transitions captured in the expanded workbook</h3>
      </div>
      <div class="handoff-grid">
        ${visible
          .map(
            (handoff) => `
              <article class="handoff-card ${handoff.statusState === "SME validation required" ? "verify" : ""}">
                <button class="plain-detail" data-detail="handoff" data-id="${esc(handoff.id)}">${highlight(handoff["Originating service"])} <span>→</span> ${highlight(handoff["Destination service"])}</button>
                <p>${highlight(handoff["Reason for hand-off"])}</p>
                <div class="cap-meta">
                  ${chip(`Domain: ${handoff["Domain changes?"] || "Not captured"}`, "handoff-chip")}
                  ${chip(`Organisation: ${handoff["Organisation changes?"] || "Not captured"}`, "handoff-chip")}
                  ${chip(handoff.Confidence)}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
      ${handoffs.length > visible.length ? `<p class="meta-line">Showing ${visible.length} of ${handoffs.length}; use Explore, Audit or Full landscape for all hand-offs.</p>` : ""}
    </section>
  `;
}

function renderAuditLayer() {
  if (state.mode !== "full") return "";
  return `
    <section class="audit-section">
      <div class="section-heading">
        <p class="eyebrow">Level 3 full landscape</p>
        <h3>Every imported digital property and capability</h3>
      </div>
      ${renderPropertyInventory()}
      ${renderCapabilityInventory()}
      ${renderEvidenceGaps()}
    </section>
  `;
}

function filteredProperties() {
  return state.data.digitalProperties
    .filter((property) => propertyPassesFilters(property))
    .filter((property) => !state.showExceptions || propertyIsException(property))
    .filter((property) => state.focusType !== "capability" || property.capabilityIds.includes(state.focusValue))
    .filter((property) => !state.search || matchesSearch(property));
}

function renderPropertyInventory() {
  const properties = filteredProperties();
  const visible = state.mode === "full" ? properties : properties.slice(0, 80);
  return `
    <div class="inventory-block">
      <h4>Digital properties <span>${esc(properties.length)} shown</span></h4>
      <div class="inventory-grid">
        ${visible
          .map(
            (property) => `
              <button class="inventory-row ${typeClassFor(property.organisationType)} ${property.needsValidation ? "verify" : ""}" data-detail="property" data-id="${esc(property.id)}">
                <b>${highlight(property.brandService)}</b>
                <span>${highlight(property.organisation)} · ${highlight(property["Website type"])} · ${highlight(property.domain)}</span>
                <em>${highlight(property.URL)}</em>
              </button>
            `,
          )
          .join("")}
      </div>
      ${properties.length > visible.length ? `<p class="meta-line">Showing ${visible.length} of ${properties.length}. Full landscape shows all filtered records.</p>` : ""}
    </div>
  `;
}

function renderCapabilityInventory() {
  const capabilities = state.data.capabilities.filter(capabilityPassesBaseFilters).filter(capabilityPassesPropertyFilters).filter((capability) => !state.search || matchesSearch(capability) || offeringLinks(capability).some(matchesSearch));
  const visible = state.mode === "full" ? capabilities : capabilities.slice(0, 80);
  return `
    <div class="inventory-block">
      <h4>Capabilities <span>${esc(capabilities.length)} shown</span></h4>
      <div class="inventory-grid">
        ${visible
          .map(
            (capability) => `
              <button class="inventory-row" data-detail="capability" data-id="${esc(capability.id)}">
                <b>${highlight(capability.capability)}</b>
                <span>${highlight(capability.passengerNeed)} · ${highlight(capability.classification)}</span>
                <em>${highlight(capability.journeyStageIds.join("; "))}</em>
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderEvidenceGaps() {
  const gaps = state.data.evidenceGaps.filter((gap) => !state.search || matchesSearch(gap));
  if (!gaps.length) return "";
  return `
    <div class="inventory-block">
      <h4>SME validation / uncertainty <span>${esc(gaps.length)} records</span></h4>
      <div class="inventory-grid">
        ${gaps
          .map(
            (gap) => `
              <button class="inventory-row verify" data-detail="gap" data-id="${esc(gap.id)}">
                <b>${highlight(gap.Area || gap["Suspected service"] || gap["Brand / service"] || gap.sourceType)}</b>
                <span>${highlight(gap["Validation question / evidence gap"] || gap["What remains unclear"] || gap["Why flagged"])}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function typeClassFor(value = "") {
  const text = String(value).toLowerCase();
  if (text.includes("national")) return "national";
  if (text === "toc" || text.includes("train operating")) return "toc";
  if (text.includes("industry") || text.includes("shared")) return "industry";
  if (text.includes("third") || text.includes("external")) return "third";
  if (text.includes("specialist")) return "specialist";
  return "";
}

function highlight(value) {
  const text = esc(compact(value, ""));
  if (!state.search || !text) return text;
  const pattern = new RegExp(`(${state.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return text.replace(pattern, "<mark>$1</mark>");
}

function showDetails(kind, id) {
  const item = detailItem(kind, id);
  if (!item) return;
  panel.innerHTML = `
    <p class="eyebrow">Source / evidence</p>
    <h2>${esc(detailTitle(kind, item))}</h2>
    ${detailSections(kind, item)}
  `;
}

function detailItem(kind, id) {
  if (kind === "capability" || kind === "provider") return indexes.capabilities[id];
  if (kind === "property") return indexes.properties[id];
  if (kind === "handoff") return indexes.handoffs[id];
  if (kind === "gap") return state.data.evidenceGaps.find((item) => item.id === id);
  return null;
}

function detailTitle(kind, item) {
  return item.capability || item.brandService || item["Originating service"] || item.Area || item["Suspected service"] || item["Brand / service"] || "Evidence item";
}

function detailRows(kind, item) {
  if (kind === "property") {
    return [
      ["Service name", item.brandService],
      ["Brand", item["Brand / service"]],
      ["Parent organisation", item.organisation],
      ["URL", item.URL],
      ["Digital property type", item["Website type"]],
      ["Passenger audience", item["Primary audience"]],
      ["Passenger need(s)", item.passengerNeedText],
      ["Capability / capabilities", item.capabilityIds.map((id) => indexes.capabilities[id]?.capability).join("; ")],
      ["Journey stage(s)", item.journeyStageIds.join("; ")],
      ["Transactional?", item.transactionType],
      ["Third-party provider if known", item["Relationship / shared platform"]],
      ["Hand-offs", item.handoffIds.map((id) => `${indexes.handoffs[id]?.["Originating service"] || ""} → ${indexes.handoffs[id]?.["Destination service"] || ""}`).join("; ")],
      ["Evidence source", item.Evidence],
      ["Date checked", item["Date checked"]],
      ["Confidence", item.Confidence],
      ["Verification status", item["Verification status"] || item.statusState],
      ["Notes", item.Notes || item["Verification enrichment"]],
    ];
  }
  if (kind === "capability" || kind === "provider") {
    const offerings = offeringLinks(item).map((link) => `${link.serviceName} (${link.organisation})`).join("; ");
    return [
      ["Name", item.capability],
      ["Passenger need", item.passengerNeed],
      ["Journey stage(s)", item.journeyStageIds.join("; ")],
      ["Capability family", item.familyIds.join("; ")],
      ["Prevalence", item.classification],
      ["Digital offerings / provider references", offerings],
      ["National Rail availability", item.matrixAvailability?.nationalRailState],
      ["TOC availability", item.matrixAvailability ? `${item.matrixAvailability.availableTocCount}/${item.matrixAvailability.tocProviderCount}` : ""],
      ["Transactional or informational", item.transactionType],
      ["Account required if known", item.requiresAccount],
      ["External provider if known", item.externalProvider],
      ["Evidence source", item.Evidence],
      ["Date checked", item["Date checked"]],
      ["Confidence", item.Confidence],
      ["Verification status", item["Verification status"] || item.statusState],
      ["Notes", item.Notes || item["Verification enrichment"]],
    ];
  }
  if (kind === "handoff") {
    return [
      ["Originating service", item["Originating service"]],
      ["Destination service", item["Destination service"]],
      ["Reason for hand-off", item["Reason for hand-off"]],
      ["Origin URL", item["Origin URL"]],
      ["Destination URL", item["Destination URL"]],
      ["Domain changes?", item["Domain changes?"]],
      ["Organisation changes?", item["Organisation changes?"]],
      ["Evidence", item.Evidence],
      ["Date checked", item["Date checked"]],
      ["Confidence", item.Confidence],
      ["Verification status", item["Verification status"] || item.statusState],
      ["Notes", item.Notes],
    ];
  }
  return Object.entries(item).filter(([key]) => !["id", "urls"].includes(key));
}

function detailSections(kind, item) {
  if (kind === "property") {
    return [
      detailSection("What is it?", [
        ["Service name", item.brandService],
        ["Brand", item["Brand / service"]],
        ["Parent organisation", item.organisation],
        ["URL", item.URL],
        ["Digital property type", item["Website type"]],
        ["Passenger audience", item["Primary audience"]],
      ]),
      detailSection("What does it enable?", [
        ["Capability / capabilities", item.capabilityIds.map((id) => indexes.capabilities[id]?.capability).join("; ")],
        ["Passenger need(s)", item.passengerNeedText],
      ]),
      detailSection("Where does it appear?", [["Journey stage(s)", item.journeyStageIds.join("; ")]]),
      detailSection("How is it delivered?", [
        ["Transactional?", item.transactionType],
        ["Provider type", item.organisationType],
        ["Third-party/shared platform", item["Relationship / shared platform"]],
        ["Hand-offs", item.handoffIds.map((id) => `${indexes.handoffs[id]?.["Originating service"] || ""} → ${indexes.handoffs[id]?.["Destination service"] || ""}`).join("; ")],
      ]),
      detailSection("Evidence", [
        ["Evidence source", item.Evidence],
        ["Date checked", item["Date checked"]],
        ["Confidence", item.Confidence],
        ["Verification status", item["Verification status"] || item.statusState],
        ["Notes", item.Notes || item["Verification enrichment"]],
      ]),
    ].join("");
  }
  if (kind === "capability" || kind === "provider") {
    const offerings = sortOfferingLinks(offeringLinks(item)).map((link) => `${link.serviceName} (${link.organisation})`).join("; ");
    const stats = capabilityStats(item, offeringLinks(item));
    return [
      detailSection("What is it?", [
        ["Name", item.capability],
        ["Capability family", item.familyIds.join("; ")],
        ["Prevalence", item.classification],
        ["At a glance", glanceLine(stats)],
      ]),
      detailSection("What does it enable?", [
        ["Passenger need", item.passengerNeed],
        ["Transactional or informational", item.transactionType],
        ["Account required if known", item.requiresAccount],
      ]),
      detailSection("Where does it appear?", [["Journey stage(s)", item.journeyStageIds.join("; ")]]),
      detailSection("Who provides this?", [
        ["Provider breakdown", glanceLine(stats)],
        ["Digital offerings / provider references", offerings],
        ["National Rail availability", item.matrixAvailability?.nationalRailState],
        ["TOC availability", item.matrixAvailability ? `${item.matrixAvailability.availableTocCount}/${item.matrixAvailability.tocProviderCount}` : ""],
        ["External provider if known", item.externalProvider],
      ]),
      detailSection("Evidence", [
        ["Evidence source", item.Evidence],
        ["Date checked", item["Date checked"]],
        ["Confidence", item.Confidence],
        ["Verification status", item["Verification status"] || item.statusState],
        ["Notes", item.Notes || item["Verification enrichment"]],
      ]),
    ].join("");
  }
  if (kind === "handoff") {
    return [
      detailSection("What is it?", [
        ["Originating service", item["Originating service"]],
        ["Destination service", item["Destination service"]],
        ["Reason for hand-off", item["Reason for hand-off"]],
      ]),
      detailSection("How is it delivered?", [
        ["Origin URL", item["Origin URL"]],
        ["Destination URL", item["Destination URL"]],
        ["Domain changes?", item["Domain changes?"]],
        ["Organisation changes?", item["Organisation changes?"]],
      ]),
      detailSection("Evidence", [
        ["Evidence", item.Evidence],
        ["Date checked", item["Date checked"]],
        ["Confidence", item.Confidence],
        ["Verification status", item["Verification status"] || item.statusState],
        ["Notes", item.Notes],
      ]),
    ].join("");
  }
  return detailSection("Evidence item", Object.entries(item).filter(([key]) => !["id", "urls"].includes(key)));
}

function detailSection(title, rows) {
  const fields = rows.map(([label, value]) => field(label, value)).filter(Boolean).join("");
  if (!fields) return "";
  return `<section class="panel-section"><h3>${esc(title)}</h3>${fields}</section>`;
}

function field(label, value) {
  if (missing(value)) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  if (!text.trim()) return "";
  const linked = esc(text).replace(/https?:\/\/[^\s;)]+/g, (url) => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`);
  return `<div class="panel-field"><b>${esc(label)}</b><span>${linked}</span></div>`;
}

app.addEventListener("click", (event) => {
  const zoomButton = event.target.closest("[data-zoom]");
  if (zoomButton) {
    handleZoomAction(zoomButton.dataset.zoom);
    return;
  }
  const collapseAllButton = event.target.closest("[data-collapse-all]");
  if (collapseAllButton) {
    state.expandedCapabilities.clear();
    state.collapsedFamilies = new Set(state.data.serviceFamilies.map((family) => family.name));
    syncControls();
    render();
    return;
  }
  const expandRelevantButton = event.target.closest("[data-expand-relevant]");
  if (expandRelevantButton) {
    state.collapsedFamilies.clear();
    state.collapsedStages.clear();
    if (state.mode === "full") {
      state.expandedCapabilities = new Set(state.data.capabilities.map((capability) => capability.id));
    } else {
      state.expandedCapabilities = new Set(relevantCapabilities().map((capability) => capability.id));
    }
    syncControls();
    render();
    return;
  }
  const toggleFamily = event.target.closest("[data-toggle-family]");
  if (toggleFamily) {
    const family = toggleFamily.dataset.toggleFamily;
    if (state.collapsedFamilies.has(family)) state.collapsedFamilies.delete(family);
    else state.collapsedFamilies.add(family);
    render();
    return;
  }
  const toggleStage = event.target.closest("[data-toggle-stage]");
  if (toggleStage) {
    const stage = toggleStage.dataset.toggleStage;
    if (state.collapsedStages.has(stage)) state.collapsedStages.delete(stage);
    else state.collapsedStages.add(stage);
    render();
    return;
  }
  const signalButton = event.target.closest("[data-signal]");
  if (signalButton) {
    event.preventDefault();
    applySignal(signalButton.dataset.signal);
    syncControls();
    render();
    return;
  }
  const stageButton = event.target.closest("[data-focus-stage]");
  if (stageButton) {
    event.preventDefault();
    state.stage = stageButton.dataset.focusStage;
    state.focusType = null;
    state.focusValue = null;
    syncControls();
    render();
    return;
  }
  const focusCapability = event.target.closest("[data-focus-capability]");
  if (focusCapability) {
    event.preventDefault();
    event.stopPropagation();
    state.focusType = "capability";
    state.focusValue = focusCapability.dataset.focusCapability;
    state.mode = "explore";
    syncControls();
    render();
    return;
  }
  const returnButton = event.target.closest("[data-return-landscape]");
  if (returnButton) {
    clearFocus();
    state.highlightComplexity = false;
    state.showExceptions = false;
    syncControls();
    render();
    return;
  }
  const capabilitySummary = event.target.closest(".capability-node summary");
  if (capabilitySummary) {
    const node = capabilitySummary.closest(".capability-node");
    if (node?.dataset.capabilityId) showDetails("capability", node.dataset.capabilityId);
  }
  const detailButton = event.target.closest("[data-detail]");
  if (detailButton) {
    event.preventDefault();
    event.stopPropagation();
    showDetails(detailButton.dataset.detail, detailButton.dataset.id);
    return;
  }
  const auditButton = event.target.closest("[data-audit-mode]");
  if (auditButton) {
    state.mode = "full";
    syncModeButtons();
    render();
  }
});

function relevantCapabilities() {
  return state.data.capabilities
    .filter(capabilityPassesBaseFilters)
    .filter(capabilityPassesPropertyFilters)
    .filter((capability) => state.search ? matchesSearch(capability) || offeringLinks(capability).some(matchesSearch) : capabilityIsComplex(capability) || capabilityIsException(capability));
}

function applySignal(signal) {
  state.mode = "explore";
  if (signal === "complexity") state.highlightComplexity = true;
  if (signal === "handoffs") {
    state.showHandoffs = true;
    state.highlightComplexity = true;
  }
  if (signal === "exceptions") state.showExceptions = true;
  if (signal === "external") {
    state.orgType = state.data.organisations.map((item) => item.organisationType).find((type) => typeClassFor(type) === "third") || state.orgType;
    state.filtersOpen = true;
  }
  if (signal === "validation") {
    state.validationOnly = true;
    state.filtersOpen = true;
  }
}

app.addEventListener(
  "toggle",
  (event) => {
    const node = event.target.closest(".capability-node");
    if (!node) return;
    if (node.open) {
      state.expandedCapabilities.add(node.dataset.capabilityId);
      showDetails("capability", node.dataset.capabilityId);
    } else state.expandedCapabilities.delete(node.dataset.capabilityId);
  },
  true,
);

async function exportPdf(type) {
  const previousMode = state.mode;
  const previousSnapshot = state.exportingSnapshot;
  const previousZoom = state.zoom;
  const previousExpanded = new Set(state.expandedCapabilities);
  const previousCollapsedFamilies = new Set(state.collapsedFamilies);
  const previousCollapsedStages = new Set(state.collapsedStages);
  setExportStatus("Preparing presentation-quality PDF...");
  if (type === "full") {
    state.mode = "full";
    state.zoom = 1;
    state.expandedCapabilities = new Set(state.data.capabilities.map((capability) => capability.id));
    state.collapsedFamilies.clear();
    state.collapsedStages.clear();
    syncModeButtons();
    render();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  const dataFilterActive =
    [
      state.stage,
      state.family,
      state.organisation,
      state.brand,
      state.orgType,
      state.audience,
      state.propertyType,
      state.transaction,
      state.prevalence,
      state.confidence,
    ].some((value) => value !== "all") || state.validationOnly;
  let root = document.querySelector("#landscape-export-root");
  let temporaryExportRoot = null;
  const useOverviewSummary = type === "current" && state.mode === "overview";
  if (useOverviewSummary) {
    temporaryExportRoot = createOverviewPdfElement();
    document.body.appendChild(temporaryExportRoot);
    root = temporaryExportRoot;
  }
  let useFullExportLayout = !useOverviewSummary && (type === "full" || state.mode === "full" || state.search || dataFilterActive || root.scrollHeight > 14000);
  if (useFullExportLayout) {
    state.exportingSnapshot = true;
    render();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    root = document.querySelector("#landscape-export-root");
  }
  document.body.classList.add("exporting");
  if (useFullExportLayout) document.body.classList.add("exporting-full");
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const header = useOverviewSummary ? { remove: () => {} } : addPdfExportHeader(root, type);
  try {
    const result = await exportElementToPdf(root, `uk-rail-digital-landscape-${type}-${new Date().toISOString().slice(0, 10)}.pdf`, type);
    setExportStatus(`PDF ready: ${result.pages} A3 landscape page${result.pages === 1 ? "" : "s"} · ${result.width}×${result.height}px source`);
  } catch (error) {
    console.error(error);
    setExportStatus(`PDF export failed: ${error.message || error}`);
  } finally {
    header.remove();
    temporaryExportRoot?.remove();
    document.body.classList.remove("exporting");
    document.body.classList.remove("exporting-full");
    state.exportingSnapshot = previousSnapshot;
    if (type === "full") {
      state.mode = previousMode;
      state.zoom = previousZoom;
      state.expandedCapabilities = previousExpanded;
      state.collapsedFamilies = previousCollapsedFamilies;
      state.collapsedStages = previousCollapsedStages;
      syncModeButtons();
      render();
    } else if (useFullExportLayout) {
      render();
    }
  }
}

function setExportStatus(message) {
  const status = document.querySelector("#export-status");
  if (status) status.textContent = message;
}

function addPdfExportHeader(root, type) {
  const header = document.createElement("div");
  header.className = "pdf-export-header";
  const filters = activeFilterCount() ? `Filters/focus active: ${activeFilterCount()}` : "No filters active";
  header.innerHTML = `
    <b>UK Rail Digital Ecosystem — Current State</b>
    <span>View: ${esc(type === "full" ? "Full landscape" : modeLabel())} · Exported ${esc(formatDate(new Date().toISOString().slice(0, 10)))} · Data updated ${esc(formatDate(state.data.meta.auditDate))} · ${esc(filters)}</span>
  `;
  root.prepend(header);
  return header;
}

function createOverviewPdfElement() {
  const wrapper = document.createElement("section");
  wrapper.className = "overview-pdf-export";
  const stages = state.data.journeyStages;
  const families = state.data.serviceFamilies
    .filter((family) => state.family === "all" || family.name === state.family)
    .map((family) => ({
      family,
      capabilities: family.capabilityIds.map((id) => indexes.capabilities[id]).filter(Boolean).filter(capabilityPassesBaseFilters).filter(capabilityPassesPropertyFilters),
    }))
    .filter((entry) => entry.capabilities.length || state.search);
  wrapper.innerHTML = `
    <div class="overview-pdf-head">
      <div>
        <b>UK Rail Digital Ecosystem — Current State</b>
        <span>View: Overview · Exported ${esc(formatDate(new Date().toISOString().slice(0, 10)))} · Data updated ${esc(formatDate(state.data.meta.auditDate))}</span>
      </div>
      <div>${state.data.metrics.digitalProperties} properties · ${state.data.metrics.capabilities} capabilities · ${state.data.metrics.thirdPartyHandoffs} hand-offs · ${state.data.metrics.itemsRequiringValidation} validation items</div>
    </div>
    <div class="overview-pdf-signals">
      ${strategicSignals().map((signal) => `<span><b>${esc(signal.count)}</b> ${esc(signal.label)}</span>`).join("")}
    </div>
    <div class="overview-pdf-grid" style="grid-template-columns: 150px repeat(${stages.length}, 86px)">
      <div class="overview-pdf-corner">Service family</div>
      ${stages.map((stage) => `<div class="overview-pdf-stage">${esc(stage.shortLabel)}</div>`).join("")}
      ${families.map((entry) => renderOverviewPdfFamilyRow(entry.family, entry.capabilities, stages)).join("")}
    </div>
    <div class="overview-pdf-note">Overview is an aggregated current-state representation. Individual services, URLs and evidence remain available in Explore and Full Landscape.</div>
  `;
  return wrapper;
}

function renderOverviewPdfFamilyRow(family, familyCapabilities, stages) {
  const stats = familyStats(family, familyCapabilities);
  return `
    <div class="overview-pdf-family"><b>${esc(family.name)}</b><span>${esc(familyCapabilities.length)} caps · ${esc(stats.offerings)} offerings</span></div>
    ${stages.map((stage) => renderOverviewPdfCell(family, stage)).join("")}
  `;
}

function renderOverviewPdfCell(family, stage) {
  const cell = state.data.landscapeMatrix.find((item) => item.family === family.name && item.stage === stage.stage);
  const caps = (cell?.capabilityIds || [])
    .map((id) => indexes.capabilities[id])
    .filter(Boolean)
    .filter(capabilityPassesBaseFilters)
    .filter(capabilityPassesPropertyFilters)
    .sort(sortCapabilitiesForView);
  if (!caps.length) return `<div class="overview-pdf-cell empty"></div>`;
  const top = caps[0];
  const stats = capabilityStats(top);
  const signals = [];
  if (stats.serviceCount >= 20 || classificationIncludes(top, ["universal"])) signals.push("◎");
  if (stats.handoffCount > 0 || top.externalProvider !== "No") signals.push("↗");
  if (classificationIncludes(top, ["unique", "specialist", "limited"])) signals.push("◇");
  if (stats.validation > 0 || top.needsValidation) signals.push("?");
  return `<div class="overview-pdf-cell"><b>${esc(caps.length)}</b><span>${esc(top.capability)}</span><em>${esc(stats.serviceCount)} providers ${signals.join(" ")}</em></div>`;
}

async function exportElementToPdf(element, filename, type = "current") {
  const html2canvasRef = window.html2canvas || globalThis.html2canvas;
  const jsPDFCtor = window.jspdf?.jsPDF || globalThis.jspdf?.jsPDF;
  if (!html2canvasRef) throw new Error("PDF capture library was not loaded.");
  if (!jsPDFCtor) throw new Error("PDF library was not loaded.");
  const width = Math.ceil(element.scrollWidth);
  const height = Math.ceil(element.scrollHeight);
  const maxSide = 32000;
  const maxArea = type === "full" ? 180000000 : 140000000;
  const scale = Math.min(2, maxSide / width, maxSide / height, Math.sqrt(maxArea / (width * height)));
  const canvas = await html2canvasRef(element, {
    backgroundColor: "#fffdfa",
    scale,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    logging: false,
    useCORS: false,
    ignoreElements: (node) => node.classList?.contains("no-export"),
  });
  const pdf = new jsPDFCtor({ orientation: "landscape", unit: "mm", format: "a3", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const footerHeight = 8;
  const imageWidthMm = pageWidth - margin * 2;
  const imageHeightMm = pageHeight - margin * 2 - footerHeight;
  const sliceHeight = Math.max(1, Math.floor((canvas.width * imageHeightMm) / imageWidthMm));
  const pageCanvas = document.createElement("canvas");
  const pageContext = pageCanvas.getContext("2d");
  pageCanvas.width = canvas.width;
  const pages = Math.ceil(canvas.height / sliceHeight);
  for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
    const sourceY = pageIndex * sliceHeight;
    const sourceHeight = Math.min(sliceHeight, canvas.height - sourceY);
    pageCanvas.height = sourceHeight;
    pageContext.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageContext.fillStyle = "#fffdfa";
    pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageContext.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
    if (pageIndex > 0) pdf.addPage("a3", "landscape");
    const pageImageHeightMm = (sourceHeight * imageWidthMm) / canvas.width;
    pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imageWidthMm, pageImageHeightMm);
    pdf.setFontSize(8);
    pdf.setTextColor(90, 99, 107);
    pdf.text(`UK Rail Digital Ecosystem — Current State · ${type === "full" ? "Full landscape" : modeLabel()} · Page ${pageIndex + 1} of ${pages}`, margin, pageHeight - 5);
  }
  pdf.save(filename);
  return { pages, width: canvas.width, height: canvas.height, scale: Number(scale.toFixed(2)), filename };
}

window.__railMapExportTest = { exportElementToPdf, exportPdf, state };

const dataPromise = window.RAIL_ECOSYSTEM_DATA
  ? Promise.resolve(window.RAIL_ECOSYSTEM_DATA)
  : fetch("data/rail-ecosystem.json").then((response) => {
      if (!response.ok) throw new Error("Data file not found. Run scripts/preprocess.py first.");
      return response.json();
    });

dataPromise
  .then((data) => {
    state.data = data;
    rebuildIndexes();
    sourcePill.textContent = `${data.metrics.digitalProperties} properties · ${data.metrics.capabilities} capabilities · Updated ${formatDate(data.meta.auditDate)}`;
    setupControls();
    render();
  })
  .catch((error) => {
    app.innerHTML = `<section class="section"><h2>Unable to load data</h2><p>${esc(error.message)}</p></section>`;
  });
