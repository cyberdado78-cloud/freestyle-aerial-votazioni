(() => {
  "use strict";

  const STORAGE_KEY = "scoreflow.platform.v1";
  const schemaVersion = 1;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const defaultCriteria = [
    "Coreografia", "Tecnica", "Tricks", "Immagine", "Presenza scenica", "Performance generale"
  ].map(name => ({ name, min: 0, max: 10, weight: 1, decimals: 1 }));

  const facCategories = [
    "Junior A", "Junior B - Base", "Teen - Base", "Adulti - Base", "Senior - Base",
    "Junior B - Intermedio", "Teen - Intermedio", "Adulti - Intermedio", "Senior - Intermedio",
    "Junior B - Avanzato", "Teen - Avanzato", "Adulti - Avanzato", "Senior - Avanzato",
    "Duo", "Istruttori / Allenatori", "Duo Professional", "Professional", "Elite"
  ];

  let platform = loadPlatform();
  let currentStep = 1;
  let editingOrganizationId = null;
  let logoDataUrl = "";
  let selectedEventFiles = [];
  let controlRefreshTimer = null;

  function uid(prefix) {
    const random = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}_${random}`;
  }

  function slugify(value) {
    return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  }

  function hexToRgb(value, fallback) {
    const match = String(value || "").match(/^#([0-9a-f]{6})$/i);
    const hex = match ? match[1] : fallback.replace("#", "");
    return `${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}`;
  }

  function applyBrandTheme(primary = "#c1121f", accent = "#d4af37") {
    const root = document.documentElement.style;
    root.setProperty("--primary", primary);
    root.setProperty("--accent", accent);
    root.setProperty("--primary-rgb", hexToRgb(primary, "#c1121f"));
    root.setProperty("--accent-rgb", hexToRgb(accent, "#d4af37"));
  }

  function loadPlatform() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.schemaVersion === schemaVersion && Array.isArray(saved.organizations)) return saved;
    } catch (error) {
      console.warn("Configurazione ScoreFlow non leggibile", error);
    }
    return { schemaVersion, organizations: [], updatedAt: null };
  }

  function persistPlatform() {
    platform.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(platform));
  }

  function ensureEventData(event) {
    event.participants = Array.isArray(event.participants) ? event.participants : [];
    event.judges = Array.isArray(event.judges) ? event.judges : [];
    event.scores = Array.isArray(event.scores) ? event.scores : [];
    event.publicVotes = Array.isArray(event.publicVotes) ? event.publicVotes : [];
    event.resultsValidated = event.resultsValidated || {};
    event.scoreHistory = Array.isArray(event.scoreHistory) ? event.scoreHistory : [];
    event.roundHistory = Array.isArray(event.roundHistory) ? event.roundHistory : [];
    event.rules = event.rules || { text: "", file: null };
    event.rounds = event.rounds || { enabled: false, finalistsPerCategory: 3, qualificationLabel: "Eliminatorie", finalLabel: "Finale" };
    event.control = event.control || { currentParticipantId: null, status: "setup" };
    event.control.mode = event.control.mode || "automatic";
    event.control.repeatQueue = Array.isArray(event.control.repeatQueue) ? event.control.repeatQueue : [];
    event.participants.forEach((participant, index) => {
      participant.order = Number(participant.order) || index + 1;
      participant.round = participant.round || "qualification";
      participant.attempt = Number(participant.attempt) || 1;
      participant.attachments = participant.attachments || {};
    });
    event.judges.forEach(judge => { judge.lastActivityAt = judge.lastActivityAt || null; });
    return event;
  }

  function formatBytes(bytes = 0) {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function activeRound(event) {
    return event.rounds.enabled && event.control.round === "final" ? "final" : "qualification";
  }

  function participantScores(event, participant) {
    const round = participant.round || activeRound(event);
    const attempt = Number(participant.attempt) || 1;
    return event.scores.filter(item => item.participantId === participant.id && (item.round || "qualification") === round && Number(item.attempt || 1) === attempt);
  }

  function voteProgress(event, participant) {
    const activeJudges = event.judges.filter(item => item.active);
    const scores = participantScores(event, participant);
    const voted = new Set(scores.map(item => item.judgeId));
    const missing = activeJudges.filter(item => !voted.has(item.id));
    return { activeJudges, scores, missing, complete: activeJudges.length > 0 && missing.length === 0 };
  }

  function nextOrderedParticipant(event, current) {
    const round = activeRound(event);
    const eligible = event.participants.filter(item => (item.round || "qualification") === round && !["completed", "dns"].includes(item.status));
    const currentIndex = event.participants.findIndex(item => item.id === current?.id);
    const regularNext = event.participants.slice(currentIndex + 1).find(item => (item.round || "qualification") === round && !["completed", "dns", "repeat"].includes(item.status)) || eligible.find(item => item.status !== "repeat") || null;
    const repeatEntry = event.control.repeatQueue.find(item => {
      const afterCategoryId = typeof item === "string" ? current?.categoryId : item.afterCategoryId;
      return !regularNext || (afterCategoryId === current?.categoryId && regularNext.categoryId !== current?.categoryId);
    });
    const repeatId = typeof repeatEntry === "string" ? repeatEntry : repeatEntry?.participantId;
    const repeat = repeatId ? eligible.find(item => item.id === repeatId) : null;
    return repeat || regularNext || eligible[0] || null;
  }

  function saveRuntime(organization) {
    organization.updatedAt = new Date().toISOString();
    platform.activeOrganizationId = organization.id;
    persistPlatform();
  }

  function openFileDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("scoreflow.files.v1", 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files", { keyPath: "id" }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function storeLocalFile(id, file) {
    const database = await openFileDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("files", "readwrite");
      transaction.objectStore("files").put({ id, blob: file, name: file.name, type: file.type, updatedAt: new Date().toISOString() });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }

  async function openLocalFile(id) {
    const database = await openFileDatabase();
    const record = await new Promise((resolve, reject) => {
      const request = database.transaction("files", "readonly").objectStore("files").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    if (!record?.blob) return alert("Il file non è disponibile su questo dispositivo. Ricaricalo dalla scheda atleta.");
    const url = URL.createObjectURL(record.blob);
    const opened = window.open(url, "_blank");
    if (!opened) {
      const link = document.createElement("a"); link.href = url; link.download = record.name || "allegato"; link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function addCriterionRow(criterion = { name: "", min: 0, max: 10, weight: 1, decimals: 1 }) {
    const fragment = $("#criterionTemplate").content.cloneNode(true);
    const row = $("tr", fragment);
    if (criterion.id) row.dataset.id = criterion.id;
    $(".criterion-name", row).value = criterion.name;
    $(".criterion-min", row).value = criterion.min;
    $(".criterion-max", row).value = criterion.max;
    $(".criterion-weight", row).value = criterion.weight;
    $(".criterion-decimals", row).value = String(criterion.decimals);
    $(".remove-criterion", row).addEventListener("click", () => {
      if ($$("#criteriaRows tr").length <= 1) return setMessage("criteriaMessage", "Serve almeno un criterio.", true);
      row.remove();
      validateCriteria();
    });
    $("#criteriaRows").append(row);
  }

  function getCriteria() {
    return $$("#criteriaRows tr").map(row => ({
      id: row.dataset.id || uid("criterion"),
      name: $(".criterion-name", row).value.trim(),
      min: Number($(".criterion-min", row).value),
      max: Number($(".criterion-max", row).value),
      weight: Number($(".criterion-weight", row).value),
      decimals: Number($(".criterion-decimals", row).value)
    }));
  }

  function validateCriteria() {
    const criteria = getCriteria();
    const invalid = criteria.find(item => !item.name || !Number.isFinite(item.min) || !Number.isFinite(item.max) || item.max <= item.min || item.weight <= 0);
    if (invalid) {
      setMessage("criteriaMessage", "Controlla i criteri: nome, intervallo e peso devono essere validi.", true);
      return false;
    }
    const totalWeight = criteria.reduce((total, item) => total + item.weight, 0);
    setMessage("criteriaMessage", `${criteria.length} criteri · peso totale ${totalWeight.toFixed(2)}. ScoreFlow normalizzerà automaticamente i pesi.`, false);
    return true;
  }

  function setMessage(id, text, error = false) {
    const element = document.getElementById(id);
    element.textContent = text;
    element.className = `inline-message ${error ? "error" : "success"}`;
  }

  function addCategory(name = "", id = "") {
    const value = name.trim();
    if (!value) return;
    const fragment = $("#categoryTemplate").content.cloneNode(true);
    const item = $(".category-item", fragment);
    item.dataset.id = id || uid("category");
    $(".category-name", item).value = value;
    $(".category-up", item).addEventListener("click", () => {
      const previous = item.previousElementSibling;
      if (previous) item.parentElement.insertBefore(item, previous);
    });
    $(".category-down", item).addEventListener("click", () => {
      const next = item.nextElementSibling;
      if (next) item.parentElement.insertBefore(next, item);
    });
    $(".remove-category", item).addEventListener("click", () => {
      item.remove();
      validateCategories();
    });
    $("#categoryList").append(item);
    validateCategories();
  }

  function getCategories() {
    return $$("#categoryList .category-item").map(item => ({
      id: item.dataset.id || uid("category"),
      name: $(".category-name", item).value.trim()
    })).filter(item => item.name);
  }

  function validateCategories() {
    const categories = getCategories();
    if (!categories.length) {
      setMessage("categoryMessage", "Aggiungi almeno una categoria.", true);
      return false;
    }
    setMessage("categoryMessage", `${categories.length} categorie · usa le frecce per cambiare l’ordine.`);
    return true;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function renderEventFiles() {
    const list = $("#eventFileList");
    if (!selectedEventFiles.length) {
      list.innerHTML = "<span>Nessun file selezionato</span>";
      return;
    }
    list.innerHTML = selectedEventFiles.map((file, index) => `<div class="file-item"><div><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.type || "file")} · ${formatBytes(file.size)}</small></div><button type="button" class="icon-button remove-file" data-index="${index}" aria-label="Rimuovi file">×</button></div>`).join("");
    $$(".remove-file", list).forEach(button => button.addEventListener("click", () => {
      selectedEventFiles.splice(Number(button.dataset.index), 1);
      renderEventFiles();
    }));
  }

  function readLogo(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) {
      $("#logoPreview").innerHTML = "<span>Logo troppo grande: massimo 2 MB.</span>";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      logoDataUrl = String(reader.result);
      $("#logoPreview").innerHTML = `<img src="${logoDataUrl}" alt="Anteprima logo">`;
    };
    reader.readAsDataURL(file);
  }

  function validateStep(step) {
    const panel = $(`[data-step="${step}"]`);
    const required = $$('[required]', panel);
    for (const input of required) {
      if (!input.checkValidity()) {
        input.reportValidity();
        return false;
      }
    }
    if (step === 2) {
      if ($("#eventEnd").value < $("#eventStart").value) {
        $("#eventEnd").setCustomValidity("La data finale non può precedere quella iniziale.");
        $("#eventEnd").reportValidity();
        $("#eventEnd").setCustomValidity("");
        return false;
      }
      return validateCategories();
    }
    if (step === 3) {
      const count = Number($("#judgeCount").value);
      const minimum = Number($("#minimumJudges").value);
      if (minimum > count) {
        $("#minimumJudges").setCustomValidity("I voti minimi non possono superare i giudici previsti.");
        $("#minimumJudges").reportValidity();
        $("#minimumJudges").setCustomValidity("");
        return false;
      }
      return validateCriteria();
    }
    return true;
  }

  function goToStep(step) {
    if (step > currentStep && !validateStep(currentStep)) return;
    currentStep = Math.max(1, Math.min(4, step));
    $$(".panel").forEach(panel => panel.classList.toggle("active", Number(panel.dataset.step) === currentStep));
    $$(".step").forEach(button => button.classList.toggle("active", Number(button.dataset.stepTarget) === currentStep));
    if (currentStep === 4) renderSummary();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formData() {
    const now = new Date();
    const trialDays = Number($("#trialDays").value);
    const trialEnd = new Date(now.getTime() + trialDays * 86400000);
    const organizationId = editingOrganizationId || uid("org");
    const existing = platform.organizations.find(item => item.id === organizationId);
    const eventId = existing?.events?.[0]?.id || uid("event");

    return {
      id: organizationId,
      slug: $("#orgSlug").value.trim(),
      name: $("#orgName").value.trim(),
      language: $("#language").value,
      brand: { primaryColor: $("#primaryColor").value, accentColor: $("#accentColor").value, logoUrl: $("#logoUrl").value.trim(), logoDataUrl },
      subscription: {
        plan: existing?.subscription?.plan || "trial",
        status: existing?.subscription?.status || "trialing",
        trialDays,
        trialStartedAt: existing?.subscription?.trialStartedAt || now.toISOString(),
        trialEndsAt: existing?.subscription?.trialEndsAt || trialEnd.toISOString(),
        billingProvider: "stripe-ready"
      },
      events: [{
        id: eventId,
        name: $("#eventName").value.trim(),
        location: $("#eventLocation").value.trim(),
        startsAt: $("#eventStart").value,
        endsAt: $("#eventEnd").value,
        status: "draft",
        disciplines: $("#disciplines").value.split(",").map(v => v.trim()).filter(Boolean),
        categories: getCategories(),
        assets: selectedEventFiles.map(file => ({ id: file.id || uid("asset"), name: file.name, size: file.size, type: file.type, status: "pending-cloud-upload" })),
        scoring: {
          aggregation: $("#aggregation").value,
          judgeCount: Number($("#judgeCount").value),
          minimumJudges: Number($("#minimumJudges").value),
          criteria: getCriteria(),
          penalties: { enabled: $("#penaltiesEnabled").checked, noteRequired: $("#penaltyNoteRequired").checked },
          judgeSubstitutionLog: $("#judgeSubstitutionLog").checked
        },
        publicVoting: { enabled: $("#publicVoting").checked, oneVotePerDevice: true },
        participants: existing?.events?.[0]?.participants || [],
        judges: existing?.events?.[0]?.judges || [],
        scores: existing?.events?.[0]?.scores || [],
        scoreHistory: existing?.events?.[0]?.scoreHistory || [],
        roundHistory: existing?.events?.[0]?.roundHistory || [],
        publicVotes: existing?.events?.[0]?.publicVotes || [],
        resultsValidated: existing?.events?.[0]?.resultsValidated || {},
        rules: existing?.events?.[0]?.rules || { text: "", file: null },
        rounds: existing?.events?.[0]?.rounds || { enabled: false, finalistsPerCategory: 3, qualificationLabel: "Eliminatorie", finalLabel: "Finale" },
        control: existing?.events?.[0]?.control || { currentParticipantId: null, status: "setup" },
        createdAt: existing?.events?.[0]?.createdAt || now.toISOString()
      }],
      updatedAt: now.toISOString(),
      createdAt: existing?.createdAt || now.toISOString()
    };
  }

  function renderSummary() {
    const org = formData();
    const event = org.events[0];
    const items = [
      ["Organizzazione", org.name, org.slug],
      ["Prova gratuita", `${org.subscription.trialDays} giorni`, "Configurabile per cliente"],
      ["Evento", event.name, `${event.startsAt} → ${event.endsAt}`],
      ["Categorie", event.categories.length, event.disciplines.join(" · ")],
      ["Giuria", `${event.scoring.judgeCount} giudici`, `${event.scoring.minimumJudges} voti minimi`],
      ["Valutazione", `${event.scoring.criteria.length} criteri`, event.scoring.aggregation]
    ];
    $("#summary").innerHTML = items.map(([label, value, note]) => `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(String(note || ""))}</small></article>`).join("");
  }

  function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function saveConfiguration(event) {
    event.preventDefault();
    if (![1, 2, 3].every(validateStep)) return;
    const organization = formData();
    const index = platform.organizations.findIndex(item => item.id === organization.id);
    if (index >= 0) platform.organizations[index] = organization;
    else platform.organizations.push(organization);
    editingOrganizationId = organization.id;
    platform.activeOrganizationId = organization.id;
    persistPlatform();
    renderOrganizationList();
    setMessage("saveMessage", "Ambiente salvato. I dati restano separati dalle altre organizzazioni.");
    showDashboard(organization);
  }

  function exportConfiguration() {
    if (![1, 2, 3].every(validateStep)) return;
    const organization = formData();
    const blob = new Blob([JSON.stringify({ schemaVersion, organization }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${organization.slug || "scoreflow"}-config.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function renderOrganizationList() {
    const list = $("#organizationList");
    if (!platform.organizations.length) {
      list.innerHTML = '<div class="organization-empty">Nessun cliente salvato</div>';
      return;
    }
    list.innerHTML = "";
    platform.organizations.forEach(org => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "organization-item";
      button.innerHTML = `<strong>${escapeHtml(org.name)}</strong><small>${escapeHtml(org.events?.[0]?.name || "Nessun evento")}</small>`;
      button.addEventListener("click", () => loadOrganization(org.id, true));
      list.append(button);
    });
  }

  function loadOrganization(id, openDashboard = false) {
    const org = platform.organizations.find(item => item.id === id);
    if (!org) return;
    const event = ensureEventData(org.events[0]);
    editingOrganizationId = org.id;
    $("#orgName").value = org.name;
    $("#orgSlug").value = org.slug;
    $("#language").value = org.language;
    $("#trialDays").value = org.subscription.trialDays;
    $("#primaryColor").value = org.brand.primaryColor;
    $("#accentColor").value = org.brand.accentColor;
    applyBrandTheme(org.brand.primaryColor, org.brand.accentColor);
    $("#logoUrl").value = org.brand.logoUrl || "";
    logoDataUrl = org.brand.logoDataUrl || "";
    $("#logoPreview").innerHTML = logoDataUrl ? `<img src="${logoDataUrl}" alt="Anteprima logo">` : "<span>Nessun logo caricato</span>";
    $("#eventName").value = event.name;
    $("#eventLocation").value = event.location;
    $("#eventStart").value = event.startsAt;
    $("#eventEnd").value = event.endsAt;
    $("#disciplines").value = event.disciplines.join(", ");
    $("#categoryList").innerHTML = "";
    event.categories.forEach(item => addCategory(item.name, item.id));
    selectedEventFiles = (event.assets || []).map(file => ({ ...file }));
    renderEventFiles();
    $("#judgeCount").value = event.scoring.judgeCount;
    $("#minimumJudges").value = event.scoring.minimumJudges;
    $("#aggregation").value = event.scoring.aggregation;
    $("#penaltiesEnabled").checked = event.scoring.penalties.enabled;
    $("#penaltyNoteRequired").checked = event.scoring.penalties.noteRequired;
    $("#judgeSubstitutionLog").checked = event.scoring.judgeSubstitutionLog;
    $("#publicVoting").checked = event.publicVoting.enabled;
    $("#criteriaRows").innerHTML = "";
    event.scoring.criteria.forEach(addCriterionRow);
    updateTrialPreview();
    if (openDashboard) {
      platform.activeOrganizationId = org.id;
      persistPlatform();
      showDashboard(org);
    } else goToStep(1);
  }

  function resetForm() {
    editingOrganizationId = null;
    logoDataUrl = "";
    selectedEventFiles = [];
    $("#configForm").reset();
    delete $("#orgSlug").dataset.edited;
    $("#trialDays").value = 14;
    $("#primaryColor").value = "#c1121f";
    $("#accentColor").value = "#d4af37";
    applyBrandTheme("#c1121f", "#d4af37");
    $("#logoPreview").innerHTML = "<span>Nessun logo caricato</span>";
    $("#judgeCount").value = 3;
    $("#minimumJudges").value = 3;
    $("#criteriaRows").innerHTML = "";
    $("#categoryList").innerHTML = "";
    renderEventFiles();
    defaultCriteria.forEach(addCriterionRow);
    ["Categoria Base", "Categoria Intermedia", "Categoria Avanzata"].forEach(name => addCategory(name));
    updateTrialPreview();
    goToStep(1);
  }

  function applyFacTemplate() {
    $("#eventName").value = "Freestyle Aerial Competition";
    $("#disciplines").value = "Cerchio, Tessuti";
    $("#categoryList").innerHTML = "";
    facCategories.forEach(name => addCategory(name));
    $("#judgeCount").value = 3;
    $("#minimumJudges").value = 3;
    $("#criteriaRows").innerHTML = "";
    defaultCriteria.forEach(addCriterionRow);
    $("#penaltiesEnabled").checked = true;
    $("#penaltyNoteRequired").checked = true;
  }

  function updateTrialPreview() {
    const days = Math.max(1, Number($("#trialDays").value) || 14);
    $("#trialPreview").textContent = `${days} ${days === 1 ? "giorno" : "giorni"}`;
  }

  function trialDaysRemaining(organization) {
    const end = new Date(organization.subscription.trialEndsAt).getTime();
    return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  }

  function showDashboard(organization) {
    const event = organization.events[0];
    applyBrandTheme(organization.brand.primaryColor, organization.brand.accentColor);
    $("main.layout").classList.add("hidden");
    $("#dashboard").classList.remove("hidden");
    $("#dashboardOrg").textContent = organization.name;
    $("#dashboardEvent").textContent = event.name;
    $("#dashboardPlan").textContent = organization.subscription.status === "trialing" ? "Prova gratuita" : organization.subscription.plan;
    $("#dashboardTrial").textContent = `${trialDaysRemaining(organization)} giorni di prova rimasti`;
    $$(".dash-link").forEach(link => link.classList.toggle("active", link.dataset.module === "overview"));
    renderDashboardModule("overview", organization);
    window.location.hash = "dashboard";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showConfigurator() {
    applyBrandTheme($("#primaryColor").value, $("#accentColor").value);
    $("#dashboard").classList.add("hidden");
    $("main.layout").classList.remove("hidden");
    window.location.hash = "configurazione";
    goToStep(1);
  }

  function categoryName(event, categoryId) {
    return event.categories.find(item => item.id === categoryId)?.name || "Senza categoria";
  }

  function parseCsvLine(line, separator) {
    const values = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === separator && !quoted) { values.push(value.trim()); value = ""; }
      else value += char;
    }
    values.push(value.trim());
    return values;
  }

  function importParticipantsCsv(file, organization) {
    if (!file) return;
    const event = ensureEventData(organization.events[0]);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "").replace(/^\uFEFF/, "");
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) return alert("Il CSV non contiene righe da importare.");
      const separator = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
      const headers = parseCsvLine(lines[0], separator).map(item => item.toLowerCase().trim());
      const findColumn = names => headers.findIndex(header => names.includes(header));
      const nameIndex = findColumn(["nome", "atleta", "partecipante", "name"]);
      const surnameIndex = findColumn(["cognome", "surname"]);
      const clubIndex = findColumn(["societa", "società", "scuola", "club"]);
      const categoryIndex = findColumn(["categoria", "category"]);
      const disciplineIndex = findColumn(["disciplina", "discipline", "attrezzo"]);
      if (nameIndex < 0) return alert("Nel CSV serve una colonna Nome, Atleta o Partecipante.");
      let imported = 0;
      lines.slice(1).forEach(line => {
        const row = parseCsvLine(line, separator);
        const fullName = [row[nameIndex], surnameIndex >= 0 ? row[surnameIndex] : ""].filter(Boolean).join(" ").trim();
        if (!fullName) return;
        const requestedCategory = categoryIndex >= 0 ? (row[categoryIndex] || "").toLowerCase() : "";
        const category = event.categories.find(item => item.name.toLowerCase() === requestedCategory) || event.categories[0];
        event.participants.push({
          id: uid("participant"), name: fullName, club: clubIndex >= 0 ? row[clubIndex] || "" : "",
          categoryId: category?.id || "", discipline: disciplineIndex >= 0 ? row[disciplineIndex] || event.disciplines[0] || "" : event.disciplines[0] || "",
          order: event.participants.length + 1, status: "registered"
        });
        imported += 1;
      });
      saveRuntime(organization);
      renderParticipants(organization, `${imported} partecipanti importati dal CSV.`);
    };
    reader.readAsText(file);
  }

  function renderParticipants(organization, message = "") {
    const event = ensureEventData(organization.events[0]);
    const categoryOptions = event.categories.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
    const disciplineOptions = event.disciplines.map(item => `<option>${escapeHtml(item)}</option>`).join("");
    const rows = event.participants.map((participant, index) => `<tr>
      <td><strong>${index + 1}</strong></td><td><div class="athlete-list-identity">${participant.photoDataUrl ? `<img src="${participant.photoDataUrl}" alt="">` : `<span>${escapeHtml(participant.name.charAt(0) || "A")}</span>`}<div><strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(participant.club || "Nessuna società")}</small></div></div></td>
      <td>${escapeHtml(categoryName(event, participant.categoryId))}</td><td>${escapeHtml(participant.discipline || "—")}</td>
      <td><span class="state-badge ${participant.status}">${participant.status === "completed" ? "Completato" : participant.status === "dns" ? "Ritirato" : participant.round === "final" ? "Finale" : "Iscritto"}</span></td>
      <td class="row-actions"><button class="button mini participant-detail" data-id="${participant.id}" title="Apri foto, documenti, musica e badge">Scheda</button><button class="icon-button participant-up" data-id="${participant.id}" title="Sposta su">↑</button><button class="icon-button participant-down" data-id="${participant.id}" title="Sposta giù">↓</button><button class="icon-button remove-participant" data-id="${participant.id}" title="Elimina">×</button></td>
    </tr>`).join("");
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Roster e ordine gara</p><h2>Partecipanti</h2><p>Inserisci manualmente gli atleti oppure importa un CSV. L’ordine qui impostato sarà usato dalla regia.</p></div><span class="count-chip">${event.participants.length} iscritti</span></div>
      <div class="dashboard-grid operational-grid"><article class="dash-card"><h3>Nuovo partecipante</h3><form id="participantForm" class="operational-form">
        <label>Nome e cognome<input id="participantName" required placeholder="Nome atleta"></label><label>Società<input id="participantClub" placeholder="Scuola o società"></label>
        <label>Categoria<select id="participantCategory" required>${categoryOptions}</select></label><label>Disciplina<select id="participantDiscipline" required>${disciplineOptions}</select></label>
        <button class="button primary" type="submit">Aggiungi partecipante</button></form></article>
      <article class="dash-card"><h3>Importa elenco</h3><p class="muted">CSV con colonne: Nome, Cognome, Società, Categoria, Disciplina. Sono accettati separatori virgola o punto e virgola.</p><a class="button ghost download-example" href="./esempio-partecipanti.csv" download>Scarica CSV di esempio</a><label class="file-drop">Seleziona CSV<input id="participantsCsv" type="file" accept=".csv,text/csv"></label><div class="inline-message success">${escapeHtml(message)}</div></article></div>
      <div class="table-wrap operational-table"><table><thead><tr><th>Ordine</th><th>Atleta</th><th>Categoria</th><th>Disciplina</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty-cell">Nessun partecipante inserito.</td></tr>'}</tbody></table></div>`;
    $("#participantForm").addEventListener("submit", submitEvent => {
      submitEvent.preventDefault();
      event.participants.push({ id: uid("participant"), name: $("#participantName").value.trim(), club: $("#participantClub").value.trim(), categoryId: $("#participantCategory").value, discipline: $("#participantDiscipline").value, order: event.participants.length + 1, status: "registered" });
      saveRuntime(organization); renderParticipants(organization, "Partecipante aggiunto.");
    });
    $("#participantsCsv").addEventListener("change", changeEvent => importParticipantsCsv(changeEvent.target.files[0], organization));
    $$(".participant-detail", $("#moduleContent")).forEach(button => button.addEventListener("click", () => renderParticipantDetail(organization, button.dataset.id)));
    $$(".participant-up,.participant-down", $("#moduleContent")).forEach(button => button.addEventListener("click", () => {
      const index = event.participants.findIndex(item => item.id === button.dataset.id);
      const target = button.classList.contains("participant-up") ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= event.participants.length) return;
      [event.participants[index], event.participants[target]] = [event.participants[target], event.participants[index]];
      event.participants.forEach((item, position) => { item.order = position + 1; });
      saveRuntime(organization); renderParticipants(organization, "Ordine di gara aggiornato.");
    }));
    $$(".remove-participant", $("#moduleContent")).forEach(button => button.addEventListener("click", () => {
      if (!confirm("Eliminare questo partecipante e i suoi voti?")) return;
      event.participants = event.participants.filter(item => item.id !== button.dataset.id);
      event.scores = event.scores.filter(item => item.participantId !== button.dataset.id);
      saveRuntime(organization); renderParticipants(organization, "Partecipante eliminato.");
    }));
  }

  function athleteAttachmentCard(label, key, attachment, accept) {
    return `<div class="athlete-upload-wrap"><label class="athlete-upload"><span>${label}</span><small>${attachment ? `${escapeHtml(attachment.name)} · ${formatBytes(attachment.size)}` : "Nessun file caricato"}</small><input type="file" data-athlete-file="${key}" accept="${accept}"><em>${attachment ? "Sostituisci file" : "Carica file"}</em></label>${attachment?.blobKey ? `<button class="button mini open-athlete-file" data-blob-key="${attachment.blobKey}">Apri file</button>` : ""}</div>`;
  }

  function readAthletePhoto(file, participant, organization) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 1024 * 1024) return alert("Per questa prova la foto deve essere inferiore a 1 MB.");
    const reader = new FileReader();
    reader.onload = () => { participant.photoDataUrl = String(reader.result); saveRuntime(organization); renderParticipantDetail(organization, participant.id, "Foto atleta salvata."); };
    reader.readAsDataURL(file);
  }

  function printAthleteBadge(organization, participant) {
    const event = organization.events[0];
    const popup = window.open("", "_blank", "width=600,height=760");
    if (!popup) return alert("Consenti le finestre popup per stampare il badge.");
    const logo = organization.brand.logoDataUrl || organization.brand.logoUrl || "";
    popup.document.write(`<!doctype html><html><head><title>Badge ${escapeHtml(participant.name)}</title><style>*{box-sizing:border-box}body{margin:0;padding:25px;background:#eef2f6;font-family:Arial,sans-serif}.badge{width:360px;min-height:520px;margin:auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 18px 55px #1113;border-top:14px solid ${organization.brand.primaryColor || "#c1121f"}.head{padding:22px;text-align:center;border-bottom:4px solid ${organization.brand.accentColor || "#d4af37"}}.head img{max-width:150px;max-height:60px}.photo{width:150px;height:150px;border-radius:50%;object-fit:cover;margin:25px auto 12px;display:block;border:6px solid #f1f5f9}.placeholder{width:150px;height:150px;border-radius:50%;margin:25px auto 12px;display:grid;place-items:center;background:#e2e8f0;font-size:58px;font-weight:900}.body{text-align:center;padding:0 24px 28px}.body h1{font-size:29px;margin:10px 0}.body p{color:#64748b}.chips{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.chips span{padding:8px 11px;border-radius:99px;background:#f1f5f9;font-weight:700}.number{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;margin-top:25px}@media print{body{background:#fff;padding:0}.badge{box-shadow:none;margin:0 auto}@page{size:A6;margin:8mm}}</style></head><body><main class="badge"><div class="head">${logo ? `<img src="${logo}" alt="Logo">` : `<strong>${escapeHtml(organization.name)}</strong>`}</div>${participant.photoDataUrl ? `<img class="photo" src="${participant.photoDataUrl}" alt="">` : `<div class="placeholder">${escapeHtml(participant.name.charAt(0) || "A")}</div>`}<div class="body"><div class="number">Atleta · uscita ${participant.order}</div><h1>${escapeHtml(participant.name)}</h1><p>${escapeHtml(participant.club || "Atleta indipendente")}</p><div class="chips"><span>${escapeHtml(categoryName(event, participant.categoryId))}</span><span>${escapeHtml(participant.discipline || "Disciplina")}</span></div></div></main><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  }

  function renderParticipantDetail(organization, participantId, message = "") {
    const event = ensureEventData(organization.events[0]);
    const participant = event.participants.find(item => item.id === participantId);
    if (!participant) return renderParticipants(organization);
    const attachments = participant.attachments || (participant.attachments = {});
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Scheda singolo atleta</p><h2>${escapeHtml(participant.name)}</h2><p>${escapeHtml(participant.club || "Atleta indipendente")} · ${escapeHtml(categoryName(event, participant.categoryId))}</p></div><button class="button ghost back-participants">← Partecipanti</button></div><div class="athlete-profile-grid"><article class="dash-card athlete-profile"><div class="athlete-photo">${participant.photoDataUrl ? `<img src="${participant.photoDataUrl}" alt="Foto ${escapeHtml(participant.name)}">` : `<span>${escapeHtml(participant.name.charAt(0) || "A")}</span>`}</div><label class="button ghost photo-upload">Carica foto<input id="athletePhoto" type="file" accept="image/*"></label><button class="button primary print-badge">Stampa badge</button><small>La foto viene usata per riconoscimento e badge.</small></article><article class="dash-card athlete-files"><h3>Documenti e materiali</h3>${athleteAttachmentCard("Video entry", "entryVideo", attachments.entryVideo, "video/*")}${athleteAttachmentCard("Certificato medico agonistico", "medicalCertificate", attachments.medicalCertificate, "image/*,.pdf")}${athleteAttachmentCard("Musica esibizione", "music", attachments.music, "audio/mpeg,audio/mp3,.mp3")}</article><article class="dash-card athlete-competition"><h3>Dati gara</h3><div class="detail-list"><div><span>Ordine di uscita</span><strong>${participant.order}</strong></div><div><span>Fase</span><strong>${participant.round === "final" ? event.rounds.finalLabel : event.rounds.qualificationLabel}</strong></div><div><span>Tentativo valido</span><strong>${participant.attempt || 1}</strong></div><div><span>Categoria</span><strong>${escapeHtml(categoryName(event, participant.categoryId))}</strong></div></div></article></div><div class="inline-message success">${escapeHtml(message)}</div>`;
    $(".back-participants").addEventListener("click", () => renderParticipants(organization));
    $("#athletePhoto").addEventListener("change", inputEvent => readAthletePhoto(inputEvent.target.files[0], participant, organization));
    $(".print-badge").addEventListener("click", () => printAthleteBadge(organization, participant));
    $$(".open-athlete-file", $("#moduleContent")).forEach(button => button.addEventListener("click", () => openLocalFile(button.dataset.blobKey)));
    $$("[data-athlete-file]", $("#moduleContent")).forEach(input => input.addEventListener("change", async inputEvent => {
      const file = inputEvent.target.files[0];
      if (!file) return;
      const blobKey = `${event.id}:${participant.id}:${input.dataset.athleteFile}`;
      try { await storeLocalFile(blobKey, file); } catch (error) { console.error(error); return alert("Non è stato possibile conservare il file su questo dispositivo."); }
      attachments[input.dataset.athleteFile] = { name: file.name, type: file.type, size: file.size, blobKey, status: "stored-locally", selectedAt: new Date().toISOString() };
      saveRuntime(organization);
      renderParticipantDetail(organization, participant.id, `${file.name} associato alla scheda atleta.`);
    }));
  }

  function renderJudges(organization, message = "") {
    const event = ensureEventData(organization.events[0]);
    const judgeLimit = event.scoring.judgeCount;
    const judgeLimitReached = event.judges.length >= judgeLimit;
    const excessJudges = Math.max(0, event.judges.length - judgeLimit);
    const rows = event.judges.map((judge, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(judge.name)}</strong></td><td><code>${escapeHtml(judge.code)}</code></td><td>${escapeHtml(judge.language)}</td><td><span class="state-badge ${judge.active ? "completed" : "dns"}">${judge.active ? "Attivo" : "Disattivato"}</span></td><td class="row-actions"><button class="button mini toggle-judge" data-id="${judge.id}">${judge.active ? "Disattiva" : "Attiva"}</button><button class="icon-button remove-judge" data-id="${judge.id}">×</button></td></tr>`).join("");
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Giuria</p><h2>Giudici</h2><p>Puoi configurare fino a ${judgeLimit} giudici, come stabilito nelle regole dell’evento.</p></div><span class="count-chip ${excessJudges ? "limit-error" : ""}">${event.judges.length}/${judgeLimit} configurati</span></div>
      <article class="dash-card"><form id="judgeForm" class="operational-form judge-form"><label>Nome giudice<input id="judgeName" required placeholder="Nome e cognome" ${judgeLimitReached ? "disabled" : ""}></label><label>Lingua<select id="judgeLanguage" ${judgeLimitReached ? "disabled" : ""}><option value="it">Italiano</option><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option></select></label><label>Codice personale<input id="judgeCode" inputmode="numeric" maxlength="8" value="${String(Math.floor(1000 + Math.random() * 9000))}" ${judgeLimitReached ? "disabled" : ""}></label><button class="button primary" type="submit" ${judgeLimitReached ? "disabled" : ""}>${judgeLimitReached ? "Limite raggiunto" : "Crea giudice"}</button></form><div class="inline-message ${excessJudges ? "error" : "success"}">${excessJudges ? `Sono presenti ${excessJudges} giudici oltre il limite. Elimina le righe in eccesso.` : escapeHtml(message || (judgeLimitReached ? "Tutti i posti disponibili sono stati configurati." : `${judgeLimit - event.judges.length} posti ancora disponibili.`))}</div></article>
      <div class="table-wrap operational-table"><table><thead><tr><th>#</th><th>Giudice</th><th>Codice</th><th>Lingua</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty-cell">Nessun giudice configurato.</td></tr>'}</tbody></table></div>`;
    $("#judgeForm").addEventListener("submit", submitEvent => {
      submitEvent.preventDefault();
      if (event.judges.length >= judgeLimit) return alert(`Hai già configurato tutti i ${judgeLimit} giudici previsti.`);
      event.judges.push({ id: uid("judge"), name: $("#judgeName").value.trim(), language: $("#judgeLanguage").value, code: $("#judgeCode").value.trim() || String(Math.floor(1000 + Math.random() * 9000)), active: true });
      saveRuntime(organization); renderJudges(organization, "Giudice creato.");
    });
    $$(".toggle-judge", $("#moduleContent")).forEach(button => button.addEventListener("click", () => { const judge = event.judges.find(item => item.id === button.dataset.id); judge.active = !judge.active; saveRuntime(organization); renderJudges(organization, "Stato del giudice aggiornato."); }));
    $$(".remove-judge", $("#moduleContent")).forEach(button => button.addEventListener("click", () => { if (!confirm("Eliminare il giudice e tutti i suoi voti?")) return; event.judges = event.judges.filter(item => item.id !== button.dataset.id); event.scores = event.scores.filter(item => item.judgeId !== button.dataset.id); saveRuntime(organization); renderJudges(organization, "Giudice eliminato."); }));
  }

  function judgeScore(event, score) {
    const totalWeight = event.scoring.criteria.reduce((sum, criterion) => sum + Number(criterion.weight || 1), 0) || 1;
    const weighted = event.scoring.criteria.reduce((sum, criterion) => sum + Number(score.values?.[criterion.id] || 0) * Number(criterion.weight || 1), 0) / totalWeight;
    return Math.max(0, weighted - Number(score.penalty || 0));
  }

  function participantResult(event, participantId) {
    const participant = event.participants.find(item => item.id === participantId);
    const scores = participant ? participantScores(event, participant) : [];
    return resultFromScores(event, scores);
  }

  function resultFromScores(event, scores) {
    const values = scores.map(score => judgeScore(event, score));
    if (!values.length) return { total: null, count: 0, complete: false };
    let total;
    if (event.scoring.aggregation === "sum") total = values.reduce((sum, value) => sum + value, 0);
    else if (event.scoring.aggregation === "median") { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); total = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
    else total = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { total, count: values.length, complete: values.length >= event.scoring.minimumJudges };
  }

  function participantRoundResult(event, participantId, round) {
    return resultFromScores(event, event.scores.filter(item => item.participantId === participantId && (item.round || "qualification") === round));
  }

  function completeDemoData(organization) {
    const event = ensureEventData(organization.events[0]);
    const demoJudges = [
      ["Giudice Anna", "1111"], ["Giudice Marco", "2222"],
      ["Giudice Laura", "3333"], ["Giudice Paolo", "4444"],
      ["Giudice Sara", "5555"], ["Giudice Luca", "6666"]
    ];
    const usedCodes = new Set(event.judges.map(item => String(item.code)));
    let demoIndex = 0;
    while (event.judges.length < event.scoring.judgeCount) {
      const preset = demoJudges[demoIndex];
      const name = preset?.[0] || `Giudice ${demoIndex + 1}`;
      let code = preset?.[1] || String(7000 + demoIndex + 1);
      demoIndex += 1;
      if (event.judges.some(item => item.name === name)) continue;
      while (usedCodes.has(code)) code = String(Number(code) + 7);
      usedCodes.add(code);
      event.judges.push({ id: uid("judge"), name, language: "it", code, active: true });
    }
    if (!event.participants.length) {
      const samples = [
        ["Giulia Ferrari", "Aerial Dream Torino", 0, "Tessuti"],
        ["Sofia Romano", "Volo Libero Milano", 0, "Cerchio"],
        ["Martina Gallo", "Freestyle Academy", 1, "Tessuti"],
        ["Aurora Conti", "Aria Studio Genova", 2, "Cerchio"],
        ["Alice De Luca", "Freestyle Academy", 3, "Tessuti"],
        ["Camilla Greco", "Sky Art Alessandria", 4, "Cerchio"]
      ];
      samples.forEach(([name, club, categoryIndex, discipline], index) => event.participants.push({ id: uid("participant"), name, club, categoryId: event.categories.length ? event.categories[categoryIndex % event.categories.length].id : "", discipline, order: index + 1, status: "registered" }));
    }
    saveRuntime(organization);
    renderDashboardModule("overview", organization, `Dati demo completati: ${event.participants.length} atleti e ${event.judges.length}/${event.scoring.judgeCount} giudici pronti.`);
  }

  function aggregationLabel(aggregation) {
    return ({ sum: "Somma dei punteggi dei giudici", median: "Mediana dei punteggi dei giudici", average: "Media dei punteggi dei giudici", "weighted-average": "Media ponderata dei punteggi dei giudici" })[aggregation] || "Media dei punteggi dei giudici";
  }

  function currentParticipant(event) {
    const round = activeRound(event);
    const participant = event.participants.find(item => item.id === event.control.currentParticipantId && (item.round || "qualification") === round)
      || event.participants.find(item => (item.round || "qualification") === round && !["completed", "dns"].includes(item.status))
      || event.participants[0];
    if (participant) event.control.currentParticipantId = participant.id;
    return participant;
  }

  function archiveAndRepeat(event, participant, afterCategoryId) {
    const oldScores = participantScores(event, participant);
    if (oldScores.length) event.scoreHistory.push(...oldScores.map(score => ({ ...score, invalidatedAt: new Date().toISOString(), invalidationReason: "Ripetizione autorizzata dalla regia" })));
    const oldIds = new Set(oldScores.map(item => item.id));
    event.scores = event.scores.filter(item => !oldIds.has(item.id));
    participant.attempt = Number(participant.attempt || 1) + 1;
    participant.status = "repeat";
    if (!event.control.repeatQueue.some(item => (typeof item === "string" ? item : item.participantId) === participant.id)) event.control.repeatQueue.push({ participantId: participant.id, afterCategoryId });
    event.control.mode = "manual";
  }

  function judgeWarnings(event, participant) {
    const progress = voteProgress(event, participant);
    const started = participant.status === "competing" ? new Date(event.control.voteStartedAt || 0).getTime() : 0;
    const elapsed = started ? Math.floor((Date.now() - started) / 1000) : 0;
    return progress.missing.map(judge => ({ judge, delayed: elapsed >= 90, elapsed })).map(({ judge, delayed, elapsed: seconds }) => `<div class="judge-alert ${delayed ? "delayed" : ""}"><span>${delayed ? "!" : "…"}</span><div><strong>${escapeHtml(judge.name)} non ha ancora votato</strong><small>${delayed ? `Scheda ferma da ${Math.floor(seconds / 60)} min ${seconds % 60} sec` : "Votazione in attesa"}</small></div></div>`).join("");
  }

  function scoreFields(event, existingScore = null) {
    return event.scoring.criteria.map(criterion => {
      const value = existingScore?.values?.[criterion.id] ?? criterion.min;
      const step = criterion.decimals === 2 ? "0.01" : criterion.decimals === 1 ? "0.1" : "1";
      return `<label class="score-criterion" title="Inserisci un valore tra ${criterion.min} e ${criterion.max}. Il peso ${criterion.weight} sarà applicato automaticamente."><span>${escapeHtml(criterion.name)}</span><small>Da ${criterion.min} a ${criterion.max} · peso ${criterion.weight}</small><input class="score-value" data-criterion="${criterion.id}" type="number" min="${criterion.min}" max="${criterion.max}" step="${step}" value="${value}" required></label>`;
    }).join("");
  }

  function saveScoreFromForm(event, organization, participant, judge, root, onSaved) {
    const penalty = Number($("#scorePenalty", root)?.value || 0);
    const note = $("#scoreNote", root)?.value.trim() || "";
    if (penalty > 0 && event.scoring.penalties.noteRequired && !note) return alert("Inserisci la motivazione della penalità.");
    const values = {};
    $$(".score-value", root).forEach(input => { values[input.dataset.criterion] = Number(input.value); });
    const score = { id: uid("score"), participantId: participant.id, judgeId: judge.id, round: participant.round || activeRound(event), attempt: participant.attempt || 1, values, penalty, note, submittedAt: new Date().toISOString() };
    const existingIndex = event.scores.findIndex(item => item.participantId === participant.id && item.judgeId === judge.id && (item.round || "qualification") === score.round && Number(item.attempt || 1) === score.attempt);
    if (existingIndex >= 0) event.scores[existingIndex] = score; else event.scores.push(score);
    judge.lastActivityAt = score.submittedAt;
    saveRuntime(organization);
    onSaved();
  }

  function renderStations(organization) {
    const event = ensureEventData(organization.events[0]);
    const stations = [
      ["judge", "01", "Singolo giudice", "Accesso con codice personale e scheda di voto dedicata.", `${event.judges.filter(item => item.active).length} accessi attivi`],
      ["presenter", "02", "Presentatore", "Atleta in pedana, prossimo concorrente e informazioni essenziali.", "Vista da palco"],
      ["control", "03", "Regia", "Ordine di gara, stati, ricezione voti e override di emergenza.", `${event.scores.length} voti ricevuti`],
      ["staff", "04", "Staff", "Check-in, chiamata atleti, ritardi e ritiri.", `${event.participants.length} atleti`],
      ["public", "05", "Pubblico", "Vista live e voto popolare separato dalla classifica ufficiale.", event.publicVoting.enabled ? "Voto attivo" : "Solo visualizzazione"]
    ];
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Centro operativo</p><h2>Postazioni gara</h2><p>Ogni ruolo vede soltanto le informazioni e i comandi necessari.</p></div><span class="live-chip"><i></i> Sistema pronto</span></div><div class="station-grid">${stations.map(([role, number, title, description, meta]) => `<button class="station-card station-${role}" data-station="${role}"><span class="station-number">${number}</span><div class="station-icon">${role === "judge" ? "✦" : role === "presenter" ? "◉" : role === "control" ? "⌁" : role === "staff" ? "✓" : "♥"}</div><h3>${title}</h3><p>${description}</p><small>${meta}</small><strong>Apri postazione →</strong></button>`).join("")}</div>`;
    $$('[data-station]', $("#moduleContent")).forEach(button => button.addEventListener("click", () => activateDashboardModule(button.dataset.station, organization)));
  }

  function renderJudgeStation(organization, judgeId = null, message = "") {
    const event = ensureEventData(organization.events[0]);
    const activeJudges = event.judges.filter(item => item.active);
    if (!judgeId) {
      $("#moduleContent").innerHTML = `<div class="role-shell judge-shell"><div class="role-top"><button class="button ghost station-back">← Postazioni</button><span class="live-chip"><i></i> Giuria online</span></div><article class="role-login"><span class="role-symbol">✦</span><p class="eyebrow">Postazione giudice</p><h2>Accedi alla tua scheda</h2><p>Inserisci il codice personale fornito dalla regia.</p>${activeJudges.length ? '<form id="judgeLoginForm"><label>Codice giudice<input id="judgeLoginCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••" required></label><button class="button primary" type="submit">Entra nella postazione</button></form>' : '<div class="warning-box">Nessun giudice attivo. Configura prima la giuria.</div>'}<div id="judgeLoginMessage" class="inline-message error"></div></article></div>`;
      $(".station-back").addEventListener("click", () => activateDashboardModule("stations", organization));
      if ($("#judgeLoginForm")) $("#judgeLoginForm").addEventListener("submit", submitEvent => {
        submitEvent.preventDefault();
        const code = $("#judgeLoginCode").value.trim();
        const judge = activeJudges.find(item => String(item.code) === code);
        if (!judge) return setMessage("judgeLoginMessage", "Codice non riconosciuto o giudice disattivato.", true);
        judge.lastActivityAt = new Date().toISOString();
        saveRuntime(organization);
        renderJudgeStation(organization, judge.id);
      });
      return;
    }
    const judge = activeJudges.find(item => item.id === judgeId);
    if (!judge) return renderJudgeStation(organization);
    const participant = currentParticipant(event);
    if (!participant) {
      $("#moduleContent").innerHTML = '<article class="module-placeholder"><h2>Nessun atleta</h2><p>La regia deve prima caricare i partecipanti.</p></article>';
      return;
    }
    const existingScore = participantScores(event, participant).find(item => item.judgeId === judge.id);
    const locked = !["ready", "competing"].includes(participant.status);
    $("#moduleContent").innerHTML = `<div class="role-shell judge-shell"><div class="role-top"><div><button class="button ghost station-back">← Postazioni</button><button class="button ghost judge-logout">Cambia giudice</button></div><div class="judge-identity"><span>Giudice</span><strong>${escapeHtml(judge.name)}</strong></div></div><article class="role-athlete"><div><p class="eyebrow">Atleta in pedana</p><h2>${escapeHtml(participant.name)}</h2><span>${escapeHtml(participant.discipline || "Disciplina")} · ${escapeHtml(categoryName(event, participant.categoryId))}</span></div><span class="state-badge ${participant.status}">${locked ? "In attesa della regia" : participant.status === "competing" ? "In esibizione" : "Chiamato"}</span></article><article class="dash-card judge-score-card"><div class="section-heading"><div><h3>Scheda di valutazione</h3><p class="muted">${existingScore ? "Voto già inviato: puoi correggerlo finché l’atleta è attivo." : "Compila tutti i criteri configurati per l’evento."}</p></div></div>${locked ? '<div class="waiting-panel"><span>⌛</span><strong>Scheda non ancora disponibile</strong><p>La regia deve chiamare o avviare l’atleta.</p></div>' : `<form id="judgeScoreForm"><div class="judge-criteria-grid">${scoreFields(event, existingScore)}</div>${event.scoring.penalties.enabled ? `<div class="penalty-panel"><label>Penalità<input id="scorePenalty" type="number" min="0" step="0.1" value="${existingScore?.penalty || 0}"></label><label>Motivazione<input id="scoreNote" value="${escapeHtml(existingScore?.note || "")}" placeholder="Richiesta se applichi una penalità"></label></div>` : ""}<button class="button primary score-submit" type="submit">${existingScore ? "Aggiorna voto" : "Invia voto"}</button></form>`}<div class="inline-message success">${escapeHtml(message)}</div></article></div>`;
    $(".station-back").addEventListener("click", () => activateDashboardModule("stations", organization));
    $(".judge-logout").addEventListener("click", () => renderJudgeStation(organization));
    if ($("#judgeScoreForm")) $("#judgeScoreForm").addEventListener("submit", submitEvent => {
      submitEvent.preventDefault();
      saveScoreFromForm(event, organization, participant, judge, $("#judgeScoreForm"), () => renderJudgeStation(organization, judge.id, "Voto inviato correttamente alla regia."));
    });
  }

  function renderPresenter(organization) {
    const event = ensureEventData(organization.events[0]);
    const current = currentParticipant(event);
    const currentIndex = current ? event.participants.findIndex(item => item.id === current.id) : -1;
    const next = nextOrderedParticipant(event, current);
    $("#moduleContent").innerHTML = `<div class="role-shell presenter-shell"><div class="role-top"><button class="button ghost station-back">← Postazioni</button><span class="live-chip"><i></i> Vista presentatore</span></div>${current ? `<article class="presenter-stage"><p>${escapeHtml(event.name)}</p><span class="presenter-kicker">Ora in pedana</span><h2>${escapeHtml(current.name)}</h2><h3>${escapeHtml(current.club || "Atleta indipendente")}</h3><div class="presenter-meta"><span>${escapeHtml(current.discipline || "Disciplina")}</span><span>${escapeHtml(categoryName(event, current.categoryId))}</span></div></article><article class="next-athlete"><span>Prossimo atleta</span><strong>${next ? escapeHtml(next.name) : "Fine della sessione"}</strong><small>${next ? `${escapeHtml(next.discipline || "")} · ${escapeHtml(categoryName(event, next.categoryId))}` : "Nessun altro atleta in coda"}</small></article>` : '<article class="module-placeholder"><h2>Nessun atleta in gara</h2></article>'}<div class="role-actions"><button class="button ghost role-refresh">Aggiorna schermata</button></div></div>`;
    $(".station-back").addEventListener("click", () => activateDashboardModule("stations", organization));
    $(".role-refresh").addEventListener("click", () => renderPresenter(organization));
  }

  function renderStaff(organization, message = "") {
    const event = ensureEventData(organization.events[0]);
    const rows = event.participants.filter(participant => (participant.round || "qualification") === activeRound(event)).map((participant, index) => `<article class="staff-row ${participant.id === event.control.currentParticipantId ? "current" : ""}"><span class="staff-order">${participant.order || index + 1}</span><div><strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(participant.discipline || "")} · ${escapeHtml(categoryName(event, participant.categoryId))}</small></div><span class="state-badge ${participant.status}">${participant.status === "ready" ? "Pronto" : participant.status === "delayed" ? "In ritardo" : participant.status === "dns" ? "Ritirato" : participant.status === "completed" ? "Concluso" : participant.status === "competing" ? "In pedana" : participant.status === "repeat" ? "Ripetizione" : "Da chiamare"}</span><div class="staff-actions"><button class="button mini staff-status" data-id="${participant.id}" data-status="ready">Pronto</button><button class="button mini staff-status" data-id="${participant.id}" data-status="delayed">Ritardo</button><button class="button mini danger staff-status" data-id="${participant.id}" data-status="dns">Ritirato</button></div></article>`).join("");
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Area operativa</p><h2>Postazione staff</h2><p>Prepara gli atleti e aggiorna la regia in tempo reale.</p></div><button class="button ghost station-back">← Postazioni</button></div><div class="staff-list">${rows || '<article class="module-placeholder">Nessun partecipante inserito.</article>'}</div><div class="inline-message success">${escapeHtml(message)}</div>`;
    $(".station-back").addEventListener("click", () => activateDashboardModule("stations", organization));
    $$(".staff-status", $("#moduleContent")).forEach(button => button.addEventListener("click", () => {
      const participant = event.participants.find(item => item.id === button.dataset.id);
      participant.status = button.dataset.status;
      saveRuntime(organization);
      renderStaff(organization, `Stato di ${participant.name} aggiornato.`);
    }));
  }

  function renderPublic(organization, message = "") {
    const event = ensureEventData(organization.events[0]);
    const participant = currentParticipant(event);
    const deviceKey = `scoreflow.public.${event.id}.${participant?.id || "none"}`;
    const alreadyVoted = localStorage.getItem(deviceKey) === "1";
    const votes = participant ? event.publicVotes.filter(item => item.participantId === participant.id) : [];
    const average = votes.length ? votes.reduce((sum, item) => sum + item.value, 0) / votes.length : null;
    $("#moduleContent").innerHTML = `<div class="role-shell public-shell"><div class="role-top"><button class="button ghost station-back">← Postazioni</button><span class="public-brand">ScoreFlow Live</span></div>${participant ? `<article class="public-hero"><p class="eyebrow">In pedana</p><h2>${escapeHtml(participant.name)}</h2><span>${escapeHtml(participant.discipline || "Disciplina")} · ${escapeHtml(categoryName(event, participant.categoryId))}</span></article>${event.publicVoting.enabled ? `<article class="public-vote-card"><h3>Quanto ti è piaciuta l’esibizione?</h3><p>Il voto del pubblico è separato dal punteggio ufficiale della giuria.</p>${alreadyVoted ? `<div class="vote-thanks"><span>♥</span><strong>Voto registrato</strong><small>${votes.length} voti del pubblico · media ${average?.toFixed(1) || "—"}</small></div>` : `<form id="publicVoteForm"><div class="rating-buttons">${[1,2,3,4,5,6,7,8,9,10].map(value => `<button type="button" data-rating="${value}">${value}</button>`).join("")}</div><input id="publicRating" type="hidden" required><button class="button primary" type="submit">Invia voto</button></form>`}<div class="inline-message success">${escapeHtml(message)}</div></article>` : '<article class="public-vote-card"><h3>Voto pubblico non attivo</h3><p>La visualizzazione live resta disponibile.</p></article>'}` : '<article class="module-placeholder"><h2>In attesa del primo atleta</h2></article>'}</div>`;
    $(".station-back").addEventListener("click", () => activateDashboardModule("stations", organization));
    $$("[data-rating]", $("#moduleContent")).forEach(button => button.addEventListener("click", () => {
      $$("[data-rating]", $("#moduleContent")).forEach(item => item.classList.toggle("selected", item === button));
      $("#publicRating").value = button.dataset.rating;
    }));
    if ($("#publicVoteForm")) $("#publicVoteForm").addEventListener("submit", submitEvent => {
      submitEvent.preventDefault();
      const value = Number($("#publicRating").value);
      if (!value) return alert("Seleziona un voto da 1 a 10.");
      event.publicVotes.push({ id: uid("public"), participantId: participant.id, value, createdAt: new Date().toISOString() });
      localStorage.setItem(deviceKey, "1");
      saveRuntime(organization);
      renderPublic(organization, "Grazie: il tuo voto è stato registrato.");
    });
  }

  function renderControl(organization, message = "") {
    clearTimeout(controlRefreshTimer);
    const event = ensureEventData(organization.events[0]);
    if (!event.participants.length) { $("#moduleContent").innerHTML = '<article class="module-placeholder"><h2>Regia</h2><p>Prima inserisci almeno un partecipante.</p><button class="button primary" data-open-module="participants">Apri Partecipanti</button></article>'; $("[data-open-module]").addEventListener("click", () => activateDashboardModule("participants", organization)); return; }
    const current = currentParticipant(event);
    const activeJudges = event.judges.filter(item => item.active);
    const progress = voteProgress(event, current);
    const currentScores = progress.scores;
    const criteriaFields = scoreFields(event);
    const queue = event.participants.filter(item => (item.round || "qualification") === activeRound(event)).map((participant, index) => `<button class="queue-item ${participant.id === current.id ? "active" : ""}" data-participant="${participant.id}" ${event.control.mode === "automatic" && participant.id !== current.id ? "disabled" : ""} title="${event.control.mode === "automatic" ? "L’ordine è protetto in modalità automatica" : "Selezione manuale della regia"}"><span>${participant.order || index + 1}</span><div><strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(categoryName(event, participant.categoryId))} · tentativo ${participant.attempt || 1}</small></div><em>${participant.status === "completed" ? "✓" : participant.status === "repeat" ? "↻" : participant.status === "dns" ? "R" : participant.status === "delayed" ? "!" : ""}</em></button>`).join("");
    const canConclude = progress.complete && current.status === "competing";
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Controllo gara · ${activeRound(event) === "final" ? event.rounds.finalLabel : event.rounds.qualificationLabel}</p><h2>Regia</h2><p>L’ordine è protetto: il concorrente successivo si sblocca soltanto quando tutti i giudici attivi hanno inviato il voto.</p></div><span class="count-chip">${event.participants.filter(item => item.status === "completed" && (item.round || "qualification") === activeRound(event)).length}/${event.participants.filter(item => (item.round || "qualification") === activeRound(event)).length} completati</span></div>
      <article class="dash-card control-settings"><div><strong>Avanzamento gara</strong><small>Automatico segue la scaletta; manuale abilita interventi e ripetizioni.</small></div><div class="segmented"><button data-control-mode="automatic" class="${event.control.mode === "automatic" ? "active" : ""}">Automatico</button><button data-control-mode="manual" class="${event.control.mode === "manual" ? "active" : ""}">Manuale</button></div></article>
      <div class="control-layout"><aside class="dash-card queue"><h3>Scaletta uscite</h3>${queue}${event.control.repeatQueue.length ? `<div class="repeat-queue"><strong>Ripetizioni programmate</strong>${event.control.repeatQueue.map(item => { const id = typeof item === "string" ? item : item.participantId; const athlete = event.participants.find(entry => entry.id === id); return athlete ? `<small>↻ ${escapeHtml(athlete.name)} · tra due categorie</small>` : ""; }).join("")}</div>` : ""}</aside><section class="control-stage">
        <article class="current-athlete"><p>${escapeHtml(current.discipline || "Disciplina")} · uscita ${current.order}</p><h2>${escapeHtml(current.name)}</h2><span>${escapeHtml(categoryName(event, current.categoryId))} · ${escapeHtml(current.club || "Nessuna società")} · tentativo ${current.attempt || 1}</span><div class="control-actions"><button class="button ghost status-button" data-status="ready">Chiama atleta</button><button class="button primary status-button" data-status="competing">Avvia esibizione</button><button class="button success status-button" data-status="completed" ${canConclude ? "" : "disabled"} title="${canConclude ? "Chiude l’esibizione" : "In attesa del voto di tutti i giudici attivi"}">Concludi e avanza</button><button class="button warning repeat-athlete" ${event.control.mode === "manual" ? "" : "disabled"} title="Disponibile in modalità manuale">Autorizza ripetizione</button><button class="button danger status-button" data-status="dns">Ritirato</button></div></article>
        <article class="dash-card vote-monitor"><div class="section-heading"><div><p class="eyebrow">Controllo votazione</p><h3>${progress.scores.length}/${progress.activeJudges.length} giudici hanno terminato</h3></div><button class="button ghost refresh-control">Aggiorna</button></div>${progress.complete ? '<div class="vote-complete">✓ Tutti i giudici hanno votato. È possibile avanzare.</div>' : `<div class="judge-alerts">${judgeWarnings(event, current) || '<div class="warning-box">Nessun giudice attivo configurato.</div>'}</div>`}<details class="rules-tip"><summary>Regolamento e indicazioni di gara</summary><p>${escapeHtml(event.rules.text || "Nessun regolamento inserito. Aggiungilo nella sezione Evento.")}</p></details></article>
        <article class="dash-card"><div class="section-heading"><div><p class="eyebrow">Emergenza regia</p><h3>Override voto manuale</h3><p class="muted">Usa questa funzione solo se la postazione di un giudice non è disponibile · ${currentScores.length}/${event.scoring.minimumJudges} voti minimi ricevuti</p></div></div>
          ${activeJudges.length ? `<form id="scoreForm"><div class="operational-form score-form"><label>Giudice<select id="scoreJudge">${activeJudges.map(judge => `<option value="${judge.id}">${escapeHtml(judge.name)}</option>`).join("")}</select></label>${criteriaFields}${event.scoring.penalties.enabled ? '<label>Penalità<input id="scorePenalty" type="number" min="0" step="0.1" value="0"></label><label class="wide">Motivazione penalità<input id="scoreNote" placeholder="Obbligatoria se la penalità è maggiore di zero"></label>' : ""}</div><button class="button primary" type="submit">Salva voto</button></form>` : '<p class="warning-box">Configura almeno un giudice attivo prima di inserire i voti.</p>'}
          <div class="submitted-scores">${currentScores.map(score => { const judge = event.judges.find(item => item.id === score.judgeId); return `<div><span>${escapeHtml(judge?.name || "Giudice eliminato")}</span><strong>${judgeScore(event, score).toFixed(2)}</strong></div>`; }).join("")}</div><div class="inline-message success">${escapeHtml(message)}</div></article>
      </section></div>`;
    $$('[data-control-mode]', $("#moduleContent")).forEach(button => button.addEventListener("click", () => { event.control.mode = button.dataset.controlMode; saveRuntime(organization); renderControl(organization, `Avanzamento ${button.dataset.controlMode === "automatic" ? "automatico" : "manuale"} attivato.`); }));
    $$(".queue-item", $("#moduleContent")).forEach(button => button.addEventListener("click", () => { if (event.control.mode !== "manual" || (current.status === "competing" && !progress.complete)) return; event.control.currentParticipantId = button.dataset.participant; saveRuntime(organization); renderControl(organization); }));
    $$(".status-button", $("#moduleContent")).forEach(button => button.addEventListener("click", () => {
      const status = button.dataset.status;
      if (status === "completed" && !voteProgress(event, current).complete) return alert("Non puoi avanzare: almeno un giudice attivo non ha ancora terminato la votazione.");
      current.status = status; event.control.status = status;
      if (status === "competing") event.control.voteStartedAt = new Date().toISOString();
      if (status === "completed" || status === "dns") {
        const next = nextOrderedParticipant(event, current);
        if (next) {
          event.control.currentParticipantId = next.id;
          event.control.voteStartedAt = null;
          event.control.repeatQueue = event.control.repeatQueue.filter(item => (typeof item === "string" ? item : item.participantId) !== next.id);
        }
      }
      saveRuntime(organization); renderControl(organization, `Stato di ${current.name} aggiornato.`);
    }));
    $(".repeat-athlete").addEventListener("click", () => { if (!confirm(`Annullare i voti attuali di ${current.name} e inserirla nuovamente in scaletta?`)) return; archiveAndRepeat(event, current, current.categoryId); const next = nextOrderedParticipant(event, current); if (next) { event.control.currentParticipantId = next.id; if (next.id === current.id) event.control.repeatQueue = event.control.repeatQueue.filter(item => (typeof item === "string" ? item : item.participantId) !== next.id); } event.control.voteStartedAt = null; saveRuntime(organization); renderControl(organization, `${current.name} inserita tra due categorie. I voti precedenti sono archiviati come annullati.`); });
    $(".refresh-control").addEventListener("click", () => renderControl(organization));
    if ($("#scoreForm")) $("#scoreForm").addEventListener("submit", submitEvent => {
      submitEvent.preventDefault();
      const judgeId = $("#scoreJudge").value;
      const judge = activeJudges.find(item => item.id === judgeId);
      saveScoreFromForm(event, organization, current, judge, $("#scoreForm"), () => renderControl(organization, "Override salvato. Il voto precedente dello stesso giudice, se presente, è stato aggiornato."));
    });
    if (current.status === "competing" && !progress.complete) controlRefreshTimer = setTimeout(() => renderControl(organization), 15000);
  }

  function athleteReportHtml(organization, participant) {
    const event = ensureEventData(organization.events[0]);
    const scores = participantScores(event, participant);
    const result = participantResult(event, participant.id);
    const logo = organization.brand.logoDataUrl || organization.brand.logoUrl;
    const criteriaHeaders = event.scoring.criteria.map(item => `<th>${escapeHtml(item.name)}<small>Peso ${item.weight}</small></th>`).join("");
    const scoreRows = scores.map(score => {
      const judge = event.judges.find(item => item.id === score.judgeId);
      const values = event.scoring.criteria.map(item => `<td>${Number(score.values?.[item.id] ?? 0).toFixed(Number(item.decimals || 0))}</td>`).join("");
      return `<tr><td><strong>${escapeHtml(judge?.name || "Giudice non disponibile")}</strong></td>${values}<td>${Number(score.penalty || 0).toFixed(2)}${score.note ? `<small>${escapeHtml(score.note)}</small>` : ""}</td><td><strong>${judgeScore(event, score).toFixed(2)}</strong></td></tr>`;
    }).join("");
    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Scheda ${escapeHtml(participant.name)}</title><style>
      :root{--primary:${organization.brand.primaryColor || "#c1121f"};--ink:#121826;--muted:#667085;--line:#d9dee7}*{box-sizing:border-box}body{margin:0;background:#eef1f5;color:var(--ink);font:14px Inter,Arial,sans-serif}.sheet{width:min(1120px,calc(100% - 32px));margin:24px auto;background:#fff;border-radius:20px;padding:34px;box-shadow:0 20px 60px #1118271c}.report-head{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid var(--primary);padding-bottom:22px}.report-head img{max-width:150px;max-height:74px;object-fit:contain}.kicker{color:var(--primary);font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:800}.report-head h1{font-size:32px;margin:6px 0}.report-head p{margin:3px 0;color:var(--muted)}.athlete{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;margin:24px 0}.athlete div{background:#f6f7f9;border-radius:12px;padding:14px}.athlete span,.athlete strong{display:block}.athlete span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.athlete strong{font-size:18px;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid var(--line);padding:10px;text-align:center}th{background:#f2f4f7}th:first-child,td:first-child{text-align:left}th small,td small{display:block;color:var(--muted);font-weight:400;margin-top:3px}.total{margin-top:22px;border-radius:15px;background:var(--ink);color:#fff;padding:20px;display:flex;justify-content:space-between;align-items:center}.total span,.total strong{display:block}.total small{color:#cbd5e1}.total strong{font-size:34px}.note{color:var(--muted);margin-top:18px;font-size:11px}.print{display:block;margin:18px auto 0;border:0;border-radius:10px;padding:11px 17px;background:var(--primary);color:#fff;font-weight:800;cursor:pointer}@media print{body{background:#fff}.sheet{width:100%;margin:0;padding:12px;box-shadow:none}.print{display:none}@page{size:landscape;margin:10mm}}</style></head><body><main class="sheet"><header class="report-head"><div><span class="kicker">Scheda ufficiale atleta</span><h1>${escapeHtml(event.name)}</h1><p>${escapeHtml(organization.name)} · ${escapeHtml(event.location || "")}</p><p>${escapeHtml(event.startsAt || "")} — ${escapeHtml(event.endsAt || "")}</p></div>${logo ? `<img src="${escapeHtml(logo)}" alt="Logo">` : ""}</header><section class="athlete"><div><span>Atleta</span><strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(participant.club || "Atleta indipendente")}</small></div><div><span>Categoria</span><strong>${escapeHtml(categoryName(event, participant.categoryId))}</strong></div><div><span>Disciplina</span><strong>${escapeHtml(participant.discipline || "—")}</strong></div></section><table><thead><tr><th>Giudice</th>${criteriaHeaders}<th>Penalità</th><th>Totale giudice</th></tr></thead><tbody>${scoreRows || `<tr><td colspan="${event.scoring.criteria.length + 3}">Nessun voto disponibile</td></tr>`}</tbody></table><section class="total"><div><span>Metodo di calcolo</span><strong style="font-size:18px">${escapeHtml(aggregationLabel(event.scoring.aggregation))}</strong><small>${result.count} voti ricevuti · minimo richiesto ${event.scoring.minimumJudges}</small></div><div><span>Totale finale</span><strong>${result.total === null ? "—" : result.total.toFixed(2)}</strong></div></section><p class="note">Documento generato da ScoreFlow. I punteggi riportano i criteri, i pesi e le penalità configurati per l’evento.</p><button class="print" onclick="window.print()">Stampa / salva in PDF</button></main></body></html>`;
  }

  function openAthleteReport(organization, participantId) {
    const participant = organization.events[0].participants.find(item => item.id === participantId);
    if (!participant) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return alert("Il browser ha bloccato la scheda. Consenti i popup e riprova.");
    reportWindow.opener = null;
    reportWindow.document.open();
    reportWindow.document.write(athleteReportHtml(organization, participant));
    reportWindow.document.close();
  }

  function renderResults(organization) {
    const event = ensureEventData(organization.events[0]);
    const resultRound = activeRound(event);
    const sections = event.categories.map(category => {
      const ranked = event.participants.filter(item => item.categoryId === category.id && (item.round || "qualification") === resultRound).map(participant => ({ participant, result: participantResult(event, participant.id) })).sort((a, b) => (b.result.total ?? -1) - (a.result.total ?? -1));
      if (!ranked.length) return "";
      return `<article class="dash-card results-card"><div class="section-heading"><div><p class="eyebrow">Categoria</p><h3>${escapeHtml(category.name)}</h3></div></div><div class="table-wrap"><table><thead><tr><th>Pos.</th><th>Atleta</th><th>Voti</th><th>Risultato</th><th>Stato</th><th>Scheda</th></tr></thead><tbody>${ranked.map((item, index) => `<tr><td><strong>${item.result.total === null ? "—" : index + 1}</strong></td><td class="athlete-cell"><strong>${escapeHtml(item.participant.name)}</strong><small>${escapeHtml(item.participant.club || "")}</small></td><td>${item.result.count}/${event.scoring.minimumJudges}</td><td><strong>${item.result.total === null ? "—" : item.result.total.toFixed(2)}</strong></td><td><span class="state-badge ${item.result.complete ? "completed" : "registered"}">${item.result.complete ? "Valido" : "Provvisorio"}</span></td><td><button class="button mini athlete-report" data-participant="${item.participant.id}" ${item.result.count ? "" : "disabled"}>Apri scheda</button></td></tr>`).join("")}</tbody></table></div></article>`;
    }).join("");
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Classifiche · ${resultRound === "final" ? event.rounds.finalLabel : event.rounds.qualificationLabel}</p><h2>Risultati</h2><p>I risultati sono calcolati automaticamente secondo i criteri, i pesi e le penalità configurate.</p></div><button id="exportResultsBtn" class="button ghost">Esporta CSV</button></div><div class="results-list">${sections || '<article class="module-placeholder"><p>Nessun partecipante da classificare.</p></article>'}</div>`;
    $("#exportResultsBtn").addEventListener("click", () => {
      const rows = [["Categoria", "Posizione", "Atleta", "Società", "Voti", "Risultato"]];
      event.categories.forEach(category => { event.participants.filter(item => item.categoryId === category.id && (item.round || "qualification") === resultRound).map(participant => ({ participant, result: participantResult(event, participant.id) })).sort((a, b) => (b.result.total ?? -1) - (a.result.total ?? -1)).forEach((item, index) => rows.push([category.name, item.result.total === null ? "" : index + 1, item.participant.name, item.participant.club || "", item.result.count, item.result.total === null ? "" : item.result.total.toFixed(2)])); });
      const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n");
      const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })); link.download = `${organization.slug}-risultati.csv`; link.click(); URL.revokeObjectURL(link.href);
    });
    $$(".athlete-report", $("#moduleContent")).forEach(button => button.addEventListener("click", () => openAthleteReport(organization, button.dataset.participant)));
  }

  function renderEventDashboard(organization, message = "") {
    const event = ensureEventData(organization.events[0]);
    const categoryRows = event.categories.map((category, index) => {
      const athletes = event.participants.filter(item => item.categoryId === category.id);
      return `<div class="schedule-category"><span>${index + 1}</span><div><strong>${escapeHtml(category.name)}</strong><small>${athletes.length} atleti · uscite ${athletes.map(item => item.order).join(", ") || "—"}</small></div></div>`;
    }).join("");
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Programma ufficiale</p><h2>Evento e regolamento</h2><p>Qui trovi scaletta delle categorie, regole operative e documentazione di gara.</p></div><span class="count-chip">${event.categories.length} categorie</span></div><div class="event-operations"><article class="dash-card"><h3>Scaletta categorie</h3><div class="schedule-list">${categoryRows}</div></article><article class="dash-card rules-editor"><h3>Regolamento di gara</h3><label>Testo e indicazioni<textarea id="competitionRules" rows="10" placeholder="Inserisci regolamento, norme di comportamento, criteri per ritardi e ripetizioni...">${escapeHtml(event.rules.text || "")}</textarea></label><label class="file-drop">Carica regolamento PDF<input id="rulesFile" type="file" accept=".pdf,application/pdf"></label>${event.rules.file ? `<div class="file-chip"><div><strong>${escapeHtml(event.rules.file.name)}</strong><small>${formatBytes(event.rules.file.size)}</small></div>${event.rules.file.blobKey ? `<button class="button mini open-rules-file" data-blob-key="${event.rules.file.blobKey}">Apri PDF</button>` : ""}</div>` : ""}<button class="button primary save-rules">Salva regolamento</button><div class="inline-message success">${escapeHtml(message)}</div></article></div>`;
    $(".save-rules").addEventListener("click", () => { event.rules.text = $("#competitionRules").value.trim(); saveRuntime(organization); renderEventDashboard(organization, "Regolamento salvato e reso disponibile alla regia."); });
    if ($(".open-rules-file")) $(".open-rules-file").addEventListener("click", buttonEvent => openLocalFile(buttonEvent.currentTarget.dataset.blobKey));
    $("#rulesFile").addEventListener("change", async inputEvent => { const file = inputEvent.target.files[0]; if (!file) return; const blobKey = `${event.id}:regolamento`; try { await storeLocalFile(blobKey, file); } catch (error) { console.error(error); return alert("Non è stato possibile conservare il regolamento su questo dispositivo."); } event.rules.file = { name: file.name, size: file.size, type: file.type, blobKey, status: "stored-locally" }; saveRuntime(organization); renderEventDashboard(organization, "File del regolamento salvato sul dispositivo."); });
  }

  function renderEliminations(organization, message = "") {
    const event = ensureEventData(organization.events[0]);
    const qualificationSections = event.categories.map(category => {
      const ranked = event.participants.filter(item => item.categoryId === category.id).map(participant => ({ participant, result: participantRoundResult(event, participant.id, "qualification") })).filter(item => item.result.total !== null).sort((a, b) => b.result.total - a.result.total);
      if (!ranked.length) return "";
      return `<article class="dash-card elimination-card"><h3>${escapeHtml(category.name)}</h3>${ranked.map((item, index) => `<div><span>${index + 1}</span><strong>${escapeHtml(item.participant.name)}</strong><em>${item.result.total.toFixed(2)}</em><small>${item.participant.round === "final" ? "Finalista" : index < event.rounds.finalistsPerCategory ? "Zona qualificazione" : "Eliminato"}</small></div>`).join("")}</article>`;
    }).join("");
    const finalists = event.participants.filter(item => item.round === "final");
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Fasi di gara</p><h2>Eliminatorie e finale</h2><p>Le classifiche delle due fasi restano separate. La finale genera una nuova votazione senza cancellare lo storico delle eliminatorie.</p></div><span class="count-chip">${finalists.length} finalisti</span></div><article class="dash-card rounds-config"><label class="toggle"><input id="roundsEnabled" type="checkbox" ${event.rounds.enabled ? "checked" : ""}><span></span>Abilita eliminatorie</label><label>Finalisti per categoria<input id="finalistsCount" type="number" min="1" value="${event.rounds.finalistsPerCategory}"></label><button class="button ghost save-rounds">Salva impostazioni</button><button class="button primary generate-final" ${event.rounds.enabled ? "" : "disabled"}>Genera finale dalle classifiche</button></article><div class="inline-message success">${escapeHtml(message)}</div><div class="elimination-grid">${qualificationSections || '<article class="module-placeholder"><p>Le classifiche delle eliminatorie compariranno dopo i primi voti.</p></article>'}</div>`;
    $(".save-rounds").addEventListener("click", () => { event.rounds.enabled = $("#roundsEnabled").checked; event.rounds.finalistsPerCategory = Math.max(1, Number($("#finalistsCount").value) || 1); saveRuntime(organization); renderEliminations(organization, "Impostazioni delle fasi salvate."); });
    $(".generate-final").addEventListener("click", () => {
      if (!confirm("Generare la finale con i migliori atleti di ogni categoria? I punteggi delle eliminatorie resteranno archiviati.")) return;
      const selected = [];
      event.categories.forEach(category => {
        event.participants.filter(item => item.categoryId === category.id).map(participant => ({ participant, result: participantRoundResult(event, participant.id, "qualification") })).filter(item => item.result.complete).sort((a, b) => b.result.total - a.result.total).slice(0, event.rounds.finalistsPerCategory).forEach(item => selected.push(item.participant));
      });
      if (!selected.length) return alert("Non ci sono ancora risultati validi per generare la finale.");
      event.roundHistory.push({ id: uid("round"), round: "qualification", closedAt: new Date().toISOString(), finalists: selected.map(item => item.id) });
      selected.forEach((participant, index) => { participant.round = "final"; participant.status = "registered"; participant.attempt = 1; participant.order = index + 1; });
      event.control.round = "final"; event.control.currentParticipantId = selected[0].id; event.control.status = "setup"; event.control.repeatQueue = [];
      saveRuntime(organization); renderEliminations(organization, `${selected.length} finalisti inseriti nella nuova scaletta.`);
    });
  }

  function renderDashboardModule(module, organization, message = "") {
    const event = ensureEventData(organization.events[0]);
    const content = $("#moduleContent");
    if (module === "overview") {
      content.innerHTML = `${message ? `<div class="demo-message"><span>✓</span>${escapeHtml(message)}</div>` : ""}<div class="dash-stats">
        <article class="dash-stat"><span>Partecipanti</span><strong>${event.participants.length}</strong><small>${event.participants.filter(item => item.status === "completed").length} esibizioni completate</small></article>
        <article class="dash-stat"><span>Categorie</span><strong>${event.categories.length}</strong><small>${escapeHtml(event.disciplines.join(" · "))}</small></article>
        <article class="dash-stat"><span>Giudici attivi</span><strong>${event.judges.filter(item => item.active).length}</strong><small>${event.scoring.judgeCount} previsti</small></article>
        <article class="dash-stat"><span>Voti raccolti</span><strong>${event.scores.length}</strong><small>Salvati in questo dispositivo</small></article>
      </div><div class="dashboard-grid"><article class="dash-card"><h2>Preparazione evento</h2><div class="checklist">
        <div class="check-item"><span class="check-icon">✓</span><div><strong>Configurazione completata</strong><small>Categorie e criteri sono pronti.</small></div></div>
        <div class="check-item"><span class="check-icon ${event.participants.length ? "" : "todo"}">${event.participants.length ? "✓" : "2"}</span><div><strong>Carica i partecipanti</strong><small>${event.participants.length ? `${event.participants.length} atleti pronti` : "Inserimento manuale o importazione CSV"}.</small></div></div>
        <div class="check-item"><span class="check-icon ${event.judges.length ? "" : "todo"}">${event.judges.length ? "✓" : "3"}</span><div><strong>Assegna i giudici</strong><small>${event.judges.length ? `${event.judges.length} giudici configurati` : "Crea gli accessi e verifica i dispositivi"}.</small></div></div>
        <div class="check-item"><span class="check-icon ${event.scores.length ? "" : "todo"}">${event.scores.length ? "✓" : "4"}</span><div><strong>Prova generale</strong><small>${event.scores.length ? `${event.scores.length} voti registrati` : "Simula un atleta prima della gara"}.</small></div></div>
      </div></article><article class="dash-card"><h3>Azioni successive</h3><div class="quick-actions">
        <button class="quick-action" data-open-module="participants"><strong>Aggiungi partecipanti</strong><small>Manuale, CSV o foglio di calcolo</small></button>
        <button class="quick-action" data-open-module="judges"><strong>Configura giudici</strong><small>Ruoli, lingue e sostituzioni</small></button>
        <button class="quick-action" data-open-module="control"><strong>Apri prova regia</strong><small>Testa il flusso della competizione</small></button>
        <button class="quick-action demo-action" data-complete-demo><strong>Completa dati demo</strong><small>Crea automaticamente i giudici mancanti e dati di prova</small></button>
      </div></article></div>`;
      $$('[data-open-module]', content).forEach(button => button.addEventListener("click", () => activateDashboardModule(button.dataset.openModule, organization)));
      $("[data-complete-demo]", content).addEventListener("click", () => completeDemoData(organization));
      return;
    }
    if (module === "participants") return renderParticipants(organization);
    if (module === "judges") return renderJudges(organization);
    if (module === "stations") return renderStations(organization);
    if (module === "judge") return renderJudgeStation(organization);
    if (module === "presenter") return renderPresenter(organization);
    if (module === "staff") return renderStaff(organization);
    if (module === "control") return renderControl(organization);
    if (module === "eliminations") return renderEliminations(organization);
    if (module === "results") return renderResults(organization);
    if (module === "public") return renderPublic(organization);
    if (module === "event") return renderEventDashboard(organization);
    const definitions = {
      event: ["Evento", "Modifica sessioni, discipline, categorie, ordine di gara, pause e premiazioni."],
      public: ["Voto pubblico", event.publicVoting.enabled ? "Il voto pubblico è attivo per questo evento." : "Il voto pubblico è disattivato. Puoi abilitarlo dalla configurazione dell’evento."]
    };
    const [title, text] = definitions[module] || definitions.event;
    const rows = module === "event" ? event.categories.map((category, index) => `<div class="module-row"><span>${index + 1}. ${escapeHtml(category.name)}</span><small>Configurata</small></div>`).join("") : "";
    content.innerHTML = `<article class="module-placeholder"><p class="eyebrow">Modulo ScoreFlow</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p>${rows ? `<div class="module-list">${rows}</div>` : ""}</article>`;
  }

  function activateDashboardModule(module, organization) {
    $$(".dash-link").forEach(link => link.classList.toggle("active", link.dataset.module === module));
    renderDashboardModule(module, organization);
  }

  $("#orgName").addEventListener("input", event => {
    if (!$("#orgSlug").dataset.edited) $("#orgSlug").value = slugify(event.target.value);
  });
  $("#orgSlug").addEventListener("input", event => { event.target.dataset.edited = event.target.value ? "true" : ""; });
  $("#trialDays").addEventListener("input", updateTrialPreview);
  $("#primaryColor").addEventListener("input", event => applyBrandTheme(event.target.value, $("#accentColor").value));
  $("#accentColor").addEventListener("input", event => applyBrandTheme($("#primaryColor").value, event.target.value));
  $("#logoFile").addEventListener("change", event => readLogo(event.target.files[0]));
  $("#eventFiles").addEventListener("change", event => {
    const files = [...event.target.files];
    const valid = files.filter(file => file.size <= 10 * 1024 * 1024);
    selectedEventFiles.push(...valid.map(file => ({ id: uid("asset"), name: file.name, size: file.size, type: file.type })));
    renderEventFiles();
    event.target.value = "";
  });
  $("#addCategoryBtn").addEventListener("click", () => {
    addCategory($("#newCategory").value);
    $("#newCategory").value = "";
    $("#newCategory").focus();
  });
  $("#newCategory").addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); $("#addCategoryBtn").click(); }
  });
  $("#addCriterionBtn").addEventListener("click", () => addCriterionRow());
  $("#facTemplateBtn").addEventListener("click", applyFacTemplate);
  $("#newConfigBtn").addEventListener("click", () => { resetForm(); showConfigurator(); });
  $("#exportBtn").addEventListener("click", exportConfiguration);
  $("#configForm").addEventListener("submit", saveConfiguration);
  $$(".next").forEach(button => button.addEventListener("click", () => goToStep(currentStep + 1)));
  $$(".prev").forEach(button => button.addEventListener("click", () => goToStep(currentStep - 1)));
  $$(".step").forEach(button => button.addEventListener("click", () => goToStep(Number(button.dataset.stepTarget))));
  $("#criteriaRows").addEventListener("input", validateCriteria);
  $("#categoryList").addEventListener("input", validateCategories);
  $("#backToConfigBtn").addEventListener("click", showConfigurator);
  $$(".dash-link").forEach(link => link.addEventListener("click", () => {
    const organization = platform.organizations.find(item => item.id === editingOrganizationId);
    if (organization) activateDashboardModule(link.dataset.module, organization);
  }));

  defaultCriteria.forEach(addCriterionRow);
  ["Categoria Base", "Categoria Intermedia", "Categoria Avanzata"].forEach(name => addCategory(name));
  renderOrganizationList();
  updateTrialPreview();
  const activeOrganization = platform.organizations.find(item => item.id === platform.activeOrganizationId) || platform.organizations[0];
  if (activeOrganization) loadOrganization(activeOrganization.id, true);
})();
