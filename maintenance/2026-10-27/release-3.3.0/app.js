(() => {
  "use strict";

  const STORAGE_KEY = "scoreflow.platform.v1";
  const schemaVersion = 1;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uiLanguage = () => window.ScoreFlowI18n?.language || "it";
  const localeForLanguage = language => ({ it: "it-IT", en: "en-GB", fr: "fr-FR", es: "es-ES" })[language] || "it-IT";
  function publicDeviceId() {
    const key = "scoreflow.public.deviceId";
    let id = localStorage.getItem(key);
    if (!id) { id = uid("device"); localStorage.setItem(key, id); }
    return id;
  }

  const defaultCriteria = [
    "Coreografia", "Tecnica", "Tricks", "Immagine", "Presenza scenica", "Performance generale"
  ].map(name => ({ name, min: 0, max: 10, weight: 1, decimals: 1 }));

  const facCategories = [
    "Junior A", "Junior B - Base", "Teen - Base", "Adulti - Base", "Senior - Base",
    "Junior B - Intermedio", "Teen - Intermedio", "Adulti - Intermedio", "Senior - Intermedio",
    "Junior B - Avanzato", "Teen - Avanzato", "Adulti - Avanzato", "Senior - Avanzato",
    "Duo", "Istruttori / Allenatori", "Duo Professional", "Professional", "Elite"
  ];

  const onboardingProfiles = {
    aerial: {
      organization: "Aerial Motion Academy", event: "Sky Performance Cup", location: "Palazzetto dello Sport",
      primary: "#c1121f", accent: "#d4af37", disciplines: ["Tessuti", "Cerchio"],
      categories: ["Junior Base", "Adulti Base"],
      criteria: ["Tecnica", "Coreografia", "Difficoltà", "Immagine", "Presenza scenica", "Performance generale"]
    },
    dance: {
      organization: "Move Lab", event: "Stage & Motion Contest", location: "Teatro Comunale",
      primary: "#7c3aed", accent: "#f59e0b", disciplines: ["Danza contemporanea", "Urban", "Show dance"],
      categories: ["Kids", "Junior", "Teen", "Senior", "Duo", "Gruppi"],
      criteria: ["Tecnica", "Musicalità", "Coreografia", "Originalità", "Presenza scenica"]
    },
    gymnastics: {
      organization: "Gym Arena", event: "Gym Excellence Trophy", location: "Centro Sportivo",
      primary: "#0369a1", accent: "#22c55e", disciplines: ["Corpo libero", "Acrobatica", "Attrezzi"],
      categories: ["Allieve", "Junior", "Senior", "Squadre", "Open"],
      criteria: ["Difficoltà", "Esecuzione", "Precisione", "Composizione", "Controllo"]
    },
    generic: {
      organization: "Competition Lab", event: "Open Skills Championship", location: "Arena Eventi",
      primary: "#0f766e", accent: "#f97316", disciplines: ["Disciplina principale"],
      categories: ["Base", "Intermedio", "Avanzato", "Open"],
      criteria: ["Tecnica", "Creatività", "Presentazione", "Risultato complessivo"]
    }
  };

  const onboardingSizes = {
    compact: { judges: 3, participants: 6 },
    standard: { judges: 4, participants: 12 },
    large: { judges: 6, participants: 24 }
  };

  let organizerAccount=null;
  const trialCopy='14 giorni · 1 evento · 6 atleti complessivi · 3 giudici · 2 categorie · 10 tentativi d’invio email, prove incluse. Iscrizioni pubbliche e allegati necessari inclusi. Nessuna carta richiesta.';
  async function accountApi(action,body) {
    const response=await fetch(`/api/account/${action}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json();
    if(!response.ok) throw new Error(result.message || 'Servizio account non disponibile. Riprova.');
    return result;
  }
  function acceptEntitlements(organization,entitlements) {
    if(!entitlements) return;
    organization.entitlements=entitlements;
    organization.subscription={...organization.subscription,...entitlements};
    organization.cloud.accountManaged=true;
    organization.cloud.serverOffset=Date.parse(entitlements.serverTime)-Date.now();
    delete organization.cloud.secret;
  }
  function trialReadOnly(organization) {
    const e=organization?.entitlements;
    return Boolean(e && (e.readOnly || (e.status!=='active' && Date.parse(e.trialEndsAt)<=Date.now()+(organization.cloud?.serverOffset || 0))));
  }
  function showAccountScreen(mode='login',token='') {
    hideOnboarding();
    $('#dashboard').classList.add('hidden');
    $('main.layout').classList.add('hidden');
    let screen=$('#accountScreen');
    if(!screen) {screen=document.createElement('section');screen.id='accountScreen';screen.className='onboarding';document.body.append(screen);}
    screen.classList.remove('hidden');
    const signup=mode==='signup', recovery=mode==='recover', reset=mode==='reset', verify=mode==='verify';
    screen.innerHTML=`<div class="onboarding-card account-card"><div class="account-language"><label class="language-picker"><span>Lingua</span><select data-scoreflow-language><option value="it">Italiano</option><option value="en">English</option><option value="fr">Français</option><option value="es">Español</option></select></label></div><p class="eyebrow">ScoreFlow · Account società</p><h1>${signup?'Prova ScoreFlow per 14 giorni':recovery?'Recupera la password':reset?'Scegli una nuova password':verify?'Conferma il tuo account':'Accedi alla tua società'}</h1><p>${escapeHtml(trialCopy)}</p><form id="accountForm">${reset||verify?'':`<label>Email della società<input id="accountEmail" type="email" autocomplete="email" maxlength="254" required></label>`}${recovery||verify?'':`<label>Password<span class="password-control"><input id="accountPassword" type="password" autocomplete="${signup||reset?'new-password':'current-password'}" minlength="${signup||reset?8:1}" maxlength="128" required><button id="accountPasswordToggle" class="password-visibility" type="button" aria-label="Mostra password" aria-controls="accountPassword" aria-pressed="false"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="password-eye-slash" d="m3 3 18 18"/></svg></button></span>${signup||reset?'<small>Almeno 8 caratteri.</small>':''}</label>`}<button class="button primary" type="submit">${signup?'Crea account':recovery?'Invia collegamento':reset?'Salva nuova password':verify?'Conferma email':'Accedi'}</button><p id="accountMessage" role="status" aria-live="polite"></p></form><div class="onboarding-actions"><button class="button ghost" id="accountLogin" type="button">Accedi</button><button class="button ghost" id="accountSignup" type="button">Crea account e prova</button><button class="button ghost" id="accountRecover" type="button">Password dimenticata?</button></div></div>`;
    window.ScoreFlowI18n?.translateDOM(screen);
    const passwordToggle=$('#accountPasswordToggle');
    if(passwordToggle) passwordToggle.onclick=()=>{
      const input=$('#accountPassword'), visible=input.type==='password';
      input.type=visible?'text':'password';
      passwordToggle.setAttribute('aria-pressed',String(visible));
      passwordToggle.setAttribute('aria-label',visible?'Nascondi password':'Mostra password');
    };
    $('#accountLogin').onclick=()=>showAccountScreen('login');
    $('#accountSignup').onclick=()=>showAccountScreen('signup');
    $('#accountRecover').onclick=()=>showAccountScreen('recover');
    $('#accountForm').onsubmit=async event=>{
      event.preventDefault();
      const button=$('#accountForm button[type=submit]');button.disabled=true;
      $('#accountMessage').textContent='Operazione in corso…';
      try {
        const result=await accountApi(mode,{email:$('#accountEmail')?.value,password:$('#accountPassword')?.value,token,language:uiLanguage()});
        if(signup||recovery) {$('#accountMessage').textContent=result.message;return;}
        history.replaceState({},'',window.location.pathname);
        await restoreOrganizerAccount();
      } catch(error) {$('#accountMessage').textContent=error.message;}
      finally {button.disabled=false;}
    };
  }
  async function restoreOrganizerAccount() {
    const result=await accountApi('session');
    organizerAccount=result.user;
    if(!result.user) return false;
    $('#accountScreen')?.classList.add('hidden');
    if(result.organization) {
      const remote=result.organization;
      const org=remote.state;
      org.cloud={tenantKey:remote.tenantKey,revision:remote.revision,status:'online',accountManaged:true};
      acceptEntitlements(org,remote.entitlements);
      const existing=platform.organizations.findIndex(x=>x.cloud?.tenantKey===remote.tenantKey);
      if(existing>=0) platform.organizations[existing]=org;else platform.organizations.push(org);
      platform.activeOrganizationId=org.id;persistPlatform();renderOrganizationList();loadOrganization(org.id,true);
    } else {resetForm();showOnboarding();}
    return true;
  }
  function addAccountControls() {
    if($('#organizerControls')) return;
    const controls=document.createElement('div');controls.id='organizerControls';controls.className='organizer-controls';
    controls.innerHTML='<button class="button ghost" id="accountOpen">Account società</button><button class="button ghost" id="accountExport">Esporta i miei dati</button><button class="button ghost" id="accountLogout">Esci dall’account</button>';
    document.body.append(controls);
    $('#accountOpen').onclick=()=>showAccountScreen('login');
    $('#accountExport').onclick=async()=>{
      const org=platform.organizations.find(x=>x.id===editingOrganizationId);
      if(!org){showToast('Apri prima la tua società.');return;}
      const response=await fetch(cloudStateEndpoint(org.cloud),{headers:cloudHeaders(org.cloud)});
      if(!response.ok){showToast('Accedi per esportare i dati salvati.');return;}
      const data=await response.json();
      const registrations=await fetch(`/api/tenants/${encodeURIComponent(org.cloud.tenantKey)}/registrations`,{headers:cloudHeaders(org.cloud)});
      if(!registrations.ok){showToast('Esportazione iscrizioni non disponibile. Riprova.');return;}
      const blob=new Blob([JSON.stringify({organization:data.state,registrations:await registrations.json()},null,2)],{type:'application/json'});
      const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=`${org.slug}-dati.json`;link.click();URL.revokeObjectURL(url);
    };
    $('#accountLogout').onclick=async()=>{
      try {await accountApi('logout',{});}catch(error){showToast(error.message);return;}
      clearInterval(cloudPollTimer);clearTimeout(cloudSyncTimer);organizerAccount=null;
      platform.organizations=platform.organizations.filter(x=>!x.cloud?.accountManaged);
      platform.activeOrganizationId=null;editingOrganizationId=null;persistPlatform();renderOrganizationList();showAccountScreen('login');
    };
  }
  // Read-only mode guards event handlers too, including controls generated after navigation.
  document.addEventListener('submit',event=>{
    const org=platform.organizations.find(x=>x.id===editingOrganizationId);
    if(trialReadOnly(org) && !event.target.matches('#licenseForm,#accountForm')) {event.preventDefault();event.stopImmediatePropagation();showToast('Prova terminata: puoi consultare ed esportare i dati.');}
  },true);
  document.addEventListener('click',event=>{
    const org=platform.organizations.find(x=>x.id===editingOrganizationId);
    const button=event.target.closest('button');
    if(!button || !trialReadOnly(org) || !button.closest('#moduleContent')) return;
    const allowed=button.matches('[data-open-module],.station-back,.station-launch,.open-rules-file,[data-open-file],[data-athlete-open],#exportResultsBtn') || /^(Apri|Scarica|Esporta|Visualizza|Indietro)/i.test(button.textContent.trim());
    if(!allowed && !button.closest('#licenseForm')){event.preventDefault();event.stopImmediatePropagation();showToast('Prova terminata: i dati sono disponibili in sola lettura.');}
  },true);

  let platform = loadPlatform();
  let currentStep = 1;
  let editingOrganizationId = null;
  let logoDataUrl = "";
  let selectedLogoFile = null;
  let selectedEventFiles = [];
  let controlRefreshTimer = null;
  let cloudSyncTimer = null;
  let cloudPollTimer = null;
  let cloudSyncInFlight = false;
  let currentDashboardModule = "overview";
  let activeJudgeSession = null;
  let onboardingProfile = "aerial";
  let onboardingSize = "compact";
  let registrationCountdownTimer = null;

  function uid(prefix) {
    const random = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}_${random}`;
  }

  function cloudSecret() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  }

  function ensureCloudIdentity(organization) {
    organization.cloud = organization.cloud || {};
    organization.cloud.tenantKey = organization.cloud.tenantKey || organization.slug;
    if (!organization.cloud.accountManaged) organization.cloud.secret = organization.cloud.secret || cloudSecret();
    organization.cloud.revision = Number(organization.cloud.revision) || 0;
    return organization.cloud;
  }

  function isRoleDevice(organization) {
    return Boolean(organization?.cloud?.accessToken && organization?.cloud?.role);
  }

  function cloudHeaders(cloud, json = false) {
    const headers = {};
    if (json) headers["Content-Type"] = "application/json";
    if (cloud?.secret) headers["X-ScoreFlow-Key"] = cloud.secret;
    else if (cloud?.accessToken) headers["X-ScoreFlow-Access"] = cloud.accessToken;
    return headers;
  }

  function cloudStateEndpoint(cloud) {
    const action = cloud?.accessToken ? "device-state" : "state";
    return `/api/tenants/${encodeURIComponent(cloud.tenantKey)}/${action}`;
  }

  function organizationForCloud(organization) {
    const state = JSON.parse(JSON.stringify(organization));
    state.cloud = { tenantKey: organization.cloud?.tenantKey || organization.slug };
    return state;
  }

  function mergeCollection(left = [], right = [], keyForItem = item => item.id, dateField = "updatedAt") {
    const merged = new Map();
    [...left, ...right].forEach(item => {
      const key = keyForItem(item);
      const previous = merged.get(key);
      if (!previous || String(item?.[dateField] || item?.submittedAt || "") >= String(previous?.[dateField] || previous?.submittedAt || "")) merged.set(key, item);
    });
    return [...merged.values()];
  }

  function mergeCloudOrganization(local, remote) {
    const localTime = new Date(local.updatedAt || 0).getTime();
    const remoteTime = new Date(remote.updatedAt || 0).getTime();
    const base = JSON.parse(JSON.stringify(remoteTime > localTime ? remote : local));
    const localEvent = ensureEventData(local.events[0]);
    const remoteEvent = ensureEventData(remote.events[0]);
    const targetEvent = ensureEventData(base.events[0]);
    targetEvent.scores = mergeCollection(localEvent.scores, remoteEvent.scores, score => `${score.participantId}:${score.judgeId}:${score.round || "qualification"}:${score.attempt || 1}`, "submittedAt");
    targetEvent.publicVotes = mergeCollection(localEvent.publicVotes, remoteEvent.publicVotes);
    targetEvent.scoreHistory = mergeCollection(localEvent.scoreHistory, remoteEvent.scoreHistory);
    base.id = local.id;
    base.cloud = { ...local.cloud };
    return base;
  }

  async function registerCloudTenant(organization) {
    if (isRoleDevice(organization)) return;
    const cloud = ensureCloudIdentity(organization);
    const response = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantKey: cloud.tenantKey, name: organization.name, secret: cloud.secret, state: organizationForCloud(organization) })
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.message || "Registrazione cloud non disponibile"), {status:response.status});
    acceptEntitlements(organization,result.entitlements);
    cloud.revision = Number(result.revision) || 1;
    cloud.status = "online";
    cloud.lastSyncedAt = new Date().toISOString();
    persistPlatform();
  }

  async function pushCloudState(organization, retry = true) {
    if (cloudSyncInFlight) return queueCloudSync(organization);
    const cloud = isRoleDevice(organization) ? organization.cloud : ensureCloudIdentity(organization);
    cloudSyncInFlight = true;
    try {
      if (!cloud.revision) await registerCloudTenant(organization);
      const response = await fetch(cloudStateEndpoint(cloud), {
        method: "PUT",
        headers: cloudHeaders(cloud, true),
        body: JSON.stringify({ revision: cloud.revision, state: organizationForCloud(organization) })
      });
      if (response.status === 409 && retry) {
        const preview=await response.clone().json();
        if(preview.error!=="revision-conflict") throw Object.assign(new Error(preview.message || "Limite della prova raggiunto"),{status:409,trialRejected:true});
        const conflict = await response.json();
        const merged = mergeCloudOrganization(organization, conflict.state);
        merged.cloud = { ...cloud, revision: Number(conflict.revision) };
        const index = platform.organizations.findIndex(item => item.id === organization.id);
        if (index >= 0) platform.organizations[index] = merged;
        editingOrganizationId = merged.id;
        persistPlatform();
        cloudSyncInFlight = false;
        return pushCloudState(merged, false);
      }
      if (!response.ok) {const problem=await response.json();throw Object.assign(new Error(problem.message || "Sincronizzazione non disponibile"), { status: response.status,trialRejected:response.status===403 || response.status===401 });}
      const result = await response.json();
      cloud.revision = Number(result.revision);
      cloud.status = "online";
      cloud.lastSyncedAt = new Date().toISOString();
      persistPlatform();
    } catch (error) {
      cloud.status = error.status === 503 ? "setup-required" : "offline";
      if(error.trialRejected){
        const response=await fetch(cloudStateEndpoint(cloud),{headers:cloudHeaders(cloud)});
        if(response.ok){const result=await response.json();Object.assign(organization,result.state);organization.cloud=cloud;cloud.revision=Number(result.revision);acceptEntitlements(organization,result.entitlements);renderDashboardModule(currentDashboardModule,organization);}
        showToast(error.message);
      }
      console.warn("ScoreFlow cloud", error.message);
      persistPlatform();
    } finally {
      cloudSyncInFlight = false;
    }
  }

  function queueCloudSync(organization) {
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => pushCloudState(organization), 350);
  }

  async function pullCloudState(organization) {
    const cloud = organization.cloud;
    if (!cloud?.tenantKey || (!cloud?.secret && !cloud?.accessToken && !cloud?.accountManaged) || !cloud.revision) return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
    try {
      const response = await fetch(cloudStateEndpoint(cloud), { headers: cloudHeaders(cloud) });
      if (!response.ok) return;
      const result = await response.json();
      acceptEntitlements(organization,result.entitlements);
      updateTrialBanner(organization);
      if (Number(result.revision) <= Number(cloud.revision)) return;
      const remote = mergeCloudOrganization(organization, result.state);
      remote.cloud = { ...cloud, revision: Number(result.revision), status: "online", lastSyncedAt: new Date().toISOString() };
      const index = platform.organizations.findIndex(item => item.id === organization.id);
      if (index >= 0) platform.organizations[index] = remote;
      editingOrganizationId = remote.id;
      persistPlatform();
      renderDashboardModule(currentDashboardModule, remote);
    } catch (error) {
      console.warn("Aggiornamento cloud non disponibile", error.message);
    }
  }

  function startCloudPolling(organization) {
    clearInterval(cloudPollTimer);
    if (!isRoleDevice(organization)) {
      ensureCloudIdentity(organization);
      queueCloudSync(organization);
    }
    cloudPollTimer = setInterval(() => {
      const current = platform.organizations.find(item => item.id === organization.id);
      if (current) pullCloudState(current);
    }, 2000);
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
    updateConnectionStatus();
  }

  function ensureEventData(event) {
    event.assets = Array.isArray(event.assets) ? event.assets : [];
    event.participants = Array.isArray(event.participants) ? event.participants : [];
    event.judges = Array.isArray(event.judges) ? event.judges : [];
    event.scores = Array.isArray(event.scores) ? event.scores : [];
    event.publicVotes = Array.isArray(event.publicVotes) ? event.publicVotes : [];
    event.publicVoting = event.publicVoting || { enabled: false, oneVotePerDevice: true };
    event.publicVoting.qrEnabled = Boolean(event.publicVoting.qrEnabled);
    event.resultsValidated = event.resultsValidated || {};
    event.scoreHistory = Array.isArray(event.scoreHistory) ? event.scoreHistory : [];
    event.roundHistory = Array.isArray(event.roundHistory) ? event.roundHistory : [];
    event.notifications = Array.isArray(event.notifications) ? event.notifications : [];
    event.rules = event.rules || { text: "", file: null };
    event.registration = event.registration || {
      enabled: false,
      preRegistrationOpensAt: "",
      preRegistrationClosesAt: "",
      registrationClosesAt: "",
      instructions: "Compila tutti i campi richiesti. Potrai aggiornare la scheda fino alla chiusura delle iscrizioni."
    };
    event.rounds = event.rounds || { enabled: false, finalistsPerCategory: 3, qualificationLabel: "Eliminatorie", finalLabel: "Finale" };
    event.control = event.control || { currentParticipantId: null, status: "setup" };
    event.control.mode = event.control.mode || "automatic";
    event.control.repeatQueue = Array.isArray(event.control.repeatQueue) ? event.control.repeatQueue : [];
    event.presenter = event.presenter || { selectedParticipantId: null, notes: {} };
    event.presenter.notes = event.presenter.notes || {};
    event.participants.forEach((participant, index) => {
      participant.order = Number(participant.order) || index + 1;
      participant.round = participant.round || "qualification";
      participant.attempt = Number(participant.attempt) || 1;
      participant.attachments = participant.attachments || {};
      participant.description = participant.description || "";
      participant.choreographyTitle = participant.choreographyTitle || "";
      participant.choreographyTheme = participant.choreographyTheme || "";
      participant.specialRequests = participant.specialRequests || "";
      participant.performanceDuration = musicDurationFor(participant);
    });
    event.judges.forEach(judge => { judge.lastActivityAt = judge.lastActivityAt || null; });
    return event;
  }

  function formatBytes(bytes = 0) {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatDuration(seconds = 0) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remaining = total % 60;
    return hours ? `${hours} h ${String(minutes).padStart(2, "0")} min` : `${minutes}:${String(remaining).padStart(2, "0")}`;
  }

  function musicDurationFor(item = {}) {
    return Math.max(0, Number(item.attachments?.music?.durationSeconds) || 0);
  }

  function mediaDuration(file) {
    return new Promise(resolve => {
      const media = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
      const url = URL.createObjectURL(file);
      media.preload = "metadata";
      media.onloadedmetadata = () => { const duration = Number.isFinite(media.duration) ? media.duration : 0; URL.revokeObjectURL(url); resolve(duration); };
      media.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      media.src = url;
    });
  }

  function pushNotification(event, participant, text) {
    event.notifications.unshift({ id: uid("notification"), participantId: participant?.id || null, text, source: "staff", createdAt: new Date().toISOString() });
    event.notifications = event.notifications.slice(0, 50);
  }

  function operationalNotifications(event) {
    return event.notifications.slice(0, 5).map(item => {
      const participant = event.participants.find(entry => entry.id === item.participantId);
      return `<button class="ops-notification" data-notification-participant="${escapeHtml(item.participantId || "")}"><span>!</span><div><strong>${escapeHtml(item.text)}</strong><small>${participant ? escapeHtml(participant.name) : "Aggiornamento evento"} · ${new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div></button>`;
    }).join("");
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
    queueCloudSync(organization);
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

  async function uploadCloudFile(organization, file, purpose = "documents") {
    if (!file) throw new Error("Nessun file selezionato.");
    if (file.size > 50 * 1024 * 1024) throw new Error("Il file supera il limite di 50 MB.");
    const cloud = isRoleDevice(organization) ? organization.cloud : ensureCloudIdentity(organization);
    if (!cloud.secret && !cloud.accountManaged) throw new Error("Solo l’organizzatore può caricare nuovi file.");
    if (!cloud.revision) await registerCloudTenant(organization);
    const response = await fetch(`/api/tenants/${encodeURIComponent(cloud.tenantKey)}/files`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        ...cloudHeaders(cloud),
        "X-File-Name": encodeURIComponent(file.name),
        "X-File-Purpose": purpose
      },
      body: file
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Caricamento cloud non riuscito.");
    return { cloudPath: result.path, provider: result.provider, uploadedAt: new Date().toISOString() };
  }

  async function cloudFileUrl(organization, cloudPath) {
    const cloud = isRoleDevice(organization) ? organization.cloud : ensureCloudIdentity(organization);
    const response = await fetch(`/api/tenants/${encodeURIComponent(cloud.tenantKey)}/files/sign`, {
      method: "POST",
      headers: cloudHeaders(cloud, true),
      body: JSON.stringify({ path: cloudPath })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.url) throw new Error(result.message || "File cloud non disponibile.");
    return result.url;
  }

  async function openLocalFile(id) {
    const database = await openFileDatabase();
    const record = await new Promise((resolve, reject) => {
      const request = database.transaction("files", "readonly").objectStore("files").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    if (!record?.blob) return showToast("Il file non è disponibile su questo dispositivo. Ricaricalo dalla scheda atleta.");
    const url = URL.createObjectURL(record.blob);
    const opened = window.open(url, "_blank");
    if (!opened) {
      const link = document.createElement("a"); link.href = url; link.download = record.name || "allegato"; link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function openManagedFile(organization, attachment) {
    if (attachment?.cloudPath) {
      const opened = window.open("", "_blank");
      try {
        const url = await cloudFileUrl(organization, attachment.cloudPath);
        if (opened) opened.location = url;
        else window.location.href = url;
      } catch (error) {
        opened?.close();
        showToast(error.message);
      }
      return;
    }
    if (attachment?.blobKey) return openLocalFile(attachment.blobKey);
    showToast("Il file non è disponibile. Caricalo nuovamente dalla scheda.");
  }

  async function previewLocalVideo(id, title = "Video entry") {
    const database = await openFileDatabase();
    const record = await new Promise((resolve, reject) => {
      const request = database.transaction("files", "readonly").objectStore("files").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    if (!record?.blob) return showToast("Il video non è disponibile su questo dispositivo.");
    const url = URL.createObjectURL(record.blob);
    const modal = document.createElement("div");
    modal.className = "media-modal";
    modal.innerHTML = `<div class="media-modal-card"><div><strong>${escapeHtml(title)}</strong><button type="button" aria-label="Chiudi">×</button></div><video controls playsinline preload="metadata" src="${url}"></video><small>Il video parte soltanto quando premi Play.</small></div>`;
    document.body.appendChild(modal);
    const close = () => { URL.revokeObjectURL(url); modal.remove(); };
    modal.addEventListener("click", event => { if (event.target === modal || event.target.closest("button")) close(); });
  }

  async function previewManagedVideo(organization, attachment, title = "Video entry") {
    if (!attachment?.cloudPath) return previewLocalVideo(attachment?.blobKey, title);
    try {
      const url = await cloudFileUrl(organization, attachment.cloudPath);
      const modal = document.createElement("div");
      modal.className = "media-modal";
      modal.innerHTML = `<div class="media-modal-card"><div><strong>${escapeHtml(title)}</strong><button type="button" aria-label="Chiudi">×</button></div><video controls playsinline preload="metadata" src="${url}"></video><small>Il video parte soltanto quando premi Play.</small></div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", event => { if (event.target === modal || event.target.closest("button")) modal.remove(); });
    } catch (error) {
      showToast(error.message);
    }
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
    selectedLogoFile = file;
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
    const trialDays = 14;
    const trialEnd = new Date(now.getTime() + trialDays * 86400000);
    const organizationId = editingOrganizationId || uid("org");
    const existing = platform.organizations.find(item => item.id === organizationId);
    const eventId = existing?.events?.[0]?.id || uid("event");

    return {
      id: organizationId,
      slug: $("#orgSlug").value.trim(),
      name: $("#orgName").value.trim(),
      language: $("#language").value,
      brand: { primaryColor: $("#primaryColor").value, accentColor: $("#accentColor").value, logoUrl: $("#logoUrl").value.trim(), logoDataUrl, logoFile: existing?.brand?.logoFile || null },
      entitlements: existing?.entitlements,
      subscription: {
        plan: existing?.subscription?.plan || "trial",
        status: existing?.subscription?.status || "trialing",
        trialDays,
        trialStartedAt: existing?.subscription?.trialStartedAt || now.toISOString(),
        trialEndsAt: existing?.subscription?.trialEndsAt || trialEnd.toISOString(),
        billingProvider: "not-configured"
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
        assets: selectedEventFiles.map(({ file, ...asset }) => ({ ...asset, id: asset.id || uid("asset"), status: asset.cloudPath ? "stored-in-cloud" : asset.status || "pending-cloud-upload" })),
        competitionRules: existing?.events?.[0]?.competitionRules,
        scoring: {
          aggregation: $("#aggregation").value,
          judgeCount: Number($("#judgeCount").value),
          minimumJudges: Number($("#minimumJudges").value),
          criteria: getCriteria(),
          penalties: { enabled: $("#penaltiesEnabled").checked, noteRequired: $("#penaltyNoteRequired").checked },
          judgeSubstitutionLog: $("#judgeSubstitutionLog").checked
        },
        publicVoting: { enabled: $("#publicVoting").checked, qrEnabled: $("#publicVoting").checked && $("#publicQr").checked, oneVotePerDevice: true },
        participants: existing?.events?.[0]?.participants || [],
        judges: existing?.events?.[0]?.judges || [],
        scores: existing?.events?.[0]?.scores || [],
        scoreHistory: existing?.events?.[0]?.scoreHistory || [],
        roundHistory: existing?.events?.[0]?.roundHistory || [],
        notifications: existing?.events?.[0]?.notifications || [],
        presenter: existing?.events?.[0]?.presenter || { selectedParticipantId: null, notes: {} },
        publicVotes: existing?.events?.[0]?.publicVotes || [],
        resultsValidated: existing?.events?.[0]?.resultsValidated || {},
        rules: existing?.events?.[0]?.rules || { text: "", file: null },
        rounds: existing?.events?.[0]?.rounds || { enabled: false, finalistsPerCategory: 3, qualificationLabel: "Eliminatorie", finalLabel: "Finale" },
        control: existing?.events?.[0]?.control || { currentParticipantId: null, status: "setup" },
        registration: existing?.events?.[0]?.registration || { enabled: false, preRegistrationOpensAt: "", preRegistrationClosesAt: "", registrationClosesAt: "", instructions: "Compila tutti i campi richiesti. Potrai aggiornare la scheda fino alla chiusura delle iscrizioni." },
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
      ["Prova gratuita", `${org.subscription.trialDays} giorni`, "Durata fissa verificata dal server"],
      ["Evento", event.name, `${event.startsAt} → ${event.endsAt}`],
      ["Categorie", event.categories.length, event.disciplines.join(" · ")],
      ["Giuria", `${event.scoring.judgeCount} giudici`, `${event.scoring.minimumJudges} voti minimi`],
      ["Valutazione", `${event.scoring.criteria.length} criteri`, event.scoring.aggregation]
    ];
    $("#summary").innerHTML = items.map(([label, value, note]) => `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(String(note || ""))}</small></article>`).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function localDateTimeValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function isoFromLocal(value) {
    return value ? new Date(value).toISOString() : "";
  }

  function registrationLink(organization) {
    return `${window.location.origin}${window.location.pathname}?register=${encodeURIComponent(organization.cloud?.tenantKey || organization.slug)}`;
  }

  async function adminRegistrations(organization) {
    const cloud = ensureCloudIdentity(organization);
    const event = ensureEventData(organization.events[0]);
    const response = await fetch(`/api/tenants/${encodeURIComponent(cloud.tenantKey)}/registrations?eventId=${encodeURIComponent(event.id)}`, { headers: cloudHeaders(cloud) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Impossibile caricare le iscrizioni.");
    return result.registrations || [];
  }

  async function reviewRegistration(organization, entry, action, details = {}) {
    const cloud = ensureCloudIdentity(organization);
    const response = await fetch(`/api/tenants/${encodeURIComponent(cloud.tenantKey)}/registrations`, {
      method: "POST", headers: cloudHeaders(cloud, true),
      body: JSON.stringify({ registrationId: entry.id, athleteId: entry.athleteId, action, ...details })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Operazione di revisione non riuscita.");
    return result.registration;
  }

  function registrationToParticipant(event, entry) {
    const profile = entry.profile || {};
    const attachments = profile.attachments || {};
    const existing = event.participants.find(item => item.registrationId === entry.id && item.registrationAthleteId === entry.athleteId)
      || event.participants.find(item => item.email === entry.email && item.name === `${profile.firstName || ""} ${profile.lastName || ""}`.trim());
    const participant = existing || { id: uid("participant"), order: event.participants.length + 1, status: "registered", round: "qualification", attempt: 1, attachments: {} };
    Object.assign(participant, {
      registrationId: entry.id, registrationAthleteId: entry.athleteId || profile.id, email: entry.email, name: `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
      club: profile.schoolName || "", schoolName: profile.schoolName || "", coachName: profile.coachName || "", coachPhone: profile.coachPhone || "",
      phone: profile.phone || "", birthDate: profile.birthDate || "", birthPlace: profile.birthPlace || "", gender: profile.gender || "",
      taxCode: profile.taxCode || "", nationality: profile.nationality || "", address: profile.address || "", city: profile.city || "",
      categoryId: profile.categoryId || "", discipline: profile.discipline || "", level: profile.level || "",
      choreographyTitle: profile.choreographyTitle || "", choreographyTheme: profile.choreographyTheme || "", description: profile.description || "",
      specialRequests: profile.specialRequests || "", performanceDuration: Number(attachments.music?.durationSeconds) || 0,
      attachments, registrationStatus: entry.status, registrationUpdatedAt: entry.updated_at
    });
    if (!existing) event.participants.push(participant);
    return participant;
  }

  async function emailSettingsRequest(organization, method = "GET", body = null, test = false) {
    const cloud = ensureCloudIdentity(organization);
    const response = await fetch(`/api/tenants/${encodeURIComponent(cloud.tenantKey)}/email-settings${test ? "/test" : ""}`, {
      method, headers: cloudHeaders(cloud, method !== "GET"), ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Impossibile aggiornare il collegamento email.");
    return result;
  }

  function closeDashboardNavigation() {
    document.body.classList.remove("navigation-open");
    const button = $("#navToggle");
    if (button) { button.setAttribute("aria-expanded", "false"); button.setAttribute("aria-label", "Apri navigazione"); }
  }

  function updateConnectionStatus() {
    const target = $("#cloudStatus"); if (!target) return;
    const org = platform.organizations.find(item => item.id === editingOrganizationId);
    const state = org?.cloud?.status;
    target.className = `connection-status ${state === "online" ? "online" : state === "offline" || state === "setup-required" ? "offline" : "connecting"}`;
    target.textContent = state === "online" ? "Cloud connesso" : state === "offline" || state === "setup-required" ? "Salvato su questo dispositivo" : "Connessione al cloud…";
    target.title = state === "online" ? "Ultima sincronizzazione cloud riuscita" : "La connessione verrà riprovata. Conserva questo dispositivo fino alla sincronizzazione.";
  }

  function initializeExperience() {
    $$(".dash-link").forEach(link => {
      link.innerHTML = `<span class="nav-icon">${sfIcon(link.dataset.module)}</span><span>${link.textContent}</span>`;
    });
    $("#navToggle").innerHTML = sfIcon("menu");
    $("#navToggle").addEventListener("click", () => {
      const open = document.body.classList.toggle("navigation-open");
      $("#navToggle").setAttribute("aria-expanded", String(open));
      $("#navToggle").setAttribute("aria-label", open ? "Chiudi navigazione" : "Apri navigazione");
      if (open) $(".dashboard-nav .dash-link.active")?.focus();
    });
    $("#navBackdrop").addEventListener("click", closeDashboardNavigation);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("navigation-open")) { closeDashboardNavigation(); $("#navToggle").focus(); } });
  }

  function overviewHero(event) {
    const ready = [event.categories.length > 0 && event.scoring.criteria.length > 0,
      event.participants.length > 0, event.judges.filter(j => j.active).length >= event.scoring.minimumJudges, event.scores.length > 0].filter(Boolean).length;
    return `<section class="overview-hero"><div class="overview-copy"><span class="hero-kicker">${sfIcon("spark")} Il tuo centro operativo</span><h2>Ogni dettaglio al suo posto.<br><em>Spazio alla competizione.</em></h2><p>Dalle iscrizioni all’ultimo voto: gestisci il tuo evento con una visione chiara, in un unico spazio.</p><div class="hero-actions"><button class="button primary" data-open-module="control">${sfIcon("control")} Apri regia ${sfIcon("arrow")}</button><button class="button hero-secondary" data-open-module="stations">Collega le postazioni</button></div></div><div class="preparation-ring" style="--progress:${ready * 25}%"><div><strong>${ready}<small>/4</small></strong><span>passaggi completati</span></div></div></section>`;
  }

  function showToast(message) {
    $(".sf-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "sf-toast"; toast.setAttribute("role", "status");
    toast.innerHTML = `<span class="toast-symbol">${sfIcon("spark")}</span><div><strong>ScoreFlow</strong><p></p></div><button type="button" aria-label="Chiudi messaggio">${sfIcon("close")}</button>`;
    $("p", toast).textContent = String(message || "");
    $("button", toast).addEventListener("click", () => toast.remove());
    document.body.append(toast);
    setTimeout(() => toast.remove(), 9000);
  }

  function sfIcon(name) {
    const paths = {
      overview: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
      event: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
      participants: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
      registrations: '<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
      judges: '<path d="m14 3 7 7M11 6l7 7M8 9l7 7M2 22l10-10M15 22h7"/>',
      control: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
      stations: '<rect x="3" y="3" width="14" height="12" rx="2"/><path d="M7 21h6M10 15v6"/><rect x="17" y="11" width="5" height="10" rx="1"/>',
      eliminations: '<path d="M3 3h5v6H3M3 15h5v6H3M8 6h5v12H8M13 12h8"/>',
      results: '<path d="M8 21V11H3v10M16 21V3h-5v18M21 21v-6h-5M2 21h20"/>',
      public: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
      arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
      check: '<path d="m5 12 4 4L19 6"/>', spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
      trophy: '<path d="M8 3h8v5a4 4 0 0 1-8 0ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 12v7M8 21h8M9 19h6"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
      presenter: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
      staff: '<path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4M9 12l3 3L22 5"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.overview}</svg>`;
  }

  function organizationEmailPanel(settings, error = "") {
    const s = settings || {}, managed = s.mode !== "custom";
    return `<article class="dash-card email-center"><div class="section-heading"><div><p class="eyebrow">Comunicazioni</p><h3>Le email del tuo evento, senza complicazioni.</h3><p>Inserisci il nome dell’organizzazione e dove vuoi ricevere le risposte. Al collegamento email pensa ScoreFlow.</p></div><span id="emailStatus" class="count-chip">${s.configured ? "Invio attivo" : "Da completare"}</span></div>
      <div class="email-service-note"><span class="sf-icon">${sfIcon("mail")}</span><div><strong>Invio gestito da ScoreFlow</strong><p>${s.managedReady ? "Il servizio centrale è disponibile per gli eventi con licenza attiva." : "Il servizio centrale è in attivazione. Puoi già salvare i tuoi contatti; le comunicazioni rimangono nello storico finché l’invio non è disponibile."}</p></div></div>
      <form id="organizationEmailSettings" class="operational-form">
        <label>Nome dell’organizzazione<input name="senderName" maxlength="100" value="${escapeHtml(s.senderName || "")}" placeholder="Es. Freestyle Academy"></label>
        <label>Email di contatto<input name="replyTo" type="email" maxlength="254" value="${escapeHtml(s.replyTo || "")}" placeholder="segreteria@organizzazione.it"><small>Le risposte degli iscritti arriveranno qui.</small></label>
        <label class="toggle wide"><input name="enabled" type="checkbox" ${s.enabled ? "checked" : ""}><span></span>Invia aggiornamenti e conferme agli iscritti</label>
        <details class="email-advanced wide" ${managed ? "" : "open"}><summary>Opzioni avanzate · servizio email personale</summary><p class="muted">Facoltativo. Scegli questa opzione solo se vuoi usare un account email esterno già configurato.</p>
          <label>Modalità di invio<select name="mode"><option value="managed" ${managed ? "selected" : ""}>Gestita da ScoreFlow · consigliata</option><option value="custom" ${managed ? "" : "selected"}>Il mio account Resend</option></select></label>
          <div class="email-custom-fields ${managed ? "hidden" : ""}"><label>Email mittente verificata<input name="senderEmail" type="email" maxlength="254" value="${escapeHtml(s.senderEmail || "")}" placeholder="iscrizioni@tuodominio.it"></label>
          <label>Chiave API Resend<input name="apiKey" type="password" autocomplete="new-password" maxlength="254" placeholder="${s.hasKey ? "Chiave salvata: lascia vuoto per conservarla" : "re_…"}"></label>
          <label class="email-clear-key"><input name="clearKey" type="checkbox"> Rimuovi la chiave personale salvata</label><p class="muted">Il dominio mittente deve essere verificato nel tuo account Resend. Limiti e costi dipendono dal tuo piano.</p></div>
        </details>
        <button class="button primary" type="submit">Salva preferenze email</button>
      </form>
      <div class="email-test-area"><div><strong>Controlla come arriva la comunicazione</strong><p class="muted">Invia una prova al tuo indirizzo prima di aprire le iscrizioni.</p></div>
        <form id="organizationEmailTest" class="email-test-form"><label class="sr-only" for="emailTestTo">Destinatario della prova</label><input id="emailTestTo" name="to" type="email" required placeholder="Il tuo indirizzo email"><button class="button ghost" type="submit">Invia una prova</button></form></div>
      <p id="emailTestStatus" class="muted">${s.lastTestStatus === "accepted" ? "Prova accettata dal servizio. Controlla la casella e lo spam." : s.lastTestStatus === "failed" ? "Ultima prova non riuscita. Controlla le impostazioni." : "Nessuna email di prova inviata."}</p>
      <p id="emailFeedback" class="inline-message ${error ? "error" : "success"}" role="status">${escapeHtml(error)}</p></article>`;
  }

  function bindOrganizationEmail(organization) {
    const form = $("#organizationEmailSettings"), testForm = $("#organizationEmailTest");
    let dirty = false;
    form.addEventListener("input", () => { dirty = true; });
    form.elements.mode.addEventListener("change", () => { dirty = true; $(".email-custom-fields", form).classList.toggle("hidden", form.elements.mode.value !== "custom"); });
    const feedback = (message, error = false) => { const el = $("#emailFeedback"); el.textContent = message; el.className = `inline-message ${error ? "error" : "success"}`; };
    form.addEventListener("submit", async e => {
      e.preventDefault(); const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = "Salvataggio…";
      try {
        const values = Object.fromEntries(new FormData(form)), mode = values.mode === "custom" ? "custom" : "managed";
        const result = await emailSettingsRequest(organization, "PUT", { mode, senderName: values.senderName, replyTo: values.replyTo,
          ...(mode === "custom" ? { senderEmail: values.senderEmail, apiKey: values.apiKey, clearKey: values.clearKey === "on" } : {}),
          enabled: mode === "custom" && values.clearKey === "on" ? false : values.enabled === "on" });
        form.elements.apiKey.value = ""; form.elements.clearKey.checked = false; form.elements.enabled.checked = result.settings.enabled;
        form.elements.apiKey.placeholder = result.settings.hasKey ? "Chiave salvata: lascia vuoto per conservarla" : "re_…";
        $("#emailStatus").textContent = result.settings.configured ? "Invio attivo" : result.settings.enabled ? "In attesa del servizio" : "Invio sospeso";
        dirty = false; feedback(result.settings.configured ? "Preferenze salvate. Le comunicazioni del tuo evento sono attive." : result.settings.enabled ? "Contatti salvati. Gli invii si attiveranno quando il servizio centrale e la licenza evento saranno disponibili." : "Preferenze salvate. Gli invii sono sospesi.");
      } catch (error) { feedback(error.message, true); } finally { button.disabled = false; button.textContent = "Salva preferenze email"; }
    });
    testForm.addEventListener("submit", async e => {
      e.preventDefault(); if (dirty) { feedback("Salva prima le modifiche, poi invia la prova.", true); return; }
      const button = testForm.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = "Invio…";
      try { const result = await emailSettingsRequest(organization, "POST", { to: testForm.elements.to.value.trim() }, true); feedback(result.message); $("#emailTestStatus").textContent = "Prova accettata dal servizio. Controlla la casella e lo spam."; }
      catch (error) { feedback(error.message, true); }
      finally { button.disabled = false; button.textContent = "Invia una prova"; }
    });
  }

  async function renderRegistrations(organization, message = "") {
    const event = ensureEventData(organization.events[0]);
    const registration = event.registration;
    $("#moduleContent").innerHTML = `<article class="dash-card loading-state" aria-busy="true"><span class="loading-indicator" aria-hidden="true"></span><div><h3>Prepariamo le tue iscrizioni</h3><p>Caricamento delle schede e delle preferenze email…</p></div></article>`;
    const [registrationsResult, emailResult] = await Promise.allSettled([adminRegistrations(organization), emailSettingsRequest(organization)]);
    const entries = registrationsResult.status === "fulfilled" ? registrationsResult.value : [];
    const loadError = registrationsResult.status === "rejected" ? registrationsResult.reason.message : "";
    const emailSettings = emailResult.status === "fulfilled" ? emailResult.value.settings : null;
    const emailError = emailResult.status === "rejected" ? emailResult.reason.message : "";
    if (currentDashboardModule !== "registrations") return;
    const link = registrationLink(organization);
    const reviewLabel = review => ({
      submitted: "Da verificare", "video-approved": "Video approvato", "changes-requested": "Da correggere",
      "roster-approved": "Nel roster", withdrawn: "Ritirato"
    })[review?.status] || "Da verificare";
    const cards = entries.map(entry => {
      const profile = entry.profile || {};
      const review = profile.review || {};
      const synced = event.participants.some(item => item.registrationId === entry.id && item.registrationAthleteId === entry.athleteId);
      const complete = Boolean(entry.completeness?.complete);
      const missing = entry.completeness?.missing || [];
      const key = `${entry.id}:${entry.athleteId}`;
      const categoryOptions = event.categories.map(category => `<option value="${escapeHtml(category.id)}" ${category.id === profile.categoryId ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("");
      const fileState = [
        ["Foto", profile.attachments?.photo], ["Video", profile.attachments?.entryVideo],
        ["Certificato", profile.attachments?.medicalCertificate], ["MP3", profile.attachments?.music]
      ].map(([label, file]) => `<span class="registration-check ${file ? "ok" : "missing"}">${file ? "✓" : "○"} ${label}</span>`).join("");
      const notificationHistory = (review.notifications || []).slice().reverse().map(notification => {
        const statusLabel = notification.deliveryStatus === "sent" ? "Email inviata" : notification.deliveryStatus === "failed" ? "Invio fallito" : "In attesa di configurazione";
        return `<div class="registration-notification ${notification.deliveryStatus || "pending"}"><div><strong>${escapeHtml(notification.subject || "Comunicazione")}</strong><small>${new Date(notification.createdAt || Date.now()).toLocaleString("it-IT")} · ${statusLabel}</small><p>${escapeHtml(notification.message || "").replace(/\n/g, "<br>")}</p>${notification.error ? `<em>${escapeHtml(notification.error)}</em>` : ""}</div>${notification.deliveryStatus !== "sent" ? `<button class="button mini ghost review-action" data-action="send-notification" data-notification-id="${escapeHtml(notification.id)}" data-key="${escapeHtml(key)}">Riprova invio</button>` : ""}</div>`;
      }).join("");
      return `<article class="registration-review-card" data-registration-key="${escapeHtml(key)}">
        <div class="registration-review-head"><div><p class="eyebrow">${entry.accountType === "group" ? "Scuola / coach" : "Iscrizione individuale"}</p><h3>${escapeHtml(`${profile.firstName || ""} ${profile.lastName || ""}`.trim())}</h3><small>${escapeHtml(entry.email)} · ${escapeHtml(profile.schoolName || "Scuola assente")}</small></div><span class="state-badge ${review.status === "roster-approved" ? "completed" : review.status === "withdrawn" ? "dns" : review.status === "changes-requested" ? "delayed" : "registered"}">${reviewLabel(review)}</span></div>
        <div class="registration-review-meta"><div><span>Coach</span><strong>${escapeHtml(profile.coachName || "—")}</strong><small>${escapeHtml(profile.coachPhone || "—")}</small></div><div><span>Disciplina</span><strong>${escapeHtml(profile.discipline || "—")}</strong><small>${escapeHtml(profile.categoryName || categoryName(event, profile.categoryId) || "—")}</small></div><div><span>Pagamento</span><strong>${review.paymentStatus === "received" ? "Ricevuto" : "Da ricevere"}</strong><small>Conferma manuale della regia</small></div></div>
        <div class="registration-checks">${fileState}</div>${event.competitionRules?.enabled ? `<div class="operational-form"><p class="wide">${escapeHtml(ScoreFlowRules.issues(event, profile, entry.createdAt || entry.created_at).join(" "))}</p>${[["video","Video: durata, ripresa e livello verificati"],["eligibility","Vittorie precedenti e requisiti verificati"],["duo","Entrambi i componenti del duo verificati"]].map(([key,label]) => `<label><input type="checkbox" data-fac-check="${key}" ${review.facChecks?.[key] ? "checked" : ""}>${label}</label>`).join("")}</div>` : ""}
        <div class="registration-review-controls"><label>Categoria assegnata<select data-review-category>${categoryOptions}</select></label><label class="wide">Motivazione / comunicazione<input data-review-reason value="${escapeHtml(review.reason || "")}" placeholder="Obbligatoria in caso di correzione o cambio categoria"></label></div>
        ${review.requestedCategoryId && review.requestedCategoryId !== profile.categoryId ? `<p class="category-change-note">Categoria richiesta inizialmente: <strong>${escapeHtml(categoryName(event, review.requestedCategoryId))}</strong> → assegnata: <strong>${escapeHtml(categoryName(event, profile.categoryId))}</strong></p>` : ""}
        <div class="registration-review-actions">
          ${profile.attachments?.entryVideo ? `<button class="button mini ghost review-open-video" data-key="${escapeHtml(key)}">Apri video</button>` : ""}
          <button class="button mini ghost review-action" data-action="save-review" data-key="${escapeHtml(key)}">Salva categoria e note</button>
          <button class="button mini ${review.videoStatus === "approved" ? "success" : "primary"} review-action" data-action="approve-video" data-key="${escapeHtml(key)}">${review.videoStatus === "approved" ? "Video approvato" : "Approva video"}</button>
          <button class="button mini warning review-action" data-action="request-video" data-key="${escapeHtml(key)}">Richiedi correzione</button>
          <button class="button mini ghost review-action" data-action="${review.paymentStatus === "received" ? "mark-unpaid" : "mark-paid"}" data-key="${escapeHtml(key)}">${review.paymentStatus === "received" ? "Annulla pagamento" : "Segna pagamento"}</button>
          <button class="button mini success review-action" data-action="approve-roster" data-key="${escapeHtml(key)}" ${complete && !synced && review.status !== "withdrawn" ? "" : "disabled"}>${synced ? "✓ Nel roster" : "Approva e aggiungi al roster"}</button>
          <button class="button mini danger review-action" data-action="${review.status === "withdrawn" ? "restore" : "withdraw"}" data-key="${escapeHtml(key)}">${review.status === "withdrawn" ? "Ripristina" : "Ritirato"}</button>
        </div>
        ${complete ? '<p class="registration-complete">✓ Pratica completa e pronta per il roster.</p>' : `<p class="registration-incomplete">Mancano: ${escapeHtml(missing.join(", ") || "verifica della regia")}</p>`}
        <details class="registration-notification-history" ${notificationHistory ? "" : "hidden"}><summary>Storico comunicazioni (${review.notifications?.length || 0})</summary><div>${notificationHistory}</div></details>
      </article>`;
    }).join("");
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Portale atleti</p><h2>Preiscrizioni e iscrizioni</h2><p>Configura le scadenze, condividi il collegamento e trasferisci le schede direttamente nel roster di gara.</p></div><span class="count-chip">${entries.length} schede</span></div>
      <div class="dashboard-grid registration-admin-grid"><article class="dash-card"><h3>Finestra iscrizioni</h3><form id="registrationSettings" class="operational-form">
        <label class="toggle wide"><input id="registrationEnabled" type="checkbox" ${registration.enabled ? "checked" : ""}><span></span>Abilita il portale atleti</label>
        <label>Apertura preiscrizioni<input id="preRegistrationOpensAt" type="datetime-local" value="${localDateTimeValue(registration.preRegistrationOpensAt)}"></label>
        <label>Chiusura preiscrizioni<input id="preRegistrationClosesAt" type="datetime-local" value="${localDateTimeValue(registration.preRegistrationClosesAt)}"></label>
        <label>Chiusura iscrizioni<input id="registrationClosesAt" type="datetime-local" value="${localDateTimeValue(registration.registrationClosesAt)}" required></label>
        <label class="wide">Istruzioni per gli atleti<textarea id="registrationInstructions" rows="4">${escapeHtml(registration.instructions || "")}</textarea></label>
        <button class="button primary" type="submit">Salva impostazioni</button></form></article>
        <article class="dash-card"><h3>Collegamento pubblico</h3><p class="muted">Atleti, scuole e coach usano questo link per creare le credenziali e aggiornare le proprie schede.</p><div class="share-link"><input id="registrationLink" readonly value="${escapeHtml(link)}"><button class="button ghost copy-registration-link" type="button">Copia</button></div><a class="button primary" href="${escapeHtml(link)}" target="_blank" rel="noopener">Apri portale</a><hr><p class="muted"><strong>Ingresso nel roster manuale.</strong> Ogni atleta deve essere verificato e approvato dalla regia.</p></article></div>
      <div class="inline-message ${loadError ? "error" : "success"}">${escapeHtml(loadError || message)}</div>
      ${organizationEmailPanel({ ...emailSettings, senderName: emailSettings?.senderName || organization.name.slice(0, 100) }, emailError)}
      <article class="dash-card"><div class="section-heading"><div><h3>Schede ricevute</h3><p>La regia controlla video, categoria, pagamento e documenti prima dell’inserimento manuale nel roster.</p></div></div><div class="registration-review-list">${cards || '<p class="empty-cell">Nessuna scheda ricevuta.</p>'}</div></article>`;
    bindOrganizationEmail(organization);
    $("#registrationSettings").addEventListener("submit", submitEvent => {
      submitEvent.preventDefault();
      registration.enabled = $("#registrationEnabled").checked;
      registration.preRegistrationOpensAt = isoFromLocal($("#preRegistrationOpensAt").value);
      registration.preRegistrationClosesAt = isoFromLocal($("#preRegistrationClosesAt").value);
      registration.registrationClosesAt = isoFromLocal($("#registrationClosesAt").value);
      registration.instructions = $("#registrationInstructions").value.trim();
      if (registration.preRegistrationClosesAt && registration.registrationClosesAt && Date.parse(registration.preRegistrationClosesAt) > Date.parse(registration.registrationClosesAt)) return showToast("La chiusura delle preiscrizioni deve precedere la chiusura finale.");
      saveRuntime(organization); renderRegistrations(organization, "Impostazioni iscrizioni salvate.");
    });
    $(".copy-registration-link").addEventListener("click", async () => { await navigator.clipboard.writeText(link); renderRegistrations(organization, "Collegamento copiato."); });
    const entryForKey = key => entries.find(entry => `${entry.id}:${entry.athleteId}` === key);
    $$(".review-open-video", $("#moduleContent")).forEach(button => button.addEventListener("click", () => {
      const entry = entryForKey(button.dataset.key); if (entry?.profile?.attachments?.entryVideo) previewManagedVideo(organization, entry.profile.attachments.entryVideo, `Video entry · ${entry.profile.firstName} ${entry.profile.lastName}`);
    }));
    $$(".review-action", $("#moduleContent")).forEach(button => button.addEventListener("click", async () => {
      const entry = entryForKey(button.dataset.key); if (!entry) return;
      const card = button.closest(".registration-review-card");
      const reason = $("[data-review-reason]", card).value.trim();
      const categoryId = $("[data-review-category]", card).value;
      const action = button.dataset.action;
      if ((action === "request-video" || categoryId !== entry.profile.categoryId) && !reason) return showToast("Inserisci una motivazione da comunicare all’atleta o al coach.");
      if (action === "withdraw" && !confirm(`Segnare ${entry.profile.firstName} ${entry.profile.lastName} come ritirato? La scheda resterà archiviata.`)) return;
      button.disabled = true;
      try {
        const updated = await reviewRegistration(organization, entry, action, { facChecks: Object.fromEntries($$("[data-fac-check]", card).map(input => [input.dataset.facCheck, input.checked])), reason, categoryId, categoryName: categoryName(event, categoryId), notificationId: button.dataset.notificationId || "" });
        if (action === "approve-roster") {
          registrationToParticipant(event, { ...entry, ...updated, profile: updated.profile, athleteId: updated.athleteId });
          event.participants.forEach((item, index) => { item.order = index + 1; });
          saveRuntime(organization);
        }
        renderRegistrations(organization, action === "approve-roster" ? "Iscrizione approvata, atleta aggiunto al roster e comunicazione registrata." : action === "send-notification" ? "Nuovo tentativo di invio completato." : "Revisione salvata e comunicazione registrata nello storico.");
      } catch (error) { showToast(error.message); button.disabled = false; }
    }));
  }

  function resetPostTest(organization) {
    const event = ensureEventData(organization.events[0]);
    const confirmation = prompt("Il reset cancella voti, risultati, cronologia, ripetizioni e stati della prova. Configurazione, roster e giudici restano invariati. Scrivi RESET per continuare.");
    if (confirmation !== "RESET") return;
    event.scores = []; event.publicVotes = []; event.scoreHistory = []; event.roundHistory = []; event.notifications = []; event.resultsValidated = {};
    event.presenter = { selectedParticipantId: null, notes: {} };
    event.participants.forEach((participant, index) => { participant.order = index + 1; participant.status = "registered"; participant.round = "qualification"; participant.attempt = 1; participant.updatedAt = new Date().toISOString(); });
    event.judges.forEach(judge => { judge.lastActivityAt = null; });
    event.control = { currentParticipantId: event.participants[0]?.id || null, status: "setup", mode: "automatic", round: "qualification", repeatQueue: [], voteStartedAt: null };
    saveRuntime(organization); renderDashboardModule("overview", organization, "Reset post-test completato. L’ambiente è pronto per una nuova prova o per la gara.");
  }

  async function activateLicense(organization, code) {
    const cloud = ensureCloudIdentity(organization);
    const response = await fetch(`/api/tenants/${encodeURIComponent(cloud.tenantKey)}/license/activate`, { method: "POST", headers: cloudHeaders(cloud, true), body: JSON.stringify({ code }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Codice di sblocco non valido.");
    organization.subscription.plan = result.plan;
    organization.subscription.status = result.status;
    organization.subscription.licenseExpiresAt = result.expiresAt;
    organization.subscription.activatedAt = new Date().toISOString();
    saveRuntime(organization);
  }

  function athleteRegistrationFiles(profile = {}) {
    const attachments = profile.attachments || {};
    const card = (kind, label, help, accept) => {
      const file = attachments[kind];
      const duration = kind === "music" && file?.durationSeconds ? ` · durata ${formatDuration(file.durationSeconds)}` : "";
      return `<div class="registration-file-card" data-file-kind="${kind}">
        <div class="registration-file-icon">${kind === "photo" ? "◉" : kind === "music" ? "♫" : kind === "entryVideo" ? "▶" : "▤"}</div>
        <div><strong>${label}</strong><small>${file ? `${escapeHtml(file.name)} · ${formatBytes(file.size)}${duration}` : help}</small></div>
        <label class="button mini">${file ? "Sostituisci" : "Carica"}<input type="file" data-registration-file="${kind}" accept="${accept}"></label>
        ${file?.cloudPath ? `<button class="button mini ghost" type="button" data-athlete-open="${kind}">Apri</button>` : ""}
      </div>`;
    };
    return `<div class="form-section-title wide"><span>4</span><div><strong>Foto, documenti e materiali</strong><small>I file vengono salvati nel cloud e associati alla scheda atleta.</small></div></div>
      <div class="registration-photo-preview">${attachments.photo?.previewUrl ? `<img id="athletePortalPhoto" src="${attachments.photo.previewUrl}" alt="Foto atleta">` : `<div id="athletePortalPhotoPlaceholder">Foto atleta</div>`}</div>
      <div class="registration-file-list">
        ${card("photo", "Foto di riconoscimento", "JPG, PNG o WEBP · massimo 8 MB", "image/*")}
        ${card("entryVideo", "Video entry", "Video · massimo 50 MB", "video/*")}
        ${card("medicalCertificate", "Certificato medico agonistico", "PDF o immagine · massimo 15 MB", ".pdf,application/pdf,image/*")}
        ${card("music", "Musica della performance", "File audio MP3 · massimo 50 MB", "audio/mpeg,audio/mp3,.mp3")}
      </div>`;
  }

  function athleteProfileFields(config, profile = {}, includeCredentials = false) {
    const categories = config.event?.categories || [];
    const disciplines = config.event?.disciplines || [];
    const detectedDuration = Number(profile.attachments?.music?.durationSeconds) || 0;
    const value = key => escapeHtml(profile[key] || "");
    const preferredLanguage = ["it", "en", "fr", "es"].includes(profile.preferredLanguage) ? profile.preferredLanguage : uiLanguage();
    return `${includeCredentials ? `<div class="form-section-title"><span>1</span><div><strong>Credenziali personali</strong><small>Servono per rientrare e aggiornare la scheda.</small></div></div><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" minlength="8" required autocomplete="new-password"><small>Almeno 8 caratteri.</small></label>` : ""}
      <div class="form-section-title wide"><span>${includeCredentials ? "2" : "1"}</span><div><strong>Dati atleta</strong><small>I campi con * sono obbligatori.</small></div></div>
      <label>Lingua<select name="preferredLanguage"><option value="it" ${preferredLanguage === "it" ? "selected" : ""}>Italiano</option><option value="en" ${preferredLanguage === "en" ? "selected" : ""}>English</option><option value="fr" ${preferredLanguage === "fr" ? "selected" : ""}>Français</option><option value="es" ${preferredLanguage === "es" ? "selected" : ""}>Español</option></select><small>Le comunicazioni saranno inviate in questa lingua.</small></label>
      <label>Nome *<input name="firstName" required value="${value("firstName")}"></label><label>Cognome *<input name="lastName" required value="${value("lastName")}"></label>
      <label>Data di nascita *<input name="birthDate" type="date" required value="${value("birthDate")}"></label><label>Luogo di nascita<input name="birthPlace" value="${value("birthPlace")}"></label>
      <label>Genere<select name="gender"><option value="">Non specificato</option>${["Femminile","Maschile","Altro"].map(item => `<option ${profile.gender === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><label>Codice fiscale<input name="taxCode" value="${value("taxCode")}"></label>
      <label>Nazionalità<input name="nationality" value="${value("nationality")}"></label><label>Telefono atleta *<input name="phone" type="tel" required value="${value("phone")}"></label>
      <label class="wide">Indirizzo<input name="address" value="${value("address")}"></label><label>CAP<input name="postalCode" value="${value("postalCode")}"></label><label>Città<input name="city" value="${value("city")}"></label><label>Provincia<input name="province" value="${value("province")}"></label>
      <div class="form-section-title wide"><span>${includeCredentials ? "3" : "2"}</span><div><strong>Scuola e coach</strong><small>Riferimenti usati dallo staff durante la gara.</small></div></div>
      <label class="wide">Nome scuola / società *<input name="schoolName" required value="${value("schoolName")}"></label><label>Coach di riferimento *<input name="coachName" required value="${value("coachName")}"></label><label>Telefono coach *<input name="coachPhone" type="tel" required value="${value("coachPhone")}"></label>
      <div class="form-section-title wide"><span>${includeCredentials ? "4" : "3"}</span><div><strong>Dati di gara</strong><small>Questi dati alimentano direttamente il roster ScoreFlow.</small></div></div>
      <label>Disciplina *<select name="discipline" required><option value="">Seleziona</option>${disciplines.map(item => `<option value="${escapeHtml(item)}" ${profile.discipline === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></label>
      <label>Categoria *<select name="categoryId" required><option value="">Seleziona</option>${categories.map(item => `<option value="${escapeHtml(item.id)}" ${profile.categoryId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
      <label>Livello<input name="level" value="${value("level")}"></label><div class="readonly-duration"><span>Durata performance</span><strong>${detectedDuration ? formatDuration(detectedDuration) : "In attesa dell’MP3"}</strong><small>Calcolata automaticamente dal file musicale.</small></div>
      <label class="wide">Titolo coreografia<input name="choreographyTitle" value="${value("choreographyTitle")}"></label><label class="wide">Tema coreografia<textarea name="choreographyTheme" rows="3">${value("choreographyTheme")}</textarea></label>
      <label class="wide">Descrizione atleta / performance<textarea name="description" rows="3">${value("description")}</textarea></label><label class="wide">Richieste speciali<textarea name="specialRequests" rows="3">${value("specialRequests")}</textarea></label>
      <label class="toggle wide consent-row"><input name="privacyAccepted" type="checkbox" required ${profile.privacyAccepted ? "checked" : ""}><span></span>Acconsento al trattamento dei dati per la gestione dell’iscrizione *</label>
      <label class="toggle wide consent-row"><input name="rulesAccepted" type="checkbox" ${profile.rulesAccepted ? "checked" : ""}><span></span>Dichiaro di aver letto il regolamento della competizione</label>`;
  }

  function profileFromForm(form, config, attachments = {}) {
    const data = new FormData(form);
    const categoryId = String(data.get("categoryId") || "");
    return {
      firstName: data.get("firstName"), lastName: data.get("lastName"), preferredLanguage: data.get("preferredLanguage") || uiLanguage(), birthDate: data.get("birthDate"), birthPlace: data.get("birthPlace"),
      gender: data.get("gender"), taxCode: data.get("taxCode"), nationality: data.get("nationality"), phone: data.get("phone"),
      address: data.get("address"), postalCode: data.get("postalCode"), city: data.get("city"), province: data.get("province"),
      schoolName: data.get("schoolName"), coachName: data.get("coachName"), coachPhone: data.get("coachPhone"), discipline: data.get("discipline"),
      categoryId, categoryName: config.event?.categories?.find(item => item.id === categoryId)?.name || "", level: data.get("level"),
      performanceDuration: Number(attachments.music?.durationSeconds) || 0, choreographyTitle: data.get("choreographyTitle"), choreographyTheme: data.get("choreographyTheme"),
      description: data.get("description"), specialRequests: data.get("specialRequests"), privacyAccepted: data.get("privacyAccepted") === "on", rulesAccepted: data.get("rulesAccepted") === "on",
      attachments
    };
  }

  function registrationSessionKey(tenantKey) { return `scoreflow.registration.session.${tenantKey}`; }

  function encodeAthletePayload(json) {
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return `scoreflow64:${btoa(binary)}`;
  }

  function updateRegistrationCountdown(config) {
    const registration = config.registration || {};
    const phase = config.phase;
    let target = registration.registrationClosesAt;
    let label = "Chiusura iscrizioni";
    if (phase === "scheduled") { target = registration.preRegistrationOpensAt; label = "Apertura preiscrizioni"; }
    else if (phase === "pre-registration" && registration.preRegistrationClosesAt) { target = registration.preRegistrationClosesAt; label = "Chiusura preiscrizioni"; }
    const difference = Math.max(0, Date.parse(target || 0) - Date.now());
    const days = Math.floor(difference / 86400000), hours = Math.floor(difference / 3600000) % 24, minutes = Math.floor(difference / 60000) % 60, seconds = Math.floor(difference / 1000) % 60;
    $("#countdownLabel").textContent = label;
    $("#registrationCountdown").textContent = target ? `${days}g ${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}` : "Data da definire";
    $("#registrationPhase").textContent = ({ scheduled: "Apertura programmata", "pre-registration": "Preiscrizioni aperte", registration: "Iscrizioni aperte", closed: "Iscrizioni chiuse", disabled: "Portale non attivo" })[phase] || phase;
  }

  async function athleteApi(path, options = {}, tenantKey) {
    const saved = JSON.parse(localStorage.getItem(registrationSessionKey(tenantKey)) || "null");
    const encodedBody = typeof options.body === "string" ? encodeAthletePayload(options.body) : options.body;
    const headers = { ...(encodedBody ? { "Content-Type": "text/plain;charset=UTF-8" } : {}), ...(saved?.token ? { Authorization: `Bearer ${saved.token}` } : {}), ...(options.headers || {}) };
    const response = await fetch(path, { ...options, body: encodedBody, headers });
    const rawResponse = await response.text();
    let result = {};
    try { result = rawResponse ? JSON.parse(rawResponse) : {}; } catch { result = {}; }
    if (!response.ok) {
      const detail = result.message || rawResponse.trim() || "Operazione non riuscita.";
      throw new Error(`${detail} (HTTP ${response.status})`);
    }
    return result;
  }

  async function athleteAttachmentUrl(kind, tenantKey, athleteId = "") {
    const result = await athleteApi(`/api/athlete/file?kind=${encodeURIComponent(kind)}${athleteId ? `&athleteId=${encodeURIComponent(athleteId)}` : ""}`, {}, tenantKey);
    return result.url;
  }

  function bindAthleteFileControls(config, account, profile = account.profile || {}, athleteId = "") {
    const form = $("#athleteProfileForm");
    if (!form) return;
    $$('[data-registration-file]', form).forEach(input => input.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const kind = input.dataset.registrationFile;
      const limits = { photo: 8, entryVideo: 50, medicalCertificate: 15, music: 50 };
      if (file.size > limits[kind] * 1024 * 1024) { showToast(`Il file supera il limite di ${limits[kind]} MB.`); input.value = ""; return; }
      input.disabled = true;
      try {
        const durationSeconds = /^(audio|video)\//.test(file.type) ? await mediaDuration(file) : 0;
        const result = await athleteApi(`/api/athlete/file?kind=${encodeURIComponent(kind)}${athleteId ? `&athleteId=${encodeURIComponent(athleteId)}` : ""}`, {
          method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), "X-Media-Duration": String(durationSeconds || 0) }, body: file
        }, config.tenantKey);
        renderAthletePortal(config, result.account, `${file.name} caricato e associato alla scheda.`, athleteId);
      } catch (error) { showToast(error.message); input.disabled = false; }
    }));
    $$('[data-athlete-open]', form).forEach(button => button.addEventListener("click", async () => {
      const opened = window.open("", "_blank");
      try {
        const url = await athleteAttachmentUrl(button.dataset.athleteOpen, config.tenantKey, athleteId);
        if (opened) opened.location = url; else window.location.href = url;
      } catch (error) { opened?.close(); showToast(error.message); }
    }));
    if (profile.attachments?.photo?.cloudPath && !profile.attachments.photo.previewUrl) {
      athleteAttachmentUrl("photo", config.tenantKey, athleteId).then(url => {
        const preview = $("#athletePortalPhoto");
        const placeholder = $("#athletePortalPhotoPlaceholder");
        if (preview) preview.src = url;
        else if (placeholder) { const image = document.createElement("img"); image.id = "athletePortalPhoto"; image.alt = "Foto atleta"; image.src = url; placeholder.replaceWith(image); }
      }).catch(() => {});
    }
  }

  async function renderAthletePortal(config, account = null, message = "", selectedAthleteId = "", addingAthlete = false) {
    const content = $("#registrationContent");
    const open = ["pre-registration", "registration"].includes(config.phase);
    const profileOpen = config.phase === "pre-registration";
    if (account) {
      const isGroup = account.profile?.accountType === "group" && Array.isArray(account.profile.athletes);
      const athletes = isGroup ? account.profile.athletes : [account.profile || {}];
      const selected = addingAthlete ? null : athletes.find(item => item.id === selectedAthleteId) || athletes[0];
      const formProfile = selected || (isGroup ? { schoolName: account.profile.manager?.schoolName || "", coachName: account.profile.manager?.name || "", coachPhone: account.profile.manager?.phone || "" } : {});
      const review = formProfile.review || {};
      const groupPanel = isGroup ? `<article class="registration-card group-dashboard"><div class="registration-card-head"><div><p class="eyebrow">Account scuola / coach</p><h2>${escapeHtml(account.profile.manager?.schoolName || "Gestione gruppo")}</h2><p>${escapeHtml(account.email)} · ${athletes.length}${account.profile.manager?.plannedAthletes && account.profile.manager.plannedAthletes !== "custom" ? `/${escapeHtml(account.profile.manager.plannedAthletes)}` : ""} atleti inseriti</p></div><button class="button primary add-group-athlete" type="button" ${profileOpen ? "" : "disabled"}>+ Aggiungi atleta</button></div><div class="group-athlete-list">${athletes.map(item => `<button type="button" class="group-athlete-item ${selected?.id === item.id ? "active" : ""}" data-group-athlete="${escapeHtml(item.id)}"><span>${escapeHtml((item.firstName || "A").charAt(0))}</span><div><strong>${escapeHtml(`${item.firstName || "Nuovo"} ${item.lastName || "atleta"}`)}</strong><small>${escapeHtml(item.categoryName || "Categoria da completare")}</small></div><em>${({ submitted: "Da verificare", "video-approved": "Video approvato", "changes-requested": "Da correggere", "roster-approved": "Nel roster", withdrawn: "Ritirato" })[item.review?.status] || "Preiscrizione"}</em></button>`).join("")}</div></article>` : "";
      const statusMessage = review.reason ? `<div class="athlete-review-message ${review.status === "changes-requested" ? "warning" : "success"}"><strong>${review.status === "changes-requested" ? "Richiesta della regia" : "Aggiornamento iscrizione"}</strong><p>${escapeHtml(review.reason)}</p></div>` : "";
      const athleteNotifications = (review.notifications || []).slice().reverse().map(notification => `<article class="athlete-notification"><span>${notification.deliveryStatus === "sent" ? "✓" : "•"}</span><div><strong>${escapeHtml(notification.subject || "Aggiornamento")}</strong><small>${new Date(notification.createdAt || Date.now()).toLocaleString("it-IT")}</small><p>${escapeHtml(notification.message || "").replace(/\n/g, "<br>")}</p></div></article>`).join("");
      const athleteCommunicationPanel = !addingAthlete && athleteNotifications ? `<section class="athlete-communications"><div><p class="eyebrow">Comunicazioni</p><h3>Messaggi della regia</h3></div>${athleteNotifications}</section>` : "";
      content.innerHTML = `${groupPanel}<article class="registration-card"><div class="registration-card-head"><div><p class="eyebrow">${addingAthlete ? "Nuova scheda" : "Area riservata"}</p><h2>${addingAthlete ? "Aggiungi un atleta" : escapeHtml(`${formProfile.firstName || "Scheda"} ${formProfile.lastName || "atleta"}`)}</h2><p>${escapeHtml(account.email)} · stato: <strong>${review.status === "roster-approved" ? "approvato nel roster" : account.status === "registered" ? "iscritto" : "preiscritto"}</strong></p></div><span class="state-badge ${review.status === "changes-requested" ? "delayed" : "completed"}">${addingAthlete ? "Nuovo" : review.videoStatus === "approved" ? "Video approvato" : "Credenziali verificate"}</span></div>${message ? `<div class="demo-message"><span>✓</span>${escapeHtml(message)}</div>` : ""}${statusMessage}${athleteCommunicationPanel}<form id="athleteProfileForm" class="athlete-registration-form">${athleteProfileFields(config, formProfile, false)}${addingAthlete ? "" : athleteRegistrationFiles(formProfile)}<div class="wide portal-actions"><button class="button primary" type="submit" ${profileOpen ? "" : "disabled"}>${addingAthlete ? "Salva nuovo atleta" : "Salva aggiornamenti"}</button>${addingAthlete ? '<button class="button ghost cancel-group-athlete" type="button">Annulla</button>' : ""}${profileOpen ? "" : open ? "<strong>I dati gara sono bloccati; puoi ancora caricare i documenti mancanti.</strong>" : "<strong>Il termine per le modifiche è scaduto.</strong>"}</div></form></article>`;
      $("#registrationLogout").classList.remove("hidden");
      $("#athleteProfileForm").addEventListener("submit", async event => {
        event.preventDefault(); const button = $("button[type=submit]", event.currentTarget); button.disabled = true;
        try {
          const payloadProfile = profileFromForm(event.currentTarget, config, formProfile.attachments || {});
          const result = await athleteApi("/api/athlete/profile", { method: "PUT", body: JSON.stringify({ action: addingAthlete ? "add" : "update", athleteId: selected?.id || "", profile: payloadProfile }) }, config.tenantKey);
          const savedAthletes = result.account.profile?.athletes || [];
          const savedId = addingAthlete ? savedAthletes[savedAthletes.length - 1]?.id : selected?.id;
          renderAthletePortal(config, result.account, addingAthlete ? "Atleta aggiunto al gruppo." : "Scheda aggiornata e salvata correttamente.", savedId);
        }
        catch (error) { showToast(error.message); button.disabled = false; }
      });
      if (!addingAthlete) bindAthleteFileControls(config, account, formProfile, isGroup ? selected?.id : "");
      $$("[data-group-athlete]", content).forEach(button => button.addEventListener("click", () => renderAthletePortal(config, account, "", button.dataset.groupAthlete)));
      if ($(".add-group-athlete", content)) $(".add-group-athlete", content).addEventListener("click", () => renderAthletePortal(config, account, "", "", true));
      if ($(".cancel-group-athlete", content)) $(".cancel-group-athlete", content).addEventListener("click", () => renderAthletePortal(config, account, "", athletes[0]?.id));
      return;
    }
    $("#registrationLogout").classList.add("hidden");
    content.innerHTML = `<div class="registration-entry-grid"><article class="registration-card"><p class="eyebrow">Hai già le credenziali?</p><h2>Accedi alla scheda</h2><form id="athleteLoginForm" class="operational-form"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" required autocomplete="current-password"></label><button class="button primary" type="submit">Accedi</button></form></article><article class="registration-card register-intro"><p class="eyebrow">Nuova preiscrizione</p><h2>${profileOpen ? "Crea la tua scheda" : "Preiscrizioni chiuse"}</h2><p>${escapeHtml(config.registration?.instructions || "")}</p>${profileOpen ? '<button class="button primary show-signup" type="button">Inizia la compilazione</button>' : open ? '<span class="state-badge delayed">Gli account esistenti possono completare i documenti</span>' : '<span class="state-badge delayed">Portale chiuso</span>'}</article></div><article id="signupCard" class="registration-card hidden"><div class="registration-card-head"><div><p class="eyebrow">Scegli il tipo di account</p><h2>Preiscrizione</h2></div><button class="button ghost hide-signup" type="button">Chiudi</button></div><div class="registration-type-choice"><button type="button" class="active" data-account-type="individual"><strong>Atleta singolo</strong><small>Una sola scheda personale</small></button><button type="button" data-account-type="group"><strong>Scuola / coach</strong><small>Gestisci più atleti con un accesso</small></button></div><label id="plannedAthletesWrap" class="planned-athletes hidden">Numero indicativo di atleti<select id="plannedAthletes"><option value="5">5 atleti</option><option value="10">10 atleti</option><option value="20">20 atleti</option><option value="custom">Da definire</option></select></label><form id="athleteSignupForm" class="athlete-registration-form" data-account-type="individual">${athleteProfileFields(config, {}, true)}<div class="wide portal-actions"><button class="button primary" type="submit">Crea credenziali e salva scheda</button></div></form></article>`;
    $("#athleteLoginForm").addEventListener("submit", async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      try { const result = await athleteApi("/api/athlete/access", { method: "POST", body: JSON.stringify({ tenantKey: config.tenantKey, email: data.get("email"), password: data.get("password") }) }, config.tenantKey); localStorage.setItem(registrationSessionKey(config.tenantKey), JSON.stringify({ token: result.token, expiresAt: result.expiresAt })); renderAthletePortal(config, result.account); }
      catch (error) { showToast(error.message); }
    });
    const showSignup = $(".show-signup");
    if (showSignup) showSignup.addEventListener("click", () => { $("#signupCard").classList.remove("hidden"); $("#signupCard").scrollIntoView({ behavior: "smooth" }); });
    $(".hide-signup").addEventListener("click", () => $("#signupCard").classList.add("hidden"));
    $$("[data-account-type]", $("#signupCard")).forEach(button => button.addEventListener("click", () => {
      $$("[data-account-type]", $("#signupCard")).forEach(item => item.classList.toggle("active", item === button));
      $("#athleteSignupForm").dataset.accountType = button.dataset.accountType;
      $("#plannedAthletesWrap").classList.toggle("hidden", button.dataset.accountType !== "group");
    }));
    $("#athleteSignupForm").addEventListener("submit", async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const button = $("button[type=submit]", event.currentTarget); button.disabled = true;
      try {
        const profile = profileFromForm(event.currentTarget, config);
        const accountType = event.currentTarget.dataset.accountType || "individual";
        const accountProfile = accountType === "group" ? { accountType: "group", manager: { name: profile.coachName, schoolName: profile.schoolName, phone: profile.coachPhone, plannedAthletes: $("#plannedAthletes").value, preferredLanguage: profile.preferredLanguage }, athletes: [profile] } : profile;
        const result = await athleteApi("/api/athlete/enroll", { method: "POST", body: JSON.stringify({ tenantKey: config.tenantKey, email: data.get("email"), password: data.get("password"), accountProfile }) }, config.tenantKey);
        localStorage.setItem(registrationSessionKey(config.tenantKey), JSON.stringify({ token: result.token, expiresAt: result.expiresAt })); renderAthletePortal(config, result.account, accountType === "group" ? "Account scuola creato. Ora puoi aggiungere gli altri atleti." : "Credenziali create e scheda salvata.");
      }
      catch (error) { showToast(error.message); button.disabled = false; }
    });
  }

  async function showRegistrationPortal(tenantKey) {
    const config = await athleteApi(`/api/registration/config?tenant=${encodeURIComponent(tenantKey)}`, {}, tenantKey);
    const selectedLanguage = localStorage.getItem("scoreflow.uiLanguage") || config.language || "it";
    window.ScoreFlowI18n?.setLanguage(selectedLanguage);
    clearInterval(registrationCountdownTimer);
    $("body > .topbar").classList.add("hidden"); $("#onboarding").classList.add("hidden"); $("main.layout").classList.add("hidden"); $("#dashboard").classList.add("hidden"); $("#registrationPortal").classList.remove("hidden");
    applyBrandTheme(config.brand?.primaryColor, config.brand?.accentColor);
    $("#registrationOrg").textContent = config.organizationName || "ScoreFlow"; $("#registrationEvent").textContent = config.event?.name || "Evento";
    $("#registrationDates").textContent = [config.event?.location, config.event?.startsAt && new Date(config.event.startsAt).toLocaleDateString(localeForLanguage(uiLanguage()))].filter(Boolean).join(" · ");
    updateRegistrationCountdown(config); registrationCountdownTimer = setInterval(() => updateRegistrationCountdown(config), 1000);
    let account = null;
    try { if (localStorage.getItem(registrationSessionKey(tenantKey))) account = (await athleteApi("/api/athlete/profile", {}, tenantKey)).account; } catch { localStorage.removeItem(registrationSessionKey(tenantKey)); }
    await renderAthletePortal(config, account);
    $("#registrationLogout").onclick = () => { localStorage.removeItem(registrationSessionKey(tenantKey)); renderAthletePortal(config, null); };
  }

  async function saveConfiguration(event) {
    event.preventDefault();
    if (![1, 2, 3].every(validateStep)) return;
    const organization = formData();
    if(!organizerAccount && !organization.cloud?.revision){showAccountScreen("signup");return;}
    const existing = platform.organizations.find(item => item.id === organization.id);
    organization.cloud = existing?.cloud || organization.cloud;
    ensureCloudIdentity(organization);
    setMessage("saveMessage", "Salvataggio e caricamento dei file in corso...");
    let uploadWarning = "";
    try {
      if(!organization.cloud.revision) await registerCloudTenant(organization);
    }catch(error){setMessage("saveMessage",error.message,true);return;}
    try {
      if (selectedLogoFile) {
        const cloud = await uploadCloudFile(organization, selectedLogoFile, "brand");
        organization.brand.logoFile = { name: selectedLogoFile.name, size: selectedLogoFile.size, type: selectedLogoFile.type, ...cloud };
      }
      for (const selected of selectedEventFiles.filter(item => item.file)) {
        const cloud = await uploadCloudFile(organization, selected.file, "event-assets");
        const asset = organization.events[0].assets.find(item => item.id === selected.id);
        if (asset) Object.assign(asset, cloud, { status: "stored-in-cloud" });
      }
    } catch (error) {
      uploadWarning = `Configurazione salvata, ma un file non è arrivato nel cloud: ${error.message}`;
    }
    const index = platform.organizations.findIndex(item => item.id === organization.id);
    if (index >= 0) platform.organizations[index] = organization;
    else platform.organizations.push(organization);
    editingOrganizationId = organization.id;
    platform.activeOrganizationId = organization.id;
    persistPlatform();
    queueCloudSync(organization);
    renderOrganizationList();
    setMessage("saveMessage", uploadWarning || "Ambiente salvato. I file selezionati sono disponibili nel cloud.", Boolean(uploadWarning));
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
    window.ScoreFlowI18n?.setLanguage(org.language || uiLanguage());
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
    $("#publicQr").checked = Boolean(event.publicVoting.qrEnabled);
    $("#publicQr").disabled = !event.publicVoting.enabled;
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
    selectedLogoFile = null;
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
    ["Categoria Base", "Categoria Intermedia"].forEach(name => addCategory(name));
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

  function defaultLogo(name, primary, accent) {
    const initials = String(name || "ScoreFlow").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "SF";
    const safeInitials = initials.replace(/[^A-Z0-9]/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${primary}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs><rect width="512" height="512" rx="118" fill="url(#g)"/><circle cx="405" cy="105" r="76" fill="#fff" opacity=".13"/><path d="M80 398c95-126 224-163 352-111v111z" fill="#fff" opacity=".1"/><text x="256" y="300" text-anchor="middle" font-family="Arial,sans-serif" font-size="150" font-weight="900" fill="#fff">${safeInitials}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function dateValue(offsetDays) {
    const date = new Date(Date.now() + offsetDays * 86400000);
    return date.toISOString().slice(0, 10);
  }

  function applyOnboardingDefaults() {
    const profile = onboardingProfiles[onboardingProfile];
    const size = onboardingSizes[onboardingSize];
    const organizationName = $("#quickOrgName").value.trim() || profile.organization;
    const eventName = $("#quickEventName").value.trim() || profile.event;
    resetForm();
    $("#orgName").value = organizationName;
    $("#orgSlug").value = `${slugify(organizationName) || "scoreflow"}-${crypto.randomUUID().slice(0,8)}`;
    $("#eventName").value = eventName;
    $("#eventLocation").value = profile.location;
    $("#eventStart").value = dateValue(7);
    $("#eventEnd").value = dateValue(8);
    $("#disciplines").value = profile.disciplines.join(", ");
    $("#primaryColor").value = profile.primary;
    $("#accentColor").value = profile.accent;
    applyBrandTheme(profile.primary, profile.accent);
    logoDataUrl = defaultLogo(organizationName, profile.primary, profile.accent);
    $("#logoPreview").innerHTML = `<img src="${logoDataUrl}" alt="Logo predefinito generato">`;
    $("#categoryList").innerHTML = "";
    profile.categories.slice(0,2).forEach(name => addCategory(name));
    $("#criteriaRows").innerHTML = "";
    profile.criteria.forEach(name => addCriterionRow({ name, min: 0, max: 10, weight: 1, decimals: 1 }));
    $("#judgeCount").value = size.judges;
    $("#minimumJudges").value = size.judges;
    $("#publicVoting").checked = false;
    $("#publicQr").checked = false;
    $("#publicQr").disabled = true;
    $("#penaltiesEnabled").checked = true;
    $("#penaltyNoteRequired").checked = true;
    updateTrialPreview();
    return { profile, size };
  }

  function populateGuidedDemo(organization, profile, size) {
    const event = ensureEventData(organization.events[0]);
    const names = ["Giulia Ferrari", "Sofia Romano", "Martina Gallo", "Aurora Conti", "Alice De Luca", "Camilla Greco", "Elena Ricci", "Beatrice Moretti", "Emma Costa", "Ginevra Rizzo", "Matilde Lombardi", "Vittoria Bruno", "Ludovica Fontana", "Greta Barbieri", "Noemi Marino", "Arianna Giordano", "Mia Bellini", "Bianca Marchetti", "Nicole Santoro", "Rebecca Caruso", "Gaia Ferri", "Asia Leone", "Clara Martinelli", "Irene De Angelis"];
    const clubs = ["Freestyle Academy", "Aerial Dream", "Move Studio", "Aria Lab", "Sport Project", "Performance Center"];
    const judgeNames = ["Anna Bianchi", "Marco Rossi", "Laura Villa", "Paolo Serra", "Sara Conti", "Luca Morelli"];
    event.status = "live";
    event.rules = { text: "Ogni atleta viene valutato sui criteri configurati. Le penalità richiedono una motivazione. L'atleta successivo viene sbloccato soltanto dopo il completamento di tutti i voti previsti.", file: null };
    event.rounds = { enabled: true, finalistsPerCategory: 3, qualificationLabel: "Eliminatorie", finalLabel: "Finale" };
    event.judges = judgeNames.slice(0, size.judges).map((name, index) => ({ id: uid("judge"), name, language: "it", code: String(1111 + index * 1111), active: true, lastActivityAt: null }));
    event.participants = Array.from({ length: size.participants }, (_, index) => ({
      id: uid("participant"), name: names[index % names.length], club: clubs[index % clubs.length],
      categoryId: event.categories[index % event.categories.length].id,
      discipline: profile.disciplines[index % profile.disciplines.length], order: index + 1,
      status: index < 2 ? "completed" : index === 2 ? "competing" : "registered", round: "qualification", attempt: 1,
      description: index % 2 ? "Atleta dinamica, specializzata nelle transizioni e nelle figure di forza." : "Interprete elegante con una preparazione tecnica completa.",
      choreographyTitle: index % 3 ? ["Oltre il cielo", "Equilibrio", "Rinascita"][index % 3] : "",
      choreographyTheme: index % 3 ? ["La libertà di superare i propri limiti.", "Il dialogo tra forza e leggerezza.", "Un viaggio dalla fragilità alla consapevolezza."][index % 3] : "",
      specialRequests: index % 4 === 0 ? "Ingresso dal lato destro e luce blu in apertura." : "",
      performanceDuration: 150 + (index % 4) * 15,
      attachments: { music: { name: `demo-${index + 1}.mp3`, type: "audio/mpeg", size: 0, durationSeconds: 150 + (index % 4) * 15, status: "demo" } }
    }));
    const submittedAt = new Date().toISOString();
    event.scores = [];
    event.participants.slice(0, 2).forEach((participant, participantIndex) => {
      event.judges.forEach((judge, judgeIndex) => {
        const values = {};
        event.scoring.criteria.forEach((criterion, criterionIndex) => {
          values[criterion.id] = Math.min(9.8, 7.2 + ((participantIndex * 3 + judgeIndex + criterionIndex) % 18) / 10);
        });
        event.scores.push({ id: uid("score"), participantId: participant.id, judgeId: judge.id, round: "qualification", attempt: 1, values, penalty: 0, note: "", submittedAt });
        judge.lastActivityAt = submittedAt;
      });
    });
    event.control = { currentParticipantId: event.participants[2]?.id || event.participants[0]?.id || null, status: "running", mode: "automatic", round: "qualification", repeatQueue: [], voteStartedAt: new Date().toISOString() };
    organization.demo = { generated: true, profile: onboardingProfile, size: onboardingSize };
    organization.updatedAt = new Date().toISOString();
  }

  function hideOnboarding() {
    $("#onboarding").classList.add("hidden");
  }

  function showOnboarding() {
    $("#accountScreen")?.classList.add("hidden");
    $$("[data-demo-size]").forEach(button=>{button.disabled=button.dataset.demoSize!=="compact";button.classList.toggle("active",button.dataset.demoSize==="compact");});
    closeDashboardNavigation();
    $("#onboarding").classList.remove("hidden");
  }

  async function createGuidedDemo() {
    if (!organizerAccount) {showAccountScreen("signup");return;}
    onboardingSize="compact";
    const { profile, size } = applyOnboardingDefaults();
    const organization = formData();
    ensureCloudIdentity(organization);
    populateGuidedDemo(organization, profile, size);
    organization.events[0].categories=organization.events[0].categories.slice(0,2);
    organization.events[0].publicVoting.enabled=false;
    organization.events[0].publicVotes=[];
    try {await registerCloudTenant(organization);}catch(error){showToast(error.message);return;}
    platform.organizations.push(organization);
    platform.activeOrganizationId = organization.id;
    editingOrganizationId = organization.id;
    persistPlatform();
    queueCloudSync(organization);
    renderOrganizationList();
    hideOnboarding();
    showDashboard(organization);
  }

  function startGuidedConfiguration() {
    if (!organizerAccount) {showAccountScreen("signup");return;}
    onboardingSize="compact";
    applyOnboardingDefaults();
    hideOnboarding();
    showConfigurator();
    $("#judgeCount").max="3";$("#minimumJudges").max="3";$("#publicVoting").disabled=false;$("#publicQr").disabled=!$("#publicVoting").checked;
    $("#eventFiles").disabled=true;
  }

  function updateTrialPreview() {
    const days = 14;
    $("#trialPreview").textContent = `${days} ${days === 1 ? "giorno" : "giorni"}`;
  }

  function trialDaysRemaining(organization) {
    const end = new Date(organization.subscription.trialEndsAt).getTime();
    return Math.max(0, Math.ceil((end - Date.now() - (organization.cloud?.serverOffset || 0)) / 86400000));
  }

  function showDashboard(organization) {
    closeDashboardNavigation();
    const event = organization.events[0];
    const role = organization.cloud?.role;
    const roleModules = { judge: "judge", presenter: "presenter", control: "control", staff: "staff", public: "public" };
    const initialModule = roleModules[role] || "overview";
    applyBrandTheme(organization.brand.primaryColor, organization.brand.accentColor);
    $("main.layout").classList.add("hidden");
    $("#dashboard").classList.remove("hidden");
    $("#dashboardOrg").textContent = organization.name;
    $("#dashboardEvent").textContent = event.name;
    $("#navToggle").classList.toggle("hidden", Boolean(role));
    updateConnectionStatus();
    $("#dashboardPlan").textContent = role ? `Postazione ${stationLabels[role] || role}` : organization.subscription.status === "trialing" ? "Prova gratuita" : organization.subscription.plan;
    $("#dashboardTrial").textContent = role ? `Accesso ${stationLabels[role] || role}` : `${trialDaysRemaining(organization)} giorni di prova rimasti`;
    $(".dashboard-nav nav").classList.toggle("hidden", Boolean(role));
    $("#newConfigBtn").classList.toggle("hidden", Boolean(role));
    $("#backToConfigBtn").textContent = role ? "Disconnetti postazione" : "Modifica configurazione";
    $(".dashboard-header .eyebrow").textContent = role ? "Postazione collegata" : "Il tuo evento";
    $$(".dash-link").forEach(link => link.classList.toggle("active", link.dataset.module === initialModule));
    currentDashboardModule = initialModule;
    renderDashboardModule(initialModule, organization);
    updateTrialBanner(organization);
    startCloudPolling(organization);
    window.location.hash = "dashboard";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateTrialBanner(organization) {
    if(!organization.entitlements)return;
    $("#dashboardPlan").textContent=organization.subscription.status==="active" ? organization.subscription.plan : trialReadOnly(organization)?"Prova terminata · sola lettura":"Prova gratuita";
    $("#dashboardTrial").textContent=organization.subscription.status==="active"?"Licenza attiva":trialReadOnly(organization)?"I dati restano consultabili ed esportabili":`${trialDaysRemaining(organization)} giorni rimasti · ${organization.entitlements.emailUsed}/10 invii email`;
  }

  function showConfigurator() {
    closeDashboardNavigation();
    clearInterval(cloudPollTimer);
    $("#newConfigBtn").classList.remove("hidden");
    applyBrandTheme($("#primaryColor").value, $("#accentColor").value);
    $("#dashboard").classList.add("hidden");
    $("main.layout").classList.remove("hidden");
    window.location.hash = "configurazione";
    goToStep(1);
  }

  function disconnectRoleDevice(organization) {
    clearInterval(cloudPollTimer);
    $("#newConfigBtn").classList.remove("hidden");
    platform.organizations = platform.organizations.filter(item => item.id !== organization.id);
    platform.activeOrganizationId = platform.organizations[0]?.id || null;
    persistPlatform();
    const next = platform.organizations[0];
    if (next) loadOrganization(next.id, true);
    else showOnboarding();
  }

  async function joinSharedDevice() {
    const params = new URLSearchParams(window.location.search);
    const tenantKey = String(params.get("tenant") || "").trim().toLowerCase();
    const accessToken = String(params.get("token") || "");
    if (!tenantKey || accessToken.length < 24) return null;
    const response = await fetch(`/api/tenants/${encodeURIComponent(tenantKey)}/device-state`, {
      headers: { "X-ScoreFlow-Access": accessToken }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.state) throw new Error(result.message || "Il collegamento non è valido o è stato sostituito.");
    const existing = platform.organizations.find(item => item.cloud?.tenantKey === tenantKey && item.cloud?.role === result.role);
    const organization = result.state;
    organization.id = existing?.id || uid("device");
    organization.cloud = {
      tenantKey,
      accessToken,
      role: result.role,
      eventId: result.eventId,
      revision: Number(result.revision),
      status: "online",
      lastSyncedAt: new Date().toISOString()
    };
    const existingIndex = platform.organizations.findIndex(item => item.id === organization.id);
    if (existingIndex >= 0) platform.organizations[existingIndex] = organization;
    else platform.organizations.push(organization);
    platform.activeOrganizationId = organization.id;
    editingOrganizationId = organization.id;
    persistPlatform();
    history.replaceState({}, "", `${window.location.pathname}#dashboard`);
    return organization;
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
      if (lines.length < 2) return showToast("Il CSV non contiene righe da importare.");
      const separator = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : ",";
      const headers = parseCsvLine(lines[0], separator).map(item => item.toLowerCase().trim());
      const findColumn = names => headers.findIndex(header => names.includes(header));
      const nameIndex = findColumn(["nome", "atleta", "partecipante", "name"]);
      const surnameIndex = findColumn(["cognome", "surname"]);
      const clubIndex = findColumn(["societa", "società", "scuola", "club"]);
      const categoryIndex = findColumn(["categoria", "category"]);
      const disciplineIndex = findColumn(["disciplina", "discipline", "attrezzo"]);
      if (nameIndex < 0) return showToast("Nel CSV serve una colonna Nome, Atleta o Partecipante.");
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
    $("#participantsCsv").disabled=organization.entitlements?.status==="trialing" || trialReadOnly(organization);
    if(organization.entitlements?.status==="trialing") $("#participantsCsv").closest("article").querySelector("p").textContent="Importazioni massive disponibili con licenza completa. Nella prova puoi inserire fino a 6 atleti a mano o tramite iscrizioni pubbliche.";
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
    const storageLabel = attachment?.cloudPath ? "Cloud" : attachment?.blobKey ? "Solo dispositivo" : "";
    return `<div class="athlete-upload-wrap"><label class="athlete-upload"><span>${label}</span><small>${attachment ? `${escapeHtml(attachment.name)} · ${formatBytes(attachment.size)}${storageLabel ? ` · ${storageLabel}` : ""}` : "Nessun file caricato"}</small><input type="file" data-athlete-file="${key}" accept="${accept}"><em>${attachment ? "Sostituisci file" : "Carica file"}</em></label>${attachment?.blobKey || attachment?.cloudPath ? `<button class="button mini open-athlete-file" data-attachment-key="${key}">Apri file</button>` : ""}</div>`;
  }

  async function readAthletePhoto(file, participant, organization) {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 1024 * 1024) return showToast("Per questa prova la foto deve essere inferiore a 1 MB.");
    participant.photoDataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    try {
      const cloud = await uploadCloudFile(organization, file, `athletes/${participant.id}/photo`);
      participant.photoFile = { name: file.name, size: file.size, type: file.type, ...cloud };
      saveRuntime(organization);
      renderParticipantDetail(organization, participant.id, "Foto atleta salvata nel cloud.");
    } catch (error) {
      saveRuntime(organization);
      renderParticipantDetail(organization, participant.id, `Foto conservata nella scheda, ma il cloud segnala: ${error.message}`);
    }
  }

  function printAthleteBadge(organization, participant) {
    const event = organization.events[0];
    const popup = window.open("", "_blank", "width=600,height=760");
    if (!popup) return showToast("Consenti le finestre popup per stampare il badge.");
    const logo = organization.brand.logoDataUrl || organization.brand.logoUrl || "";
    popup.document.write(`<!doctype html><html><head><title>Badge ${escapeHtml(participant.name)}</title><style>*{box-sizing:border-box}body{margin:0;padding:25px;background:#eef2f6;font-family:Arial,sans-serif}.badge{width:360px;min-height:520px;margin:auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 18px 55px #1113;border-top:14px solid ${organization.brand.primaryColor || "#c1121f"}.head{padding:22px;text-align:center;border-bottom:4px solid ${organization.brand.accentColor || "#d4af37"}}.head img{max-width:150px;max-height:60px}.photo{width:150px;height:150px;border-radius:50%;object-fit:cover;margin:25px auto 12px;display:block;border:6px solid #f1f5f9}.placeholder{width:150px;height:150px;border-radius:50%;margin:25px auto 12px;display:grid;place-items:center;background:#e2e8f0;font-size:58px;font-weight:900}.body{text-align:center;padding:0 24px 28px}.body h1{font-size:29px;margin:10px 0}.body p{color:#64748b}.chips{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.chips span{padding:8px 11px;border-radius:99px;background:#f1f5f9;font-weight:700}.number{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;margin-top:25px}@media print{body{background:#fff;padding:0}.badge{box-shadow:none;margin:0 auto}@page{size:A6;margin:8mm}}</style></head><body><main class="badge"><div class="head">${logo ? `<img src="${logo}" alt="Logo">` : `<strong>${escapeHtml(organization.name)}</strong>`}</div>${participant.photoDataUrl ? `<img class="photo" src="${participant.photoDataUrl}" alt="">` : `<div class="placeholder">${escapeHtml(participant.name.charAt(0) || "A")}</div>`}<div class="body"><div class="number">Atleta · uscita ${participant.order}</div><h1>${escapeHtml(participant.name)}</h1><p>${escapeHtml(participant.club || "Atleta indipendente")}</p><div class="chips"><span>${escapeHtml(categoryName(event, participant.categoryId))}</span><span>${escapeHtml(participant.discipline || "Disciplina")}</span></div></div></main><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  }

  function renderParticipantDetail(organization, participantId, message = "") {
    const event = ensureEventData(organization.events[0]);
    const participant = event.participants.find(item => item.id === participantId);
    if (!participant) return renderParticipants(organization);
    const attachments = participant.attachments || (participant.attachments = {});
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Scheda singolo atleta</p><h2>${escapeHtml(participant.name)}</h2><p>${escapeHtml(participant.club || "Atleta indipendente")} · ${escapeHtml(categoryName(event, participant.categoryId))}</p></div><button class="button ghost back-participants">← Partecipanti</button></div>
      <div class="athlete-profile-grid"><article class="dash-card athlete-profile"><div class="athlete-photo">${participant.photoDataUrl ? `<img src="${participant.photoDataUrl}" alt="Foto ${escapeHtml(participant.name)}">` : `<span>${escapeHtml(participant.name.charAt(0) || "A")}</span>`}</div><label class="button ghost photo-upload">Carica foto<input id="athletePhoto" type="file" accept="image/*"></label><button class="button primary print-badge">Stampa badge</button><small>La foto viene usata per riconoscimento e badge.</small></article>
      <article class="dash-card athlete-files"><h3>Documenti e materiali</h3>${athleteAttachmentCard("Video entry", "entryVideo", attachments.entryVideo, "video/*")}${athleteAttachmentCard("Certificato medico agonistico", "medicalCertificate", attachments.medicalCertificate, "image/*,.pdf")}${athleteAttachmentCard("Musica esibizione", "music", attachments.music, "audio/mpeg,audio/mp3,.mp3")}${attachments.music?.durationSeconds ? `<div class="file-duration">Durata MP3 rilevata: <strong>${formatDuration(attachments.music.durationSeconds)}</strong></div>` : ""}</article>
      <article class="dash-card athlete-competition"><h3>Dati gara</h3><div class="detail-list"><div><span>Ordine di uscita</span><strong>${participant.order}</strong></div><div><span>Fase</span><strong>${participant.round === "final" ? event.rounds.finalLabel : event.rounds.qualificationLabel}</strong></div><div><span>Tentativo valido</span><strong>${participant.attempt || 1}</strong></div><div><span>Categoria</span><strong>${escapeHtml(categoryName(event, participant.categoryId))}</strong></div><div><span>Durata MP3</span><strong>${musicDurationFor(participant) ? formatDuration(musicDurationFor(participant)) : "File non caricato"}</strong></div></div></article></div>
      <article class="dash-card athlete-story-editor"><div class="section-heading"><div><p class="eyebrow">Contenuti condivisi</p><h3>Presentazione e coreografia</h3><p class="muted">Queste informazioni saranno visibili a giudici, presentatore e regia.</p></div></div><form id="athleteStoryForm" class="operational-form"><label class="wide">Descrizione atleta<textarea id="athleteDescription" rows="3" placeholder="Profilo, esperienza e caratteristiche dell’atleta">${escapeHtml(participant.description)}</textarea></label><label>Titolo coreografia<input id="choreographyTitle" value="${escapeHtml(participant.choreographyTitle)}" placeholder="Facoltativo"></label><label>Tema coreografia<input id="choreographyTheme" value="${escapeHtml(participant.choreographyTheme)}" placeholder="Facoltativo"></label><div class="readonly-duration"><span>Durata performance</span><strong>${musicDurationFor(participant) ? formatDuration(musicDurationFor(participant)) : "In attesa dell’MP3"}</strong><small>La durata deriva esclusivamente dal file musicale.</small></div><label>Richieste speciali<input id="specialRequests" value="${escapeHtml(participant.specialRequests)}" placeholder="Luci, ingresso, attrezzatura..."></label><button class="button primary" type="submit">Salva dati atleta</button></form></article>
      <div class="feedback-banner success ${message ? "" : "hidden"}"><span>✓</span><div><strong>Operazione completata</strong><p>${escapeHtml(message)}</p></div></div>`;
    $(".back-participants").addEventListener("click", () => renderParticipants(organization));
    $("#athletePhoto").addEventListener("change", inputEvent => readAthletePhoto(inputEvent.target.files[0], participant, organization));
    $(".print-badge").addEventListener("click", () => printAthleteBadge(organization, participant));
    $$(".open-athlete-file", $("#moduleContent")).forEach(button => button.addEventListener("click", () => openManagedFile(organization, attachments[button.dataset.attachmentKey])));
    $$("[data-athlete-file]", $("#moduleContent")).forEach(input => input.addEventListener("change", async inputEvent => {
      const file = inputEvent.target.files[0];
      if (!file) return;
      const blobKey = `${event.id}:${participant.id}:${input.dataset.athleteFile}`;
      try { await storeLocalFile(blobKey, file); } catch (error) { console.error(error); return showToast("Non è stato possibile conservare il file su questo dispositivo."); }
      const durationSeconds = /^(audio|video)\//.test(file.type) ? await mediaDuration(file) : 0;
      let cloud = {};
      let cloudError = "";
      try { cloud = await uploadCloudFile(organization, file, `athletes/${participant.id}/${input.dataset.athleteFile}`); } catch (error) { cloudError = error.message; }
      attachments[input.dataset.athleteFile] = { name: file.name, type: file.type, size: file.size, durationSeconds, blobKey, ...cloud, status: cloud.cloudPath ? "stored-in-cloud" : "stored-locally", selectedAt: new Date().toISOString() };
      if (input.dataset.athleteFile === "music" && durationSeconds) participant.performanceDuration = Math.round(durationSeconds);
      saveRuntime(organization);
      renderParticipantDetail(organization, participant.id, cloudError ? `${file.name} salvato solo su questo dispositivo: ${cloudError}` : `${file.name} salvato nel cloud e associato alla scheda atleta.`);
    }));
    $("#athleteStoryForm").addEventListener("submit", submitEvent => {
      submitEvent.preventDefault();
      participant.description = $("#athleteDescription").value.trim();
      participant.choreographyTitle = $("#choreographyTitle").value.trim();
      participant.choreographyTheme = $("#choreographyTheme").value.trim();
      participant.performanceDuration = musicDurationFor(participant);
      participant.specialRequests = $("#specialRequests").value.trim();
      saveRuntime(organization);
      renderParticipantDetail(organization, participant.id, "Dati di presentazione salvati e condivisi con le postazioni.");
    });
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
      if (event.judges.length >= judgeLimit) return showToast(`Hai già configurato tutti i ${judgeLimit} giudici previsti.`);
      event.judges.push({ id: uid("judge"), name: $("#judgeName").value.trim(), language: $("#judgeLanguage").value, code: $("#judgeCode").value.trim() || String(Math.floor(1000 + Math.random() * 9000)), active: true });
      saveRuntime(organization); renderJudges(organization, "Giudice creato.");
    });
    $$(".toggle-judge", $("#moduleContent")).forEach(button => button.addEventListener("click", () => { const judge = event.judges.find(item => item.id === button.dataset.id); judge.active = !judge.active; saveRuntime(organization); renderJudges(organization, "Stato del giudice aggiornato."); }));
    $$(".remove-judge", $("#moduleContent")).forEach(button => button.addEventListener("click", () => { if (!confirm("Eliminare il giudice e tutti i suoi voti?")) return; event.judges = event.judges.filter(item => item.id !== button.dataset.id); event.scores = event.scores.filter(item => item.judgeId !== button.dataset.id); saveRuntime(organization); renderJudges(organization, "Giudice eliminato."); }));
  }

  function judgeScore(event, score) {
    return ScoreFlowRules.judgeScore(event, score);
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
    const criterionMeans = Object.fromEntries(event.scoring.criteria.map(c => [c.id, scores.reduce((sum, s) => sum + Number(s.values?.[c.id] || 0), 0) / scores.length]));
    return { total, criterionMeans, count: values.length, complete: values.length >= event.scoring.minimumJudges };
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

  function saveScoreFromForm(event, organization, participant, judge, root, onSaved, options = {}) {
    const penalty = Number($("#scorePenalty", root)?.value || 0);
    const penaltyNote = $("#scoreNote", root)?.value.trim() || "";
    const judgeNote = $("#judgeOptionalNote", root)?.value.trim() || "";
    const overrideReason = $("#overrideReason", root)?.value.trim() || "";
    if (options.override && !overrideReason) return { ok: false, error: "Inserisci la motivazione dell’override." };
    if (penalty > 0 && event.scoring.penalties.noteRequired && !penaltyNote) return { ok: false, error: "Inserisci la motivazione della penalità." };
    const values = {};
    $$(".score-value", root).forEach(input => { values[input.dataset.criterion] = Number(input.value); });
    const score = { id: uid("score"), participantId: participant.id, judgeId: judge.id, round: participant.round || activeRound(event), attempt: participant.attempt || 1, values, penalty, note: penaltyNote, penaltyNote, judgeNote, submittedAt: new Date().toISOString(), locked: true };
    const ruleErrors = ScoreFlowRules.scoreErrors(event, score);
    if (ruleErrors.length) return { ok: false, error: ruleErrors.join(" ") };
    const existingIndex = event.scores.findIndex(item => item.participantId === participant.id && item.judgeId === judge.id && (item.round || "qualification") === score.round && Number(item.attempt || 1) === score.attempt);
    if (existingIndex >= 0) {
      const original = event.scores[existingIndex];
      if (options.override) {
        score.replacesScoreId = original.id;
        event.scoreHistory.push({
          id: uid("score-audit"), type: "manual-override", participantId: participant.id, judgeId: judge.id,
          round: score.round, attempt: score.attempt, originalScoreId: original.id, replacementScoreId: score.id,
          originalScore: JSON.parse(JSON.stringify(original)), replacementScore: JSON.parse(JSON.stringify(score)),
          actor: { role: "control", email: organizerAccount?.email || "account-owner" }, reason: overrideReason,
          createdAt: score.submittedAt
        });
      }
      event.scores[existingIndex] = score;
    } else {
      if (options.override) {
        event.scoreHistory.push({
          id: uid("score-audit"), type: "manual-override", participantId: participant.id, judgeId: judge.id,
          round: score.round, attempt: score.attempt, originalScoreId: null, replacementScoreId: score.id,
          originalScore: null, replacementScore: JSON.parse(JSON.stringify(score)),
          actor: { role: "control", email: organizerAccount?.email || "account-owner" }, reason: overrideReason,
          createdAt: score.submittedAt
        });
      }
      event.scores.push(score);
    }
    judge.lastActivityAt = score.submittedAt;
    saveRuntime(organization);
    onSaved();
    return { ok: true };
  }

  const judgeTranslations = {
    it: { back: "Postazioni", change: "Cambia giudice", athlete: "Atleta in pedana", scoring: "Scheda di valutazione", instruction: "Compila tutti i criteri configurati per l’evento.", sent: "Voto inviato e bloccato", sentText: "Il voto è stato ricevuto dalla regia e non può più essere modificato.", submit: "Invia voto definitivo", optionalNote: "Note facoltative per la scheda atleta", optionalPlaceholder: "Osservazioni tecniche o suggerimenti...", rules: "Regolamento di gara", search: "Cerca nel regolamento", noTitle: "Titolo coreografia assente", noTheme: "Testo tema coreografia assente", video: "Guarda video entry", waiting: "In attesa della regia" },
    en: { back: "Stations", change: "Change judge", athlete: "Athlete on stage", scoring: "Score sheet", instruction: "Complete every scoring criterion.", sent: "Score submitted and locked", sentText: "The control desk received the score. It can no longer be edited.", submit: "Submit final score", optionalNote: "Optional notes for the athlete report", optionalPlaceholder: "Technical observations or suggestions...", rules: "Competition rules", search: "Search the rules", noTitle: "Choreography title not provided", noTheme: "Choreography theme not provided", video: "Watch entry video", waiting: "Waiting for control" },
    fr: { back: "Postes", change: "Changer de juge", athlete: "Athlète en piste", scoring: "Fiche de notation", instruction: "Complétez tous les critères d’évaluation.", sent: "Note envoyée et verrouillée", sentText: "La régie a reçu la note. Elle ne peut plus être modifiée.", submit: "Envoyer la note définitive", optionalNote: "Notes facultatives pour la fiche athlète", optionalPlaceholder: "Observations techniques ou suggestions...", rules: "Règlement", search: "Rechercher dans le règlement", noTitle: "Titre de chorégraphie absent", noTheme: "Thème de chorégraphie absent", video: "Voir la vidéo d’entrée", waiting: "En attente de la régie" },
    es: { back: "Puestos", change: "Cambiar juez", athlete: "Atleta en pista", scoring: "Ficha de puntuación", instruction: "Completa todos los criterios de evaluación.", sent: "Voto enviado y bloqueado", sentText: "La mesa de control recibió el voto. Ya no se puede modificar.", submit: "Enviar voto definitivo", optionalNote: "Notas opcionales para la ficha del atleta", optionalPlaceholder: "Observaciones técnicas o sugerencias...", rules: "Reglamento", search: "Buscar en el reglamento", noTitle: "Título de coreografía ausente", noTheme: "Tema de coreografía ausente", video: "Ver vídeo de entrada", waiting: "Esperando a control" }
  };

  const stationLabels = {
    judge: "Giudici",
    presenter: "Presentatore",
    control: "Regia",
    staff: "Staff",
    public: "Pubblico"
  };

  function deviceLinksKey(organization) {
    return `scoreflow.deviceLinks.${organization.cloud?.tenantKey || organization.slug}`;
  }

  function loadDeviceLinks(organization) {
    try { return JSON.parse(localStorage.getItem(deviceLinksKey(organization))) || {}; }
    catch { return {}; }
  }

  function saveDeviceLinks(organization, links) {
    localStorage.setItem(deviceLinksKey(organization), JSON.stringify(links));
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(value); return; }
      catch { /* usa il fallback per browser mobili o permessi limitati */ }
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  async function createDeviceAccessLink(organization, role) {
    const cloud = ensureCloudIdentity(organization);
    if (!cloud.secret || !cloud.revision) throw new Error("Attendi la prima sincronizzazione cloud e riprova.");
    const event = ensureEventData(organization.events[0]);
    const response = await fetch(`/api/tenants/${encodeURIComponent(cloud.tenantKey)}/access`, {
      method: "POST",
      headers: cloudHeaders(cloud, true),
      body: JSON.stringify({ role, eventId: event.id, label: stationLabels[role] || role })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Creazione collegamento non riuscita.");
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    url.searchParams.set("tenant", cloud.tenantKey);
    url.searchParams.set("token", result.token);
    url.searchParams.set("role", role);
    const links = loadDeviceLinks(organization);
    links[role] = { url: url.toString(), createdAt: result.createdAt };
    saveDeviceLinks(organization, links);
    return links[role];
  }

  async function generatePublicQr(organization) {
    const cloud = ensureCloudIdentity(organization);
    const event = ensureEventData(organization.events[0]);
    if (!event.publicVoting.enabled || !event.publicVoting.qrEnabled) throw new Error("Attiva voto pubblico e QR pubblico nella configurazione.");
    let publicLink = loadDeviceLinks(organization).public;
    if (!publicLink) publicLink = await createDeviceAccessLink(organization, "public");
    const response = await fetch(`/api/tenants/${encodeURIComponent(cloud.tenantKey)}/public-qr`, {
      method: "POST", headers: cloudHeaders(cloud, true), body: JSON.stringify({ url: publicLink.url })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Generazione QR non riuscita.");
    return result;
  }

  function renderStations(organization) {
    const event = ensureEventData(organization.events[0]);
    const links = loadDeviceLinks(organization);
    const stations = [
      ["judge", "01", "Singolo giudice", "Accesso con codice personale e scheda di voto dedicata.", `${event.judges.filter(item => item.active).length} accessi attivi`],
      ["presenter", "02", "Presentatore", "Atleta in pedana, prossimo concorrente e informazioni essenziali.", "Vista da palco"],
      ["control", "03", "Regia", "Ordine di gara, stati, ricezione voti e override di emergenza.", `${event.scores.length} voti ricevuti`],
      ["staff", "04", "Staff", "Check-in, chiamata atleti, ritardi e ritiri.", `${event.participants.length} atleti`],
      ["public", "05", "Pubblico", "Vista live e voto popolare separato dalla classifica ufficiale.", event.publicVoting.enabled ? "Voto attivo" : "Solo visualizzazione"]
    ];
    const qrPanel = event.publicVoting.enabled ? `<article class="dash-card qr-panel"><div><p class="eyebrow">QR pubblico opzionale</p><h3>${event.publicVoting.qrEnabled ? "Genera il QR quando serve" : "QR non attivo"}</h3><p class="muted">Il cliente decide se abilitarlo. La funzione è inclusa anche nella prova gratuita.</p></div>${event.publicVoting.qrEnabled ? '<button class="button primary" id="generatePublicQr" type="button">Genera QR</button>' : ""}<div id="publicQrResult"></div></article>` : "";
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Centro operativo</p><h2>Postazioni gara</h2><p>Ogni ruolo vede soltanto le informazioni e i comandi necessari.</p></div><span class="live-chip"><i></i> Sistema pronto</span></div><div class="station-grid">${stations.map(([role, number, title, description, meta]) => `<button class="station-card station-${role}" data-station="${role}"><span class="station-number">${number}</span><div class="station-icon">${sfIcon(role === "judge" ? "judges" : role)}</div><h3>${title}</h3><p>${description}</p><small>${meta}</small><strong>Apri postazione →</strong></button>`).join("")}</div><article class="dash-card device-access-panel"><div class="section-heading"><div><p class="eyebrow">Accesso multi-dispositivo</p><h3>Collega telefoni, tablet e computer</h3><p class="muted">Genera un link per ciascun ruolo. Creandone uno nuovo, il precedente dello stesso ruolo viene disattivato.</p></div></div><div class="device-link-grid">${stations.map(([role,,title]) => `<div class="device-link-row"><div><strong>${escapeHtml(title)}</strong><small>${links[role] ? "Collegamento pronto" : "Non ancora generato"}</small></div><div>${links[role] ? `<button class="button ghost mini" data-copy-device="${role}">Copia link</button>` : ""}<button class="button primary mini" data-create-device="${role}">${links[role] ? "Rigenera" : "Genera link"}</button></div></div>`).join("")}</div><div id="deviceLinkMessage" class="inline-message"></div></article>${qrPanel}`;
    $$('[data-station]', $("#moduleContent")).forEach(button => button.addEventListener("click", () => activateDashboardModule(button.dataset.station, organization)));
    $$('[data-copy-device]', $("#moduleContent")).forEach(button => button.addEventListener("click", async () => {
      await copyText(loadDeviceLinks(organization)[button.dataset.copyDevice]?.url || "");
      setMessage("deviceLinkMessage", `Link ${stationLabels[button.dataset.copyDevice]} copiato.`, false);
    }));
    $$('[data-create-device]', $("#moduleContent")).forEach(button => button.addEventListener("click", async () => {
      const role = button.dataset.createDevice;
      button.disabled = true;
      button.textContent = "Creazione…";
      try {
        const link = await createDeviceAccessLink(organization, role);
        await copyText(link.url);
        renderStations(organization);
        setMessage("deviceLinkMessage", `Nuovo link ${stationLabels[role]} creato e copiato.`, false);
      } catch (error) {
        button.disabled = false;
        button.textContent = "Riprova";
        setMessage("deviceLinkMessage", error.message, true);
      }
    }));
    $("#generatePublicQr")?.addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      try {
        const result = await generatePublicQr(organization);
        $("#publicQrResult").innerHTML = `<div class="qr-preview">${result.svg}<div><a class="button ghost mini" href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}" download="scoreflow-public-qr.svg">Scarica QR</a><button class="button ghost mini" id="printPublicQr" type="button">Stampa QR</button></div><small>${escapeHtml(result.url)}</small></div>`;
        $("#printPublicQr").onclick = () => { const popup = window.open("", "_blank"); popup.document.write(`<html><body style="display:grid;place-items:center;min-height:95vh">${result.svg}<script>window.onload=()=>window.print()<\/script></body></html>`); popup.document.close(); };
      } catch (error) { setMessage("publicQrResult", error.message, true); }
      finally { event.currentTarget.disabled = false; }
    });
  }

  function renderJudgeStation(organization, judgeId = null, message = "") {
    const event = ensureEventData(organization.events[0]);
    const activeJudges = event.judges.filter(item => item.active);
    if (!judgeId) {
      activeJudgeSession = null;
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
    activeJudgeSession = { organizationId: organization.id, judgeId: judge.id };
    const language = judgeTranslations[judge.language] ? judge.language : "it";
    const t = judgeTranslations[language];
    const participant = currentParticipant(event);
    if (!participant) {
      $("#moduleContent").innerHTML = '<article class="module-placeholder"><h2>Nessun atleta</h2><p>La regia deve prima caricare i partecipanti.</p></article>';
      return;
    }
    const existingScore = participantScores(event, participant).find(item => item.judgeId === judge.id);
    const locked = !["ready", "competing"].includes(participant.status);
    const entryVideo = participant.attachments?.entryVideo;
    const rulesText = event.rules.text || "Nessun testo del regolamento disponibile.";
    $("#moduleContent").innerHTML = `<div class="role-shell judge-shell"><div class="role-top"><div><button class="button ghost station-back">← ${t.back}</button><button class="button ghost judge-logout">${t.change}</button></div><div class="judge-tools"><label>Language<select id="judgeUiLanguage"><option value="it" ${language === "it" ? "selected" : ""}>Italiano</option><option value="en" ${language === "en" ? "selected" : ""}>English</option><option value="fr" ${language === "fr" ? "selected" : ""}>Français</option><option value="es" ${language === "es" ? "selected" : ""}>Español</option></select></label><div class="judge-identity"><span>Giudice</span><strong>${escapeHtml(judge.name)}</strong></div></div></div>
      <article class="role-athlete judge-athlete-card"><div class="judge-athlete-photo">${participant.photoDataUrl ? `<img src="${participant.photoDataUrl}" alt="${escapeHtml(participant.name)}">` : `<span>${escapeHtml(participant.name.charAt(0) || "A")}</span>`}</div><div><p class="eyebrow">${t.athlete}</p><h2>${escapeHtml(participant.name)}</h2><span>${escapeHtml(participant.discipline || "Disciplina")} · ${escapeHtml(categoryName(event, participant.categoryId))}</span><p class="athlete-description">${escapeHtml(participant.description || "Descrizione atleta non presente.")}</p></div><span class="state-badge ${participant.status}">${locked ? t.waiting : participant.status === "competing" ? "Live" : "Ready"}</span></article>
      <div class="judge-info-grid"><article class="dash-card choreography-card"><span>Titolo</span><strong>${escapeHtml(participant.choreographyTitle || t.noTitle)}</strong><span>Tema</span><p>${escapeHtml(participant.choreographyTheme || t.noTheme)}</p>${entryVideo?.blobKey || entryVideo?.cloudPath ? `<button class="button ghost judge-entry-video">▶ ${t.video}</button>` : '<small>Video entry non caricato</small>'}</article><article class="dash-card judge-rules"><div class="section-heading"><div><h3>${t.rules}</h3><p class="muted">PDF e testo consultabile senza uscire dalla votazione.</p></div>${event.rules.file?.blobKey || event.rules.file?.cloudPath ? `<button class="button mini open-judge-rules">Apri PDF</button>` : ""}</div><label>${t.search}<input id="judgeRulesSearch" type="search" placeholder="${t.search}..."></label><div id="judgeRulesResult" class="rules-search-result">${escapeHtml(rulesText)}</div></article></div>
      <article class="dash-card judge-score-card"><div class="section-heading"><div><h3>${t.scoring}</h3><p class="muted">${existingScore ? t.sentText : t.instruction}</p></div></div>
      ${existingScore ? `<div class="feedback-banner success permanent"><span>✓</span><div><strong>${t.sent}</strong><p>${t.sentText}</p><small>${new Date(existingScore.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div></div>` : locked ? `<div class="waiting-panel"><span>⌛</span><strong>${t.waiting}</strong><p>La regia deve chiamare o avviare l’atleta.</p></div>` : `<form id="judgeScoreForm"><div class="judge-criteria-grid">${scoreFields(event)}</div>${event.scoring.penalties.enabled ? `<div class="penalty-panel"><label>Penalità<input id="scorePenalty" type="number" min="0" step="0.1" value="0"></label><label>Motivazione penalità<input id="scoreNote" placeholder="Richiesta solo se applichi una penalità"></label></div>` : ""}<label class="judge-optional-note">${t.optionalNote}<textarea id="judgeOptionalNote" rows="3" placeholder="${t.optionalPlaceholder}"></textarea></label><button class="button primary score-submit" type="submit">${t.submit}</button></form>`}
      <div id="judgeVoteFeedback" class="feedback-banner ${message ? "success" : "hidden"}"><span>✓</span><div><strong>${t.sent}</strong><p>${escapeHtml(message)}</p></div></div></article></div>`;
    $("#judgeScoreForm")?.setAttribute("data-score-context", controlScoreContext(organization, judge.id));
    $(".station-back").addEventListener("click", () => activateDashboardModule("stations", organization));
    $(".judge-logout").addEventListener("click", () => renderJudgeStation(organization));
    $("#judgeUiLanguage").addEventListener("change", changeEvent => { judge.language = changeEvent.target.value; saveRuntime(organization); renderJudgeStation(organization, judge.id); });
    if ($(".judge-entry-video")) $(".judge-entry-video").addEventListener("click", () => previewManagedVideo(organization, entryVideo, `Video entry · ${participant.name}`));
    if ($(".open-judge-rules")) $(".open-judge-rules").addEventListener("click", () => openManagedFile(organization, event.rules.file));
    $("#judgeRulesSearch").addEventListener("input", inputEvent => {
      const query = inputEvent.target.value.trim().toLocaleLowerCase(language);
      const result = $("#judgeRulesResult");
      if (!query) { result.textContent = rulesText; return; }
      const matches = rulesText.split(/\n+/).filter(line => line.toLocaleLowerCase(language).includes(query));
      result.textContent = matches.length ? matches.join("\n") : "Nessuna corrispondenza trovata.";
      result.classList.toggle("no-result", !matches.length);
    });
    if ($("#judgeScoreForm")) $("#judgeScoreForm").addEventListener("submit", submitEvent => {
      submitEvent.preventDefault();
      if (participantScores(event, participant).some(item => item.judgeId === judge.id)) return renderJudgeStation(organization, judge.id, "Il voto era già stato inviato ed è rimasto bloccato.");
      const result = saveScoreFromForm(event, organization, participant, judge, $("#judgeScoreForm"), () => renderJudgeStation(organization, judge.id, "Voto inviato correttamente alla regia."));
      if (!result?.ok) {
        const feedback = $("#judgeVoteFeedback");
        feedback.className = "feedback-banner error";
        feedback.innerHTML = `<span>!</span><div><strong>Voto non inviato</strong><p>${escapeHtml(result.error)}</p></div>`;
        feedback.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  function renderPresenter(organization) {
    const event = ensureEventData(organization.events[0]);
    const current = currentParticipant(event);
    const ordered = [...event.participants].sort((a, b) => a.order - b.order);
    const selected = ordered.find(item => item.id === event.presenter.selectedParticipantId) || current;
    if (selected) event.presenter.selectedParticipantId = selected.id;
    const selectedIndex = selected ? ordered.findIndex(item => item.id === selected.id) : -1;
    const next = selectedIndex >= 0 ? ordered[selectedIndex + 1] || null : null;
    const notes = selected ? event.presenter.notes[selected.id] || "" : "";
    $("#moduleContent").innerHTML = `<div class="role-shell presenter-shell"><div class="role-top"><button class="button ghost station-back">← Postazioni</button><span class="live-chip"><i></i> Vista presentatore</span></div>${operationalNotifications(event) ? `<div class="ops-notifications">${operationalNotifications(event)}</div>` : ""}${selected ? `<div class="presenter-navigation"><button class="button ghost presenter-prev" ${selectedIndex <= 0 ? "disabled" : ""}>← Precedente</button><span>Uscita ${selected.order} di ${ordered.length}${selected.id === current?.id ? " · in pedana" : ""}</span><button class="button ghost presenter-next" ${selectedIndex >= ordered.length - 1 ? "disabled" : ""}>Successivo →</button></div><article class="presenter-stage"><p>${escapeHtml(event.name)}</p><span class="presenter-kicker">${selected.id === current?.id ? "Ora in pedana" : "Anteprima scaletta"}</span><h2>${escapeHtml(selected.name)}</h2><h3>${escapeHtml(selected.club || "Atleta indipendente")}</h3><div class="presenter-meta"><span>${escapeHtml(selected.discipline || "Disciplina")}</span><span>${escapeHtml(categoryName(event, selected.categoryId))}</span><span>Durata ${musicDurationFor(selected) ? formatDuration(musicDurationFor(selected)) : "MP3 assente"}</span></div></article>
      <div class="presenter-detail-grid"><article class="dash-card presenter-copy"><span>Titolo coreografia</span><strong>${escapeHtml(selected.choreographyTitle || "Titolo non presente")}</strong><span>Tema coreografia</span><p>${escapeHtml(selected.choreographyTheme || "Testo del tema non presente")}</p><span>Richieste speciali</span><p>${escapeHtml(selected.specialRequests || "Nessuna richiesta speciale")}</p></article><article class="dash-card presenter-notes"><h3>Note del presentatore</h3><p class="muted">Si salvano automaticamente e restano disponibili anche dopo la chiusura della pagina.</p><textarea id="presenterNotes" rows="8" placeholder="Appunti, pronuncia, sponsor, introduzione...">${escapeHtml(notes)}</textarea><small id="presenterNoteStatus">Note salvate</small></article></div>
      <article class="next-athlete"><span>Dopo</span><strong>${next ? escapeHtml(next.name) : "Fine della sessione"}</strong><small>${next ? `${escapeHtml(next.discipline || "")} · ${escapeHtml(categoryName(event, next.categoryId))} · ${musicDurationFor(next) ? formatDuration(musicDurationFor(next)) : "MP3 assente"}` : "Nessun altro atleta in coda"}</small>${next ? `<em>${escapeHtml(next.specialRequests || "Nessuna richiesta speciale")}</em>` : ""}</article>` : '<article class="module-placeholder"><h2>Nessun atleta in gara</h2></article>'}<div class="role-actions"><button class="button ghost role-refresh">Aggiorna schermata</button></div></div>`;
    $(".station-back").addEventListener("click", () => activateDashboardModule("stations", organization));
    $(".role-refresh").addEventListener("click", () => renderPresenter(organization));
    if ($(".presenter-prev")) $(".presenter-prev").addEventListener("click", () => { event.presenter.selectedParticipantId = ordered[selectedIndex - 1]?.id; saveRuntime(organization); renderPresenter(organization); });
    if ($(".presenter-next")) $(".presenter-next").addEventListener("click", () => { event.presenter.selectedParticipantId = ordered[selectedIndex + 1]?.id; saveRuntime(organization); renderPresenter(organization); });
    if ($("#presenterNotes")) $("#presenterNotes").addEventListener("input", inputEvent => { event.presenter.notes[selected.id] = inputEvent.target.value; saveRuntime(organization); $("#presenterNoteStatus").textContent = `Salvate alle ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`; });
    $$("[data-notification-participant]", $("#moduleContent")).forEach(button => button.addEventListener("click", () => { event.presenter.selectedParticipantId = button.dataset.notificationParticipant; renderPresenter(organization); }));
  }

  function renderStaff(organization, message = "") {
    const event = ensureEventData(organization.events[0]);
    const rows = event.participants.filter(participant => (participant.round || "qualification") === activeRound(event)).map((participant, index) => `<article class="staff-row ${participant.id === event.control.currentParticipantId ? "current" : ""}"><span class="staff-order">${participant.order || index + 1}</span><div><strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(participant.discipline || "")} · ${escapeHtml(categoryName(event, participant.categoryId))}</small></div><span class="state-badge ${participant.status}">${participant.status === "ready" ? "Pronto" : participant.status === "delayed" ? "In ritardo" : participant.status === "dns" ? "Ritirato" : participant.status === "completed" ? "Concluso" : participant.status === "competing" ? "In pedana" : participant.status === "repeat" ? "Ripetizione" : "Da chiamare"}</span><div class="staff-actions"><button class="button mini staff-status" data-id="${participant.id}" data-status="ready">Pronto</button><button class="button mini staff-status" data-id="${participant.id}" data-status="delayed">Ritardo</button><button class="button mini danger staff-status" data-id="${participant.id}" data-status="dns">Ritirato</button></div></article>`).join("");
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Area operativa</p><h2>Postazione staff</h2><p>Prepara gli atleti e aggiorna la regia in tempo reale.</p></div><button class="button ghost station-back">← Postazioni</button></div>${operationalNotifications(event) ? `<div class="ops-notifications">${operationalNotifications(event)}</div>` : ""}<div class="staff-list">${rows || '<article class="module-placeholder">Nessun partecipante inserito.</article>'}</div><div class="feedback-banner success ${message ? "" : "hidden"}"><span>✓</span><div><strong>Aggiornamento condiviso</strong><p>${escapeHtml(message)}</p></div></div>`;
    $(".station-back").addEventListener("click", () => activateDashboardModule("stations", organization));
    $$(".staff-status", $("#moduleContent")).forEach(button => button.addEventListener("click", () => {
      const participant = event.participants.find(item => item.id === button.dataset.id);
      participant.status = button.dataset.status;
      participant.updatedAt = new Date().toISOString();
      const statusLabel = button.dataset.status === "ready" ? "pronto" : button.dataset.status === "delayed" ? "in ritardo" : "ritirato";
      pushNotification(event, participant, `Lo staff ha segnato ${participant.name} come ${statusLabel}.`);
      saveRuntime(organization);
      renderStaff(organization, `Stato di ${participant.name} aggiornato.`);
    }));
    $$("[data-notification-participant]", $("#moduleContent")).forEach(button => button.addEventListener("click", () => {
      const row = $(`.staff-status[data-id="${button.dataset.notificationParticipant}"]`, $("#moduleContent"))?.closest(".staff-row");
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.classList.add("notification-focus");
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
      if (!value) return showToast("Seleziona un voto da 1 a 10.");
      event.publicVotes.push({ id: uid("public"), participantId: participant.id, deviceId: publicDeviceId(), value, createdAt: new Date().toISOString() });
      localStorage.setItem(deviceKey, "1");
      saveRuntime(organization);
      renderPublic(organization, "Grazie: il tuo voto è stato registrato.");
    });
  }

  function controlScoreContext(organization, judgeId = null) {
    const event = ensureEventData(organization.events[0]);
    const participant = currentParticipant(event);
    return participant ? JSON.stringify([organization.id, event.id, participant.id, participant.round || activeRound(event), participant.attempt || 1, judgeId]) : "";
  }

  function readScoreFormDraft(selector) {
    const form = $(selector);
    if (!form) return null;
    return {
      context: form.dataset.scoreContext,
      judgeId: $("#scoreJudge", form)?.value,
      fields: $$(".score-value, #scorePenalty, #scoreNote, #judgeOptionalNote", form).map(input => ({
        criterionId: input.dataset.criterion || "",
        id: input.id,
        value: input.value
      }))
    };
  }

  function restoreScoreFormDraft(selector, draft) {
    const form = $(selector);
    if (!form || !draft || draft.context !== form.dataset.scoreContext) return;
    const judgeSelect = $("#scoreJudge", form);
    if (judgeSelect && ![...judgeSelect.options].some(option => option.value === draft.judgeId)) return;
    if (judgeSelect) judgeSelect.value = draft.judgeId;
    const fields = $$(".score-value, #scorePenalty, #scoreNote, #judgeOptionalNote", form);
    draft.fields.forEach(saved => {
      const input = fields.find(field => saved.criterionId ? field.dataset.criterion === saved.criterionId : field.id === saved.id);
      if (input) input.value = saved.value;
    });
  }

  function renderControlPreservingDraft(organization, message = "") {
    const draft = readScoreFormDraft("#scoreForm");
    renderControl(organization, message);
    restoreScoreFormDraft("#scoreForm", draft);
  }

  function renderJudgeStationPreservingDraft(organization) {
    const draft = readScoreFormDraft("#judgeScoreForm");
    const judgeId = activeJudgeSession?.organizationId === organization.id ? activeJudgeSession.judgeId : null;
    renderJudgeStation(organization, judgeId);
    restoreScoreFormDraft("#judgeScoreForm", draft);
  }

  function scheduleControlRefresh(organization) {
    clearTimeout(controlRefreshTimer);
    controlRefreshTimer = setTimeout(() => {
      if (currentDashboardModule !== "control") return;
      const latest = platform.organizations.find(item => item.id === organization.id);
      if (latest && editingOrganizationId === latest.id) renderControlPreservingDraft(latest);
    }, 15000);
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
    event.control.timeScope = event.control.timeScope || "event";
    const timedParticipants = event.control.timeScope === "category" ? event.participants.filter(item => item.categoryId === current.categoryId) : event.control.timeScope === "athlete" ? [current] : event.participants;
    const totalDuration = timedParticipants.reduce((sum, item) => sum + musicDurationFor(item), 0);
    const next = nextOrderedParticipant(event, current);
    const overrideHistory = event.scoreHistory.filter(item => item.type === "manual-override" && item.participantId === current.id).slice().reverse();
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Controllo gara · ${activeRound(event) === "final" ? event.rounds.finalLabel : event.rounds.qualificationLabel}</p><h2>Regia</h2><p>L’ordine è protetto: il concorrente successivo si sblocca soltanto quando tutti i giudici attivi hanno inviato il voto.</p></div><span class="count-chip">${event.participants.filter(item => item.status === "completed" && (item.round || "qualification") === activeRound(event)).length}/${event.participants.filter(item => (item.round || "qualification") === activeRound(event)).length} completati</span></div>
      ${operationalNotifications(event) ? `<div class="ops-notifications">${operationalNotifications(event)}</div>` : ""}
      <article class="dash-card control-settings"><div><strong>Avanzamento gara</strong><small>Automatico segue la scaletta; manuale abilita interventi e ripetizioni.</small></div><div class="segmented"><button data-control-mode="automatic" class="${event.control.mode === "automatic" ? "active" : ""}">Automatico</button><button data-control-mode="manual" class="${event.control.mode === "manual" ? "active" : ""}">Manuale</button></div></article>
      <article class="dash-card timing-dashboard"><div><span>Tempi selezionati</span><strong>${formatDuration(totalDuration)}</strong><small>${timedParticipants.length} performance</small></div><div class="segmented"><button data-time-scope="athlete" class="${event.control.timeScope === "athlete" ? "active" : ""}">Atleta</button><button data-time-scope="category" class="${event.control.timeScope === "category" ? "active" : ""}">Categoria</button><button data-time-scope="event" class="${event.control.timeScope === "event" ? "active" : ""}">Giornata</button></div></article>
      <div class="control-layout"><aside class="dash-card queue"><h3>Scaletta uscite</h3>${queue}${event.control.repeatQueue.length ? `<div class="repeat-queue"><strong>Ripetizioni programmate</strong>${event.control.repeatQueue.map(item => { const id = typeof item === "string" ? item : item.participantId; const athlete = event.participants.find(entry => entry.id === id); return athlete ? `<small>↻ ${escapeHtml(athlete.name)} · tra due categorie</small>` : ""; }).join("")}</div>` : ""}</aside><section class="control-stage">
        <article class="current-athlete"><p>${escapeHtml(current.discipline || "Disciplina")} · uscita ${current.order}</p><h2>${escapeHtml(current.name)}</h2><span>${escapeHtml(categoryName(event, current.categoryId))} · ${escapeHtml(current.club || "Nessuna società")} · tentativo ${current.attempt || 1} · ${musicDurationFor(current) ? formatDuration(musicDurationFor(current)) : "MP3 assente"}</span><div class="control-athlete-info"><div><small>Richieste attuali</small><strong>${escapeHtml(current.specialRequests || "Nessuna")}</strong></div><div><small>Prossimo · ${next ? (musicDurationFor(next) ? formatDuration(musicDurationFor(next)) : "MP3 assente") : "—"}</small><strong>${next ? `${escapeHtml(next.name)} — ${escapeHtml(next.specialRequests || "nessuna richiesta")}` : "Fine sessione"}</strong></div></div><div class="control-actions"><button class="button ghost status-button" data-status="ready">Chiama atleta</button><button class="button primary status-button" data-status="competing">Avvia esibizione</button><button class="button success status-button" data-status="completed" ${canConclude ? "" : "disabled"} title="${canConclude ? "Chiude l’esibizione" : "In attesa del voto di tutti i giudici attivi"}">Concludi e avanza</button><button class="button warning repeat-athlete" ${event.control.mode === "manual" ? "" : "disabled"} title="Disponibile in modalità manuale">Programma ripetizione</button><button class="button danger status-button" data-status="dns">Segna ritirato</button><button class="button ghost delete-current-athlete" ${current.status === "dns" && event.control.mode === "manual" ? "" : "disabled"} title="Disponibile solo per un atleta ritirato e in modalità manuale">Elimina definitivamente</button></div></article>
        <article class="dash-card vote-monitor"><div class="section-heading"><div><p class="eyebrow">Controllo votazione</p><h3>${progress.scores.length}/${progress.activeJudges.length} giudici hanno terminato</h3></div><button class="button ghost refresh-control">Aggiorna</button></div>${progress.complete ? '<div class="vote-complete">✓ Tutti i giudici hanno votato. È possibile avanzare.</div>' : `<div class="judge-alerts">${judgeWarnings(event, current) || '<div class="warning-box">Nessun giudice attivo configurato.</div>'}</div>`}<details class="rules-tip"><summary>Regolamento e indicazioni di gara</summary><p>${escapeHtml(event.rules.text || "Nessun regolamento inserito. Aggiungilo nella sezione Evento.")}</p></details></article>
        <article class="dash-card"><div class="section-heading"><div><p class="eyebrow">Emergenza regia</p><h3>Override voto manuale</h3><p class="muted">Usa questa funzione solo se la postazione di un giudice non è disponibile · ${currentScores.length}/${event.scoring.minimumJudges} voti minimi ricevuti</p></div></div>
          ${activeJudges.length ? `<form id="scoreForm"><div class="operational-form score-form"><label>Giudice<select id="scoreJudge">${activeJudges.map(judge => `<option value="${judge.id}">${escapeHtml(judge.name)}</option>`).join("")}</select></label>${criteriaFields}${event.scoring.penalties.enabled ? '<label>Penalità<input id="scorePenalty" type="number" min="0" step="0.1" value="0"></label><label class="wide">Motivazione penalità<input id="scoreNote" placeholder="Obbligatoria se la penalità è maggiore di zero"></label>' : ""}<label class="wide">Motivazione override *<textarea id="overrideReason" rows="2" maxlength="1200" required placeholder="Descrivi il motivo della sostituzione del voto"></textarea></label></div><button class="button primary" type="submit">Salva voto</button></form>` : '<p class="warning-box">Configura almeno un giudice attivo prima di inserire i voti.</p>'}
          <div class="submitted-scores">${currentScores.map(score => { const judge = event.judges.find(item => item.id === score.judgeId); return `<div><span>${escapeHtml(judge?.name || "Giudice eliminato")}</span><strong>${judgeScore(event, score).toFixed(2)}</strong></div>`; }).join("")}</div><details class="score-audit"><summary>Storico modifiche voto (${overrideHistory.length})</summary>${overrideHistory.length ? overrideHistory.map(item => `<div class="score-audit-row"><strong>${escapeHtml(event.judges.find(judge => judge.id === item.judgeId)?.name || "Giudice")}</strong><span>${item.originalScore ? judgeScore(event, item.originalScore).toFixed(2) : "—"} → ${judgeScore(event, item.replacementScore).toFixed(2)}</span><small>${escapeHtml(item.reason)} · ${escapeHtml(item.actor?.email || item.actor?.role || "regia")} · ${new Date(item.createdAt).toLocaleString(localeForLanguage(uiLanguage()))}</small></div>`).join("") : '<p>Nessuna modifica registrata.</p>'}</details><div class="inline-message success">${escapeHtml(message)}</div></article>
      </section></div>`;
    $$('[data-control-mode]', $("#moduleContent")).forEach(button => button.addEventListener("click", () => { event.control.mode = button.dataset.controlMode; saveRuntime(organization); renderControl(organization, `Avanzamento ${button.dataset.controlMode === "automatic" ? "automatico" : "manuale"} attivato.`); }));
    $$('[data-time-scope]', $("#moduleContent")).forEach(button => button.addEventListener("click", () => { event.control.timeScope = button.dataset.timeScope; saveRuntime(organization); renderControl(organization); }));
    $$(".queue-item", $("#moduleContent")).forEach(button => button.addEventListener("click", () => { if (event.control.mode !== "manual" || (current.status === "competing" && !progress.complete)) return; event.control.currentParticipantId = button.dataset.participant; saveRuntime(organization); renderControl(organization); }));
    $$(".status-button", $("#moduleContent")).forEach(button => button.addEventListener("click", () => {
      const status = button.dataset.status;
      if (status === "completed" && !voteProgress(event, current).complete) return showToast("Non puoi avanzare: almeno un giudice attivo non ha ancora terminato la votazione.");
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
    $(".repeat-athlete").addEventListener("click", () => { const scoreCount = participantScores(event, current).length; if (!confirm(`ATTENZIONE: programmando la ripetizione di ${current.name}, ${scoreCount} voti precedenti saranno rimossi dalla classifica e conservati soltanto nello storico annullato. Continuare?`)) return; archiveAndRepeat(event, current, current.categoryId); const nextAthlete = nextOrderedParticipant(event, current); if (nextAthlete) { event.control.currentParticipantId = nextAthlete.id; if (nextAthlete.id === current.id) event.control.repeatQueue = event.control.repeatQueue.filter(item => (typeof item === "string" ? item : item.participantId) !== nextAthlete.id); } event.control.voteStartedAt = null; saveRuntime(organization); renderControl(organization, `${current.name} inserita tra due categorie. I voti precedenti sono archiviati come annullati.`); });
    $(".delete-current-athlete").addEventListener("click", () => {
      if (current.status !== "dns" || event.control.mode !== "manual") return;
      const confirmation = prompt(`Eliminazione definitiva di ${current.name}: verranno cancellati roster e voti. Scrivi ELIMINA per confermare.`);
      if (confirmation !== "ELIMINA") return;
      event.participants = event.participants.filter(item => item.id !== current.id);
      event.scores = event.scores.filter(item => item.participantId !== current.id);
      event.publicVotes = event.publicVotes.filter(item => item.participantId !== current.id);
      event.control.repeatQueue = event.control.repeatQueue.filter(item => (typeof item === "string" ? item : item.participantId) !== current.id);
      event.participants.forEach((item, index) => { item.order = index + 1; });
      event.control.currentParticipantId = event.participants[0]?.id || null;
      saveRuntime(organization); renderControl(organization, `${current.name} eliminato definitivamente.`);
    });
    $("#scoreForm")?.setAttribute("data-score-context", controlScoreContext(organization));
    $(".refresh-control").addEventListener("click", () => renderControlPreservingDraft(organization));
    if ($("#scoreForm")) $("#scoreForm").addEventListener("submit", submitEvent => {
      submitEvent.preventDefault();
      const judgeId = $("#scoreJudge").value;
      const judge = activeJudges.find(item => item.id === judgeId);
      const result = saveScoreFromForm(event, organization, current, judge, $("#scoreForm"), () => renderControl(organization, "Override salvato con storico completo."), { override: true });
      if (!result?.ok) showToast(result.error);
    });
    $$("[data-notification-participant]", $("#moduleContent")).forEach(button => button.addEventListener("click", () => { event.control.mode = "manual"; event.control.currentParticipantId = button.dataset.notificationParticipant; saveRuntime(organization); renderControl(organization); }));
    if (current.status === "competing" && !progress.complete) scheduleControlRefresh(organization);
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
      return `<tr><td><strong>${escapeHtml(judge?.name || "Giudice non disponibile")}</strong></td>${values}<td>${Number(score.penalty || 0).toFixed(2)}${score.penaltyNote || score.note ? `<small>${escapeHtml(score.penaltyNote || score.note)}</small>` : ""}</td><td>${escapeHtml(score.judgeNote || "—")}</td><td><strong>${judgeScore(event, score).toFixed(2)}</strong></td></tr>`;
    }).join("");
    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Scheda ${escapeHtml(participant.name)}</title><style>
      :root{--primary:${organization.brand.primaryColor || "#c1121f"};--ink:#121826;--muted:#667085;--line:#d9dee7}*{box-sizing:border-box}body{margin:0;background:#eef1f5;color:var(--ink);font:14px Inter,Arial,sans-serif}.sheet{width:min(1120px,calc(100% - 32px));margin:24px auto;background:#fff;border-radius:20px;padding:34px;box-shadow:0 20px 60px #1118271c}.report-head{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid var(--primary);padding-bottom:22px}.report-head img{max-width:150px;max-height:74px;object-fit:contain}.kicker{color:var(--primary);font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:800}.report-head h1{font-size:32px;margin:6px 0}.report-head p{margin:3px 0;color:var(--muted)}.athlete{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;margin:24px 0}.athlete div{background:#f6f7f9;border-radius:12px;padding:14px}.athlete span,.athlete strong{display:block}.athlete span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.athlete strong{font-size:18px;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid var(--line);padding:10px;text-align:center}th{background:#f2f4f7}th:first-child,td:first-child{text-align:left}th small,td small{display:block;color:var(--muted);font-weight:400;margin-top:3px}.total{margin-top:22px;border-radius:15px;background:var(--ink);color:#fff;padding:20px;display:flex;justify-content:space-between;align-items:center}.total span,.total strong{display:block}.total small{color:#cbd5e1}.total strong{font-size:34px}.note{color:var(--muted);margin-top:18px;font-size:11px}.print{display:block;margin:18px auto 0;border:0;border-radius:10px;padding:11px 17px;background:var(--primary);color:#fff;font-weight:800;cursor:pointer}@media print{body{background:#fff}.sheet{width:100%;margin:0;padding:12px;box-shadow:none}.print{display:none}@page{size:landscape;margin:10mm}}</style></head><body><main class="sheet"><header class="report-head"><div><span class="kicker">Scheda ufficiale atleta</span><h1>${escapeHtml(event.name)}</h1><p>${escapeHtml(organization.name)} · ${escapeHtml(event.location || "")}</p><p>${escapeHtml(event.startsAt || "")} — ${escapeHtml(event.endsAt || "")}</p></div>${logo ? `<img src="${escapeHtml(logo)}" alt="Logo">` : ""}</header><section class="athlete"><div><span>Atleta</span><strong>${escapeHtml(participant.name)}</strong><small>${escapeHtml(participant.club || "Atleta indipendente")}</small></div><div><span>Categoria</span><strong>${escapeHtml(categoryName(event, participant.categoryId))}</strong></div><div><span>Disciplina</span><strong>${escapeHtml(participant.discipline || "—")}</strong></div></section><table><thead><tr><th>Giudice</th>${criteriaHeaders}<th>Penalità</th><th>Note giudice</th><th>Totale giudice</th></tr></thead><tbody>${scoreRows || `<tr><td colspan="${event.scoring.criteria.length + 4}">Nessun voto disponibile</td></tr>`}</tbody></table><section class="total"><div><span>Metodo di calcolo</span><strong style="font-size:18px">${escapeHtml(aggregationLabel(event.scoring.aggregation))}</strong><small>${result.count} voti ricevuti · minimo richiesto ${event.scoring.minimumJudges}</small></div><div><span>Totale finale</span><strong>${result.total === null ? "—" : result.total.toFixed(2)}</strong></div></section><p class="note">Documento generato da ScoreFlow. I punteggi riportano i criteri, i pesi, le penalità e le note facoltative dei giudici.</p><button class="print" onclick="window.print()">Stampa / salva in PDF</button></main></body></html>`;
  }

  function openAthleteReport(organization, participantId) {
    const participant = organization.events[0].participants.find(item => item.id === participantId);
    if (!participant) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return showToast("Il browser ha bloccato la scheda. Consenti i popup e riprova.");
    reportWindow.opener = null;
    reportWindow.document.open();
    reportWindow.document.write(athleteReportHtml(organization, participant));
    reportWindow.document.close();
  }

  function rankedCategory(event, category, round, includePromoted = false) {
    const rows = event.participants.filter(p => ScoreFlowRules.inGroup(p, category) && (includePromoted || (p.round || "qualification") === round))
      .map(participant => ({participant, result: includePromoted ? participantRoundResult(event, participant.id, round) : participantResult(event, participant.id)}));
    return ScoreFlowRules.rank(event, rows);
  }

  function renderResults(organization) {
    const event = ensureEventData(organization.events[0]);
    const resultRound = activeRound(event);
    const sections = ScoreFlowRules.groups(event).map(category => {
      const ranked = rankedCategory(event, category, resultRound);
      if (!ranked.length) return "";
      return `<article class="dash-card results-card"><div class="section-heading"><div><p class="eyebrow">Categoria</p><h3>${escapeHtml(category.name)}</h3></div></div><div class="table-wrap"><table><thead><tr><th>Pos.</th><th>Atleta</th><th>Voti</th><th>Risultato</th><th>Stato</th><th>Scheda</th></tr></thead><tbody>${ranked.map((item, index) => `<tr><td><strong>${item.rank ?? "—"}</strong></td><td class="athlete-cell"><strong>${escapeHtml(item.participant.name)}</strong><small>${escapeHtml(item.participant.club || "")}</small></td><td>${item.result.count}/${event.scoring.minimumJudges}</td><td><strong>${item.result.total === null ? "—" : item.result.total.toFixed(2)}</strong></td><td><span class="state-badge ${item.result.complete ? "completed" : "registered"}">${item.result.complete ? "Valido" : "Provvisorio"}</span></td><td><button class="button mini athlete-report" data-participant="${item.participant.id}" ${item.result.count ? "" : "disabled"}>Apri scheda</button></td></tr>`).join("")}</tbody></table></div></article>`;
    }).join("");
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Classifiche · ${resultRound === "final" ? event.rounds.finalLabel : event.rounds.qualificationLabel}</p><h2>Risultati</h2><p>I risultati sono calcolati automaticamente secondo i criteri, i pesi e le penalità configurate.</p></div><button id="exportResultsBtn" class="button ghost">Esporta CSV</button></div><div class="results-list">${sections || '<article class="module-placeholder"><p>Nessun partecipante da classificare.</p></article>'}</div>`;
    $("#exportResultsBtn").addEventListener("click", () => {
      const rows = [["Categoria", "Posizione", "Atleta", "Società", "Voti", "Risultato"]];
      ScoreFlowRules.groups(event).forEach(category => { rankedCategory(event, category, resultRound).forEach((item, index) => rows.push([category.name, item.rank ?? "", item.participant.name, item.participant.club || "", item.result.count, item.result.total === null ? "" : item.result.total.toFixed(2)])); });
      const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n");
      const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })); link.download = `${organization.slug}-risultati.csv`; link.click(); URL.revokeObjectURL(link.href);
    });
    $$(".athlete-report", $("#moduleContent")).forEach(button => button.addEventListener("click", () => openAthleteReport(organization, button.dataset.participant)));
  }

  function facRulesPanel(event) {
    const r=event.competitionRules;
    if (!r?.enabled) return `<article class="dash-card"><h3>Regole della competizione</h3><p>Collega categorie, ammissione e punteggi al regolamento FAC 2026. Le date delle iscrizioni si configurano nella sezione Iscrizioni.</p><button class="button primary" id="facActivate">Prepara profilo FAC 2026</button></article>`;
    const locked=event.scores.length>0;
    return `<article class="dash-card"><h3>Regole FAC 2026</h3><p>Metodo recuperato dal master di gara: somma dei sei criteri (massimo 60), meno la penalità del giudice, poi media dei totali dei tre giudici. Risultato mostrato con due decimali. Nel master sono presenti penalità inferiori a 1 punto, comprese 0,5 e 0,7.</p><p>Spareggio: Performance generale → Tecnica → Coreografia. Una parità residua mantiene la stessa posizione. Classifiche distinte per disciplina.</p><p>Le verifiche video e requisiti restano affidate alla regia. Sotto il minimo di partecipanti occorre decidere l’accorpamento o l’annullamento; nessun rimborso viene disposto automaticamente.</p>
    <form id="facSettings" class="operational-form"><label>Calcolo dei sei criteri<select id="facMode" ${locked?'disabled':''}><option value="average" ${r.criteriaMode==='average'?'selected':''}>Media dei criteri</option><option value="sum" ${r.criteriaMode==='sum'?'selected':''}>Somma dei criteri</option></select></label>
    <label>Calcolo fra giudici<select id="facAggregation" ${locked?'disabled':''}>${['average','sum'].map(v=>`<option value="${v}" ${event.scoring.aggregation===v?'selected':''}>${v==='average'?'Media':'Somma'}</option>`).join('')}</select></label>
    <label><input id="facConfirmed" type="checkbox" ${r.decisionsConfirmed?'checked':''} ${locked?'disabled':''}>Confermo il metodo di calcolo e la penalità sottratta a ogni totale giudice</label>
    ${[['penaltyMin','Penalità minima',0.5],['penaltyMax','Penalità massima',10],['minimumEntries','Minimo partecipanti per disciplina e categoria',3],['singleFee','Quota singolo (€)',60],['duoFee','Quota duo (€)',100],['coachRatio','Atleti per pass coach',3],['videoMinSeconds','Durata minima video entry (secondi)',90]].map(([key,label,def])=>`<label>${label}<input data-fac-setting="${key}" type="number" min="${key.startsWith('penalty')||key.includes('Fee')?'0':'1'}" max="10000" step="${key.startsWith('penalty')?'0.1':'1'}" value="${Number(r[key] ?? def)}" required ${locked?'disabled':''}></label>`).join('')}
    ${event.categories.map(c=>`<label>${escapeHtml(c.name)}<select data-fac-category="${escapeHtml(c.id)}" ${locked?'disabled':''}><option value="">Da associare</option>${ScoreFlowRules.catalog.map(spec=>`<option value="${spec.key}" ${r.categories[c.id]===spec.key?'selected':''}>${spec.name}</option>`).join('')}</select></label>`).join('')}
    <button class="button primary" ${locked?'disabled':''}>Salva regole</button></form>
    <p>${locked?'Regole bloccate: sono già presenti voti.':r.decisionsConfirmed?'Metodo di calcolo confermato.':'Metodo non confermato: ripristina o verifica le impostazioni del master FAC 2026.'}</p>
    <h4>Controllo categorie</h4>${ScoreFlowRules.groups(event).map(g=>{const n=event.participants.filter(p=>ScoreFlowRules.inGroup(p,g)&&!['dns','disqualified'].includes(p.status)).length;return `<p>${escapeHtml(g.name)}: ${n} ${n<r.minimumEntries?'— sotto il minimo, decisione della regia necessaria':''}</p>`;}).join('')}
    <p>Quote di riferimento: singolo ${Number(r.singleFee)} €, duo ${Number(r.duoFee)} €. Pass coach: uno ogni ${Number(r.coachRatio)} atleti. Le quote non registrano automaticamente un pagamento.</p></article>`;
  }

  function bindFacRules(organization) {
    const event=organization.events[0];
    $("#facActivate")?.addEventListener('click',()=>{
      if(event.scores.length) return showToast('Impossibile cambiare profilo su un evento già votato. Crea un nuovo evento.');
      if(!confirm('Preparare il profilo FAC e i sei criteri? Partecipanti e categorie esistenti saranno conservati.')) return;
      event.competitionRules=ScoreFlowRules.preset();
      event.scoring.criteria=ScoreFlowRules.criteria();
      event.scoring.aggregation='average';
      event.scoring.minimumJudges=3;
      event.scoring.penalties={enabled:true,noteRequired:true};
      if(!event.categories.length) event.categories=ScoreFlowRules.catalog.map(s=>({id:uid('category'),name:s.name}));
      if(!event.participants.length) event.disciplines=['Cerchio','Tessuti'];
      event.categories.forEach(c=>{const spec=ScoreFlowRules.catalog.find(s=>s.name.toLowerCase().replace(/[^a-z0-9]/g,'')===c.name.toLowerCase().replace(/[^a-z0-9]/g,''));if(spec) event.competitionRules.categories[c.id]=spec.key;});
      saveRuntime(organization);renderEventDashboard(organization,'Profilo FAC preparato con il calcolo del master 2026. Associa le categorie.');
    });
    $("#facSettings")?.addEventListener('submit', e=>{
      e.preventDefault();if(event.scores.length) return;
      const next=JSON.parse(JSON.stringify(event.competitionRules));
      $$('[data-fac-setting]').forEach(input=>next[input.dataset.facSetting]=Number(input.value));
      if(next.penaltyMin>next.penaltyMax) return showToast('La penalità minima non può superare la massima.');
      next.criteriaMode=$('#facMode').value; next.decisionsConfirmed=$('#facConfirmed').checked;
      $$('[data-fac-category]').forEach(input=>next.categories[input.dataset.facCategory]=input.value);
      event.competitionRules=next;event.scoring.aggregation=$('#facAggregation').value;
      saveRuntime(organization);renderEventDashboard(organization,'Regole salvate.');
    });
  }

  function renderEventDashboard(organization, message = "") {
    const event = ensureEventData(organization.events[0]);
    const categoryRows = event.categories.map((category, index) => {
      const athletes = event.participants.filter(item => item.categoryId === category.id);
      return `<div class="schedule-category"><span>${index + 1}</span><div><strong>${escapeHtml(category.name)}</strong><small>${athletes.length} atleti · uscite ${athletes.map(item => item.order).join(", ") || "—"}</small></div></div>`;
    }).join("");
    const assetRows = event.assets.map(asset => `<div class="file-chip"><div><strong>${escapeHtml(asset.name)}</strong><small>${formatBytes(asset.size)} · ${asset.cloudPath ? "Cloud" : "In attesa di caricamento"}</small></div>${asset.cloudPath || asset.blobKey ? `<button class="button mini open-event-asset" data-asset-id="${asset.id}">Apri</button>` : ""}</div>`).join("");
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Programma ufficiale</p><h2>Evento e regolamento</h2><p>Qui trovi scaletta delle categorie, regole operative e documentazione di gara.</p></div><span class="count-chip">${event.categories.length} categorie</span></div><div class="event-operations"><article class="dash-card"><h3>Scaletta categorie</h3><div class="schedule-list">${categoryRows}</div></article><article class="dash-card rules-editor"><h3>Regolamento di gara</h3><label>Testo e indicazioni<textarea id="competitionRules" rows="10" placeholder="Inserisci regolamento, norme di comportamento, criteri per ritardi e ripetizioni...">${escapeHtml(event.rules.text || "")}</textarea></label><label class="file-drop">Carica regolamento PDF<input id="rulesFile" type="file" accept=".pdf,application/pdf"></label>${event.rules.file ? `<div class="file-chip"><div><strong>${escapeHtml(event.rules.file.name)}</strong><small>${formatBytes(event.rules.file.size)} · ${event.rules.file.cloudPath ? "Cloud" : "Solo dispositivo"}</small></div>${event.rules.file.blobKey || event.rules.file.cloudPath ? `<button class="button mini open-rules-file">Apri PDF</button>` : ""}</div>` : ""}<button class="button primary save-rules">Salva regolamento</button><div class="inline-message success">${escapeHtml(message)}</div></article><article class="dash-card event-cloud-files"><h3>Archivio evento</h3><p class="muted">Locandine, documenti e materiali caricati dalla configurazione.</p>${assetRows || "<small>Nessun altro file caricato.</small>"}</article></div>`;
    $("#moduleContent").insertAdjacentHTML("beforeend", facRulesPanel(event));
    bindFacRules(organization);
    $(".save-rules").addEventListener("click", () => { event.rules.text = $("#competitionRules").value.trim(); saveRuntime(organization); renderEventDashboard(organization, "Regolamento salvato e reso disponibile alla regia."); });
    if ($(".open-rules-file")) $(".open-rules-file").addEventListener("click", () => openManagedFile(organization, event.rules.file));
    $$(".open-event-asset", $("#moduleContent")).forEach(button => button.addEventListener("click", () => openManagedFile(organization, event.assets.find(item => item.id === button.dataset.assetId))));
    $("#rulesFile").addEventListener("change", async inputEvent => {
      const file = inputEvent.target.files[0];
      if (!file) return;
      const blobKey = `${event.id}:regolamento`;
      try { await storeLocalFile(blobKey, file); } catch (error) { console.warn("Copia locale non disponibile", error); }
      try {
        const cloud = await uploadCloudFile(organization, file, "event-rules");
        event.rules.file = { name: file.name, size: file.size, type: file.type, blobKey, ...cloud, status: "stored-in-cloud" };
        saveRuntime(organization);
        renderEventDashboard(organization, "Regolamento PDF salvato nel cloud e disponibile alle postazioni.");
      } catch (error) {
        event.rules.file = { name: file.name, size: file.size, type: file.type, blobKey, status: "stored-locally" };
        saveRuntime(organization);
        renderEventDashboard(organization, `PDF salvato solo su questo dispositivo: ${error.message}`);
      }
    });
  }

  function renderEliminations(organization, message = "") {
    const event = ensureEventData(organization.events[0]);
    const qualificationSections = ScoreFlowRules.groups(event).map(category => {
      const ranked = rankedCategory(event, category, "qualification", true).filter(item => item.rank !== null);
      if (!ranked.length) return "";
      return `<article class="dash-card elimination-card"><h3>${escapeHtml(category.name)}</h3>${ranked.map((item, index) => `<div><span>${item.rank}</span><strong>${escapeHtml(item.participant.name)}</strong><em>${item.result.total.toFixed(2)}</em><small>${item.participant.round === "final" ? "Finalista" : item.rank <= event.rounds.finalistsPerCategory ? "Zona qualificazione" : "Eliminato"}</small></div>`).join("")}</article>`;
    }).join("");
    const finalists = event.participants.filter(item => item.round === "final");
    $("#moduleContent").innerHTML = `<div class="module-heading"><div><p class="eyebrow">Fasi di gara</p><h2>Eliminatorie e finale</h2><p>Le classifiche delle due fasi restano separate. La finale genera una nuova votazione senza cancellare lo storico delle eliminatorie.</p></div><span class="count-chip">${finalists.length} finalisti</span></div><article class="dash-card rounds-config"><label class="toggle"><input id="roundsEnabled" type="checkbox" ${event.rounds.enabled ? "checked" : ""}><span></span>Abilita eliminatorie</label><label>Finalisti per categoria<input id="finalistsCount" type="number" min="1" value="${event.rounds.finalistsPerCategory}"></label><button class="button ghost save-rounds">Salva impostazioni</button><button class="button primary generate-final" ${event.rounds.enabled ? "" : "disabled"}>Genera finale dalle classifiche</button></article><div class="inline-message success">${escapeHtml(message)}</div><div class="elimination-grid">${qualificationSections || '<article class="module-placeholder"><p>Le classifiche delle eliminatorie compariranno dopo i primi voti.</p></article>'}</div>`;
    $(".save-rounds").addEventListener("click", () => { event.rounds.enabled = $("#roundsEnabled").checked; event.rounds.finalistsPerCategory = Math.max(1, Number($("#finalistsCount").value) || 1); saveRuntime(organization); renderEliminations(organization, "Impostazioni delle fasi salvate."); });
    $(".generate-final").addEventListener("click", () => {
      if (!confirm("Generare la finale con i migliori atleti di ogni categoria? I punteggi delle eliminatorie resteranno archiviati.")) return;
      const selected = [];
      ScoreFlowRules.groups(event).forEach(category => {
        rankedCategory(event, category, "qualification", true).filter(item => item.rank !== null && item.rank <= event.rounds.finalistsPerCategory).forEach(item => selected.push(item.participant));
      });
      if (!selected.length) return showToast("Non ci sono ancora risultati validi per generare la finale.");
      event.roundHistory.push({ id: uid("round"), round: "qualification", closedAt: new Date().toISOString(), finalists: selected.map(item => item.id) });
      selected.forEach((participant, index) => { participant.round = "final"; participant.status = "registered"; participant.attempt = 1; participant.order = index + 1; });
      event.control.round = "final"; event.control.currentParticipantId = selected[0].id; event.control.status = "setup"; event.control.repeatQueue = [];
      saveRuntime(organization); renderEliminations(organization, `${selected.length} finalisti inseriti nella nuova scaletta.`);
    });
  }

  function renderDashboardModule(module, organization, message = "") {
    clearTimeout(controlRefreshTimer);
    currentDashboardModule = module;
    const event = ensureEventData(organization.events[0]);
    $$(".dash-link").forEach(link => { if (link.dataset.module === module) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current"); });
    const content = $("#moduleContent");
    if (module === "overview") {
      content.innerHTML = `${message ? `<div class="demo-message"><span>✓</span>${escapeHtml(message)}</div>` : ""}${overviewHero(event)}<div class="section-heading overview-section-heading"><div><p class="eyebrow">A colpo d’occhio</p><h3>I numeri del tuo evento</h3></div></div><div class="dash-stats">
        <article class="dash-stat"><span>Partecipanti<span class="stat-icon">${sfIcon("participants")}</span></span><strong>${event.participants.length}</strong><small>${event.participants.filter(item => item.status === "completed").length} esibizioni completate</small></article>
        <article class="dash-stat"><span>Categorie<span class="stat-icon">${sfIcon("event")}</span></span><strong>${event.categories.length}</strong><small>${escapeHtml(event.disciplines.join(" · "))}</small></article>
        <article class="dash-stat"><span>Giudici attivi<span class="stat-icon">${sfIcon("judges")}</span></span><strong>${event.judges.filter(item => item.active).length}</strong><small>${event.scoring.judgeCount} previsti</small></article>
        <article class="dash-stat"><span>Voti raccolti<span class="stat-icon">${sfIcon("results")}</span></span><strong>${event.scores.length}</strong><small>Salvati in questo dispositivo</small></article>
      </div><div class="dashboard-grid"><article class="dash-card"><p class="eyebrow">Prima di andare in scena</p><h2>Prepara il tuo evento</h2><div class="checklist">
        <div class="check-item"><span class="check-icon">✓</span><div><strong>Configurazione completata</strong><small>Categorie e criteri sono pronti.</small></div></div>
        <div class="check-item"><span class="check-icon ${event.participants.length ? "" : "todo"}">${event.participants.length ? "✓" : "2"}</span><div><strong>Carica i partecipanti</strong><small>${event.participants.length ? `${event.participants.length} atleti pronti` : "Inserimento manuale o importazione CSV"}.</small></div></div>
        <div class="check-item"><span class="check-icon ${event.judges.filter(j => j.active).length >= event.scoring.minimumJudges ? "" : "todo"}">${event.judges.filter(j => j.active).length >= event.scoring.minimumJudges ? "✓" : "3"}</span><div><strong>Assegna i giudici</strong><small>${event.judges.length ? `${event.judges.length} giudici configurati` : "Crea gli accessi e verifica i dispositivi"}.</small></div></div>
        <div class="check-item"><span class="check-icon ${event.scores.length ? "" : "todo"}">${event.scores.length ? "✓" : "4"}</span><div><strong>Prova generale</strong><small>${event.scores.length ? `${event.scores.length} voti registrati` : "Simula un atleta prima della gara"}.</small></div></div>
      </div></article><article class="dash-card"><p class="eyebrow">Scorciatoie</p><h3>Da dove vuoi partire?</h3><div class="quick-actions">
        <button class="quick-action" data-open-module="participants"><strong>Aggiungi partecipanti</strong><small>Manuale, CSV o foglio di calcolo</small></button>
        <button class="quick-action" data-open-module="registrations"><strong>Apri iscrizioni</strong><small>Scadenze, schede atleta e sincronizzazione roster</small></button>
        <button class="quick-action" data-open-module="judges"><strong>Configura giudici</strong><small>Ruoli, lingue e sostituzioni</small></button>
        <button class="quick-action" data-open-module="control"><strong>Entra in regia</strong><small>Scaletta, atleti in pedana e schede di voto</small></button>
        <button class="quick-action demo-action" data-complete-demo><strong>Completa dati demo</strong><small>Crea automaticamente i giudici mancanti e dati di prova</small></button>
      </div></article></div><div class="dashboard-grid system-actions"><article class="dash-card"><p class="eyebrow">Licenza</p><h3>${organization.subscription.status === "active" ? "Software completo attivo" : "Sblocca ScoreFlow completo"}</h3><p class="muted">${organization.subscription.status === "active" ? `Piano ${escapeHtml(organization.subscription.plan)} attivo per questa organizzazione.` : `${trialDaysRemaining(organization)} giorni di prova rimasti. Inserisci il codice consegnato dopo l’acquisto.`}</p>${organization.subscription.status === "active" ? '<span class="state-badge completed">Licenza verificata</span>' : '<form id="licenseForm" class="license-form"><input id="licenseCode" autocomplete="off" placeholder="SF-XXXX-XXXX-XXXX"><button class="button primary" type="submit">Attiva licenza</button></form>'}</article><article class="dash-card danger-zone"><p class="eyebrow">Dopo una prova</p><h3>Reset post-test</h3><p class="muted">Azzera voti, risultati e flusso gara conservando configurazione, roster e giudici.</p><button class="button danger reset-post-test" type="button">Reset post-test</button></article></div>`;
      $$('[data-open-module]', content).forEach(button => button.addEventListener("click", () => activateDashboardModule(button.dataset.openModule, organization)));
      $("[data-complete-demo]", content).addEventListener("click", () => completeDemoData(organization));
      $(".reset-post-test", content).addEventListener("click", () => resetPostTest(organization));
      const licenseForm = $("#licenseForm", content);
      if (licenseForm) licenseForm.addEventListener("submit", async submitEvent => {
        submitEvent.preventDefault();
        const button = $("button", licenseForm); button.disabled = true;
        try { await activateLicense(organization, $("#licenseCode").value); renderDashboardModule("overview", organization, "Licenza attivata: ScoreFlow completo è sbloccato."); }
        catch (error) { showToast(error.message); button.disabled = false; }
      });
      return;
    }
    if (module === "participants") return renderParticipants(organization);
    if (module === "registrations") return renderRegistrations(organization);
    if (module === "judges") return renderJudges(organization);
    if (module === "stations") return renderStations(organization);
    if (module === "judge") return renderJudgeStationPreservingDraft(organization);
    if (module === "presenter") return renderPresenter(organization);
    if (module === "staff") return renderStaff(organization);
    if (module === "control") return renderControlPreservingDraft(organization);
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
    const allowedModule = { judge: "judge", presenter: "presenter", control: "control", staff: "staff", public: "public" }[organization.cloud?.role];
    if (allowedModule && module !== allowedModule) module = allowedModule;
    currentDashboardModule = module;
    const navigationWasOpen = document.body.classList.contains("navigation-open");
    closeDashboardNavigation();
    window.scrollTo({ top: 0, behavior: "smooth" });
    $$(".dash-link").forEach(link => link.classList.toggle("active", link.dataset.module === module));
    renderDashboardModule(module, organization);
    if (navigationWasOpen) $("#moduleContent").focus({ preventScroll: true });
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
    selectedEventFiles.push(...valid.map(file => ({ id: uid("asset"), name: file.name, size: file.size, type: file.type, file, status: "ready-for-upload" })));
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
  $("#newConfigBtn").addEventListener("click", () => {
    $("#quickOrgName").value = "";
    $("#quickEventName").value = "";
    showOnboarding();
  });
  $$('[data-demo-profile]').forEach(button => button.addEventListener("click", () => {
    onboardingProfile = button.dataset.demoProfile;
    $$('[data-demo-profile]').forEach(item => item.classList.toggle("active", item === button));
  }));
  $$('[data-demo-size]').forEach(button => button.addEventListener("click", () => {
    onboardingSize = button.dataset.demoSize;
    $$('[data-demo-size]').forEach(item => item.classList.toggle("active", item === button));
  }));
  document.addEventListener("change", event => {
    if (event.target.matches("[data-scoreflow-language]")) window.ScoreFlowI18n?.setLanguage(event.target.value);
  });
  $("#language").addEventListener("change", event => window.ScoreFlowI18n?.setLanguage(event.target.value));
  $("#publicVoting").addEventListener("change", event => {
    if (!event.target.checked) $("#publicQr").checked = false;
    $("#publicQr").disabled = !event.target.checked;
  });
  $("#manualSetupBtn").addEventListener("click", startGuidedConfiguration);
  $("#createDemoBtn").addEventListener("click", createGuidedDemo);
  $("#exportBtn").addEventListener("click", exportConfiguration);
  $("#configForm").addEventListener("submit", saveConfiguration);
  $$(".next").forEach(button => button.addEventListener("click", () => goToStep(currentStep + 1)));
  $$(".prev").forEach(button => button.addEventListener("click", () => goToStep(currentStep - 1)));
  $$(".step").forEach(button => button.addEventListener("click", () => goToStep(Number(button.dataset.stepTarget))));
  $("#criteriaRows").addEventListener("input", validateCriteria);
  $("#categoryList").addEventListener("input", validateCategories);
  $("#backToConfigBtn").addEventListener("click", () => {
    const organization = platform.organizations.find(item => item.id === editingOrganizationId);
    if (isRoleDevice(organization)) disconnectRoleDevice(organization);
    else showConfigurator();
  });
  $$(".dash-link").forEach(link => link.addEventListener("click", () => {
    const organization = platform.organizations.find(item => item.id === editingOrganizationId);
    if (organization) activateDashboardModule(link.dataset.module, organization);
  }));

  initializeExperience();
  window.ScoreFlowI18n?.observe();
  defaultCriteria.forEach(addCriterionRow);
  ["Categoria Base", "Categoria Intermedia"].forEach(name => addCategory(name));
  renderOrganizationList();
  updateTrialPreview();
  async function initializeApplication() {
    addAccountControls();
    try {
      const accountLink=new URLSearchParams(window.location.hash.slice(1));
      if(accountLink.has("account")){const type=accountLink.get("account");const token=accountLink.get("token") || "";history.replaceState({},"",window.location.pathname);showAccountScreen(type==="recovery"?"reset":"verify",token);return;}
      const registrationTenant = String(new URLSearchParams(window.location.search).get("register") || "").trim().toLowerCase();
      if (registrationTenant) {
        $("#organizerControls").classList.add("hidden");
        await showRegistrationPortal(registrationTenant);
        return;
      }
      const sharedOrganization = await joinSharedDevice();
      if (sharedOrganization) {
        $("#organizerControls").classList.add("hidden");
        renderOrganizationList();
        showDashboard(sharedOrganization);
        return;
      }
    } catch (error) {
      showToast(error.message);
      history.replaceState({}, "", window.location.pathname);
    }
    try {if(await restoreOrganizerAccount()) return;}catch(error){showToast(error.message);}
    platform.organizations=platform.organizations.filter(x=>!x.cloud?.accountManaged);
    const activeOrganization = platform.organizations.find(item => item.id === platform.activeOrganizationId) || platform.organizations[0];
    if (activeOrganization) loadOrganization(activeOrganization.id, true);
    else showAccountScreen("signup");
  }

  initializeApplication();
})();
