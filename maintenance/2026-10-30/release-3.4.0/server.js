const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const QRCode = require('qrcode');
const CompetitionRules = require('./scripts/competition-rules');
const Regulations = require('./scripts/regulation-import');
const { databaseConfigured, getSupabase } = require('./db');

const port = Number(process.env.PORT) || 3000;
const publicRoot = __dirname;
const tenantTable = 'scoreflow_tenants';
const accessTable = 'scoreflow_access_tokens';
const registrationTable = 'scoreflow_athlete_accounts';
const registrationSessionTable = 'scoreflow_athlete_sessions';
const licenseTable = 'scoreflow_license_codes';
const storageBucket = 'scoreflow-files';
const allowedRoles = new Set(['judge', 'presenter', 'control', 'staff', 'public']);
const supportedLanguages = new Set(['it', 'en', 'fr', 'es']);
const normalizeLanguage = value => supportedLanguages.has(String(value || '').slice(0, 2).toLowerCase()) ? String(value).slice(0, 2).toLowerCase() : 'it';
const athleteFileKinds = {
  photo: { maximumBytes: 8 * 1024 * 1024, types: /^image\// },
  entryVideo: { maximumBytes: 50 * 1024 * 1024, types: /^video\// },
  medicalCertificate: { maximumBytes: 15 * 1024 * 1024, types: /^(application\/pdf|image\/)/ },
  music: { maximumBytes: 50 * 1024 * 1024, types: /^audio\// }
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 254);
}

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const digest = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${digest}`;
}

function passwordMatches(password, encoded) {
  const [salt, expected] = String(encoded || '').split(':');
  if (!salt || !expected) return false;
  const actual = passwordHash(password, salt).split(':')[1];
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function cleanProfile(value = {}) {
  const text = (key, maximum = 500) => String(value[key] || '').trim().slice(0, maximum);
  const attachments = value.attachments && typeof value.attachments === 'object' ? value.attachments : {};
  const musicDuration = Math.max(0, Math.min(7200, Number(attachments.music?.durationSeconds) || 0));
  const reviewValue = value.review && typeof value.review === 'object' ? value.review : {};
  const notifications = (Array.isArray(reviewValue.notifications) ? reviewValue.notifications : []).slice(-50).map(item => ({
    id: String(item?.id || crypto.randomUUID()).slice(0, 80),
    type: String(item?.type || 'update').slice(0, 60),
    subject: String(item?.subject || '').trim().slice(0, 240),
    message: String(item?.message || '').trim().slice(0, 5000),
    createdAt: String(item?.createdAt || '').slice(0, 40),
    deliveryStatus: ['pending', 'sent', 'failed'].includes(item?.deliveryStatus) ? item.deliveryStatus : 'pending',
    sentAt: String(item?.sentAt || '').slice(0, 40),
    providerId: String(item?.providerId || '').slice(0, 180),
    error: String(item?.error || '').slice(0, 500)
  }));
  const review = {
    facChecks: { video: reviewValue.facChecks?.video === true, eligibility: reviewValue.facChecks?.eligibility === true, duo: reviewValue.facChecks?.duo === true },
    status: String(reviewValue.status || 'submitted').slice(0, 40),
    videoStatus: String(reviewValue.videoStatus || 'pending').slice(0, 40),
    paymentStatus: String(reviewValue.paymentStatus || 'pending').slice(0, 40),
    requestedCategoryId: String(reviewValue.requestedCategoryId || value.categoryId || '').slice(0, 140),
    assignedCategoryId: String(reviewValue.assignedCategoryId || '').slice(0, 140),
    reason: String(reviewValue.reason || '').trim().slice(0, 1200),
    reviewedAt: String(reviewValue.reviewedAt || '').slice(0, 40),
    rosterSyncedAt: String(reviewValue.rosterSyncedAt || '').slice(0, 40),
    notificationPending: Boolean(reviewValue.notificationPending),
    notifications
  };
  return {
    id: String(value.id || crypto.randomUUID()).slice(0, 80),
    registeredAt: text('registeredAt', 40),
    firstName: text('firstName', 100), lastName: text('lastName', 100), birthDate: text('birthDate', 10),
    birthPlace: text('birthPlace', 120), gender: text('gender', 40), taxCode: text('taxCode', 32).toUpperCase(),
    nationality: text('nationality', 80), phone: text('phone', 40), address: text('address', 180),
    postalCode: text('postalCode', 20), city: text('city', 100), province: text('province', 80),
    schoolName: text('schoolName', 180), coachName: text('coachName', 140), coachPhone: text('coachPhone', 40),
    discipline: text('discipline', 140), categoryId: text('categoryId', 140), categoryName: text('categoryName', 180),
    level: text('level', 100), choreographyTitle: text('choreographyTitle', 180),
    choreographyTheme: text('choreographyTheme', 1500), description: text('description', 1500),
    specialRequests: text('specialRequests', 1000), performanceDuration: musicDuration,
    preferredLanguage: normalizeLanguage(value.preferredLanguage),
    privacyAccepted: Boolean(value.privacyAccepted), rulesAccepted: Boolean(value.rulesAccepted),
    attachments, review
  };
}

function notificationForAction(action, profile, context = {}) {
  const athleteName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Atleta';
  const eventName = context.eventName || 'competizione';
  const reason = String(context.reason || '').trim();
  const categoryName = context.categoryName || profile.categoryName || 'categoria assegnata';
  const missing = Array.isArray(context.missing) ? context.missing : [];
  const language = normalizeLanguage(context.language || profile.preferredLanguage);
  const messages = ({
    it: {
      'approve-video': [`Video entry approvato · ${athleteName}`, `Il video entry di ${athleteName} per ${eventName} è stato approvato. La categoria assegnata è ${categoryName}.${reason ? `\n\nNota della regia: ${reason}` : ''}`],
      'request-video': [`Correzione richiesta · ${athleteName}`, `La regia richiede un aggiornamento per il video entry di ${athleteName}.${reason ? `\n\nMotivazione: ${reason}` : ''}\n\nAccedi alla scheda atleta per completare la correzione.`],
      'mark-paid': [`Pagamento registrato · ${athleteName}`, `Il pagamento di ${athleteName} per ${eventName} è stato registrato correttamente.${missing.length ? `\n\nPer completare l’iscrizione mancano: ${missing.join(', ')}.` : ''}`],
      'mark-unpaid': [`Pagamento da verificare · ${athleteName}`, `Il pagamento di ${athleteName} risulta nuovamente da verificare.${reason ? `\n\nNota della regia: ${reason}` : ''}`],
      'approve-roster': [`Iscrizione confermata · ${athleteName}`, `L’iscrizione di ${athleteName} a ${eventName} è completa e l’atleta è stato inserito nel roster ufficiale.`],
      withdraw: [`Ritiro registrato · ${athleteName}`, `${athleteName} è stato segnato come ritirato da ${eventName}.${reason ? `\n\nNota della regia: ${reason}` : ''}`],
      restore: [`Iscrizione ripristinata · ${athleteName}`, `La scheda di ${athleteName} è stata ripristinata e può proseguire nel percorso di verifica.`],
      'save-review': [`Aggiornamento iscrizione · ${athleteName}`, `La regia ha aggiornato la scheda di ${athleteName}. Categoria assegnata: ${categoryName}.${reason ? `\n\nComunicazione: ${reason}` : ''}`]
    },
    en: {
      'approve-video': [`Entry video approved · ${athleteName}`, `${athleteName}'s entry video for ${eventName} has been approved. Assigned category: ${categoryName}.${reason ? `\n\nControl desk note: ${reason}` : ''}`],
      'request-video': [`Correction requested · ${athleteName}`, `The control desk has requested an update to ${athleteName}'s entry video.${reason ? `\n\nReason: ${reason}` : ''}\n\nOpen the athlete profile to complete the correction.`],
      'mark-paid': [`Payment recorded · ${athleteName}`, `${athleteName}'s payment for ${eventName} has been recorded.${missing.length ? `\n\nStill required: ${missing.join(', ')}.` : ''}`],
      'mark-unpaid': [`Payment to verify · ${athleteName}`, `${athleteName}'s payment must be verified again.${reason ? `\n\nControl desk note: ${reason}` : ''}`],
      'approve-roster': [`Registration confirmed · ${athleteName}`, `${athleteName}'s registration for ${eventName} is complete and the athlete is now on the official roster.`],
      withdraw: [`Withdrawal recorded · ${athleteName}`, `${athleteName} has been withdrawn from ${eventName}.${reason ? `\n\nControl desk note: ${reason}` : ''}`],
      restore: [`Registration restored · ${athleteName}`, `${athleteName}'s profile has been restored and can continue through verification.`],
      'save-review': [`Registration updated · ${athleteName}`, `The control desk updated ${athleteName}'s profile. Assigned category: ${categoryName}.${reason ? `\n\nMessage: ${reason}` : ''}`]
    },
    fr: {
      'approve-video': [`Vidéo approuvée · ${athleteName}`, `La vidéo de ${athleteName} pour ${eventName} a été approuvée. Catégorie attribuée : ${categoryName}.${reason ? `\n\nNote de la régie : ${reason}` : ''}`],
      'request-video': [`Correction demandée · ${athleteName}`, `La régie demande une mise à jour de la vidéo de ${athleteName}.${reason ? `\n\nMotif : ${reason}` : ''}\n\nOuvrez la fiche athlète pour effectuer la correction.`],
      'mark-paid': [`Paiement enregistré · ${athleteName}`, `Le paiement de ${athleteName} pour ${eventName} a été enregistré.${missing.length ? `\n\nÉléments manquants : ${missing.join(', ')}.` : ''}`],
      'mark-unpaid': [`Paiement à vérifier · ${athleteName}`, `Le paiement de ${athleteName} doit être vérifié à nouveau.${reason ? `\n\nNote de la régie : ${reason}` : ''}`],
      'approve-roster': [`Inscription confirmée · ${athleteName}`, `L’inscription de ${athleteName} à ${eventName} est complète et l’athlète figure dans la liste officielle.`],
      withdraw: [`Retrait enregistré · ${athleteName}`, `${athleteName} a été retiré de ${eventName}.${reason ? `\n\nNote de la régie : ${reason}` : ''}`],
      restore: [`Inscription restaurée · ${athleteName}`, `La fiche de ${athleteName} a été restaurée et peut poursuivre la vérification.`],
      'save-review': [`Inscription mise à jour · ${athleteName}`, `La régie a mis à jour la fiche de ${athleteName}. Catégorie attribuée : ${categoryName}.${reason ? `\n\nMessage : ${reason}` : ''}`]
    },
    es: {
      'approve-video': [`Vídeo aprobado · ${athleteName}`, `El vídeo de ${athleteName} para ${eventName} ha sido aprobado. Categoría asignada: ${categoryName}.${reason ? `\n\nNota de control: ${reason}` : ''}`],
      'request-video': [`Corrección solicitada · ${athleteName}`, `Control solicita actualizar el vídeo de ${athleteName}.${reason ? `\n\nMotivo: ${reason}` : ''}\n\nAbre la ficha del atleta para completar la corrección.`],
      'mark-paid': [`Pago registrado · ${athleteName}`, `El pago de ${athleteName} para ${eventName} ha sido registrado.${missing.length ? `\n\nFalta: ${missing.join(', ')}.` : ''}`],
      'mark-unpaid': [`Pago por verificar · ${athleteName}`, `El pago de ${athleteName} debe verificarse de nuevo.${reason ? `\n\nNota de control: ${reason}` : ''}`],
      'approve-roster': [`Inscripción confirmada · ${athleteName}`, `La inscripción de ${athleteName} en ${eventName} está completa y el atleta figura en la lista oficial.`],
      withdraw: [`Retirada registrada · ${athleteName}`, `${athleteName} ha sido retirado de ${eventName}.${reason ? `\n\nNota de control: ${reason}` : ''}`],
      restore: [`Inscripción restaurada · ${athleteName}`, `La ficha de ${athleteName} ha sido restaurada y puede continuar la verificación.`],
      'save-review': [`Inscripción actualizada · ${athleteName}`, `Control ha actualizado la ficha de ${athleteName}. Categoría asignada: ${categoryName}.${reason ? `\n\nMensaje: ${reason}` : ''}`]
    }
  })[language];
  const selected = messages[action];
  if (!selected) return null;
  return { id: crypto.randomUUID(), type: action, subject: selected[0], message: selected[1], createdAt: new Date().toISOString(), deliveryStatus: 'pending', sentAt: '', providerId: '', error: '' };
}

function notificationHtml(notification, context = {}) {
  const escape = value => String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const body = String(notification.message || '').split('\n').map(line => line ? `<p style="margin:0 0 12px">${escape(line)}</p>` : '<br>').join('');
  const language = normalizeLanguage(context.language);
  const labels = { it: ['Imposta nuova password','Conferma email','comunicazione automatica della regia'], en: ['Set new password','Confirm email','automated message from the control desk'], fr: ['Définir un nouveau mot de passe','Confirmer l’e-mail','message automatique de la régie'], es: ['Establecer nueva contraseña','Confirmar correo','mensaje automático de control'] }[language];
  return `<!doctype html><html lang="${language}"><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#182033"><div style="max-width:620px;margin:24px auto;background:#fff;border-radius:18px;padding:30px;border-top:5px solid #c1121f"><div style="font-size:13px;font-weight:800;color:#c1121f;letter-spacing:.08em;text-transform:uppercase">ScoreFlow</div><h1 style="font-size:25px;margin:10px 0 22px">${escape(notification.subject)}</h1>${body}${context.accountLink ? `<p><a href="${escape(context.accountLink)}" style="display:inline-block;padding:14px 22px;background:#c1121f;color:white;text-decoration:none;border-radius:8px">${context.recovery ? labels[0] : labels[1]}</a></p>` : ''}<p style="margin:24px 0 0;color:#667085;font-size:12px">${escape(context.organizationName || 'ScoreFlow')} · ${labels[2]}</p></div></body></html>`;
}

async function deliverNotification(email, notification, context = {}, transport = null) {
  if (!transport) return { ...notification, deliveryStatus: 'pending', error: '' };
  try {
    if(transport.trial) {
      const {data:claimed,error}=await getSupabase().rpc('scoreflow_claim_trial_email',{p_tenant:transport.tenantKey,p_notification:`${notification.id}:${crypto.randomUUID()}`});
      if(error || !claimed) return {...notification,deliveryStatus:'failed',error:'Limite di 10 invii della prova raggiunto o prova scaduta.'};
    }
    const apiResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(12000),
      headers: { 'Idempotency-Key': crypto.createHash('sha256').update(`${transport.tenantKey || 'legacy'}:${notification.id}`).digest('hex'), Authorization: `Bearer ${transport.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: transport.from,
        to: [email],
        reply_to: transport.replyTo || undefined,
        subject: notification.subject,
        text: notification.message,
        html: notificationHtml(notification, context)
      })
    });
    const result = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok || !result.id) throw new Error(apiResponse.status === 429 ? 'Limite del servizio email raggiunto. Riprova più tardi.' : 'Il servizio email ha rifiutato l’invio. Verifica chiave API, dominio mittente e limiti del tuo account Resend.');
    return { ...notification, deliveryStatus: 'sent', sentAt: new Date().toISOString(), providerId: String(result.id || ''), error: '' };
  } catch (error) {
    const message = error.name === 'TimeoutError' ? 'Il servizio email non ha risposto in tempo. Riprova più tardi.' : error.message?.startsWith('Il servizio email') || error.message?.startsWith('Limite del servizio') ? error.message : 'Invio email non riuscito. Riprova più tardi.';
    return { ...notification, deliveryStatus: 'failed', error: message };
  }
}

const emailSettingsTable = 'scoreflow_email_settings';

function emailValidationError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function validEmailAddress(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
}

// Organization admin secrets are random high-entropy keys, never human passwords.
// Context-bound authenticated encryption prevents copying ciphertext between tenants.
function emailCipherKey(secret, tenantKey) {
  return crypto.hkdfSync('sha256', Buffer.from(secret), Buffer.from(tenantKey), Buffer.from('scoreflow-email-settings-v1'), 32);
}

function encryptEmailKey(apiKey, secret, tenantKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', emailCipherKey(secret, tenantKey), iv);
  cipher.setAAD(Buffer.from(tenantKey));
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

function decryptEmailKey(value, secret, tenantKey) {
  const [version, iv, tag, data] = String(value).split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw emailValidationError('Ricollega la chiave del servizio email.', 409);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', emailCipherKey(secret, tenantKey), Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(tenantKey));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch { throw emailValidationError('Ricollega la chiave del servizio email.', 409); }
}

async function readEmailSettings(auth, tenantKey) {
  const { data, error } = await auth.supabase.from(emailSettingsTable).select('*').eq('tenant_key', tenantKey).maybeSingle();
  if (error) throw databaseError(error);
  return data;
}

function publicEmailSettings(row) {
  return {
    provider: 'resend', mode: row?.delivery_mode || 'managed', managedReady: managedEmailReady(), enabled: Boolean(row?.enabled), hasKey: Boolean(row?.api_key_encrypted),
    configured: Boolean(row?.enabled && (row?.delivery_mode === 'custom' ? row?.api_key_encrypted && row?.sender_email : managedEmailReady() && row?.sender_name && validEmailAddress(row?.reply_to))),
    senderName: row?.sender_name || '', senderEmail: row?.sender_email || '', replyTo: row?.reply_to || '',
    lastTestAt: row?.last_test_at || '', lastTestStatus: row?.last_test_status || '', updatedAt: row?.updated_at || ''
  };
}

function managedEmailReady() {
  return process.env.SCOREFLOW_MANAGED_EMAIL_ENABLED === 'true' &&
    Boolean(process.env.RESEND_API_KEY && process.env.SCOREFLOW_EMAIL_FROM);
}

function emailTransport(row, auth, tenantKey, { forTest = false } = {}) {
  if (!row || (!forTest && !row.enabled)) return null;
  if (row.delivery_mode !== 'custom') {
    if (!managedEmailReady() || !row.sender_name || !validEmailAddress(row.reply_to)) return null;
    const address = String(process.env.SCOREFLOW_EMAIL_FROM).match(/<([^<>]+)>/)?.[1] || process.env.SCOREFLOW_EMAIL_FROM;
    if (!validEmailAddress(address)) return null;
    return { apiKey: process.env.RESEND_API_KEY, from: `${JSON.stringify(row.sender_name + ' · ScoreFlow')} <${address}>`, replyTo: row.reply_to, tenantKey, managed: true };
  }
  if (!row.api_key_encrypted || !row.sender_email) return null;
  return { apiKey: decryptEmailKey(row.api_key_encrypted, auth.secret, tenantKey),
    from: row.sender_name ? `${row.sender_name} <${row.sender_email}>` : row.sender_email,
    replyTo: row.reply_to || undefined, tenantKey };
}

async function organizationEmailTransport(row, auth, tenantKey, options = {}) {
  const transport = emailTransport(row, auth, tenantKey, options);
  const entitlements=await trialEntitlements(auth.supabase,tenantKey);
  if(entitlements?.readOnly) return null;
  if(entitlements?.status==='trialing') return transport?.managed ? {...transport,trial:true} : null;
  if (!transport?.managed) return transport;
  // Central delivery is reserved for activated event licenses, never a public relay.
  const { data: licenses, error } = await auth.supabase.from(licenseTable).select('id,expires_at')
    .eq('tenant_key', tenantKey).eq('active', true).limit(10);
  if (error) throw databaseError(error);
  const licensed = (licenses || []).some(item => !item.expires_at || new Date(item.expires_at).getTime() > Date.now());
  return licensed ? transport : null;
}

async function handleEmailSettings(request, response, requestUrl, route) {
  const auth = await authenticatedTenant(request, response, route.tenantKey);
  if (!auth) return true;
  const row = await readEmailSettings(auth, route.tenantKey);
  if (route.action === 'email-settings' && request.method === 'GET') {
    const settings = publicEmailSettings(row);
    settings.configured = Boolean(await organizationEmailTransport(row, auth, route.tenantKey));
    sendJson(response, 200, { settings }); return true;
  }
  if (route.action === 'email-settings' && request.method === 'PUT') {
    const body = await readJsonBody(request, 8 * 1024);
    const mode = body.mode === 'custom' ? 'custom' : body.mode === 'managed' ? 'managed' : row?.delivery_mode || 'managed';
    const entitlements=await trialEntitlements(auth.supabase,route.tenantKey);
    if(entitlements && mode==='custom') throw emailValidationError('Per questo account usa il servizio email ScoreFlow.');
    const senderName = String(body.senderName || '').trim();
    const senderEmail = String(body.senderEmail ?? row?.sender_email ?? '').trim();
    const replyTo = String(body.replyTo || '').trim();
    const apiKey = String(body.apiKey || '').trim();
    if (senderName.length > 100 || /[\r\n<>]/.test(senderName)) throw emailValidationError('Il nome mittente non è valido.');
    if (senderEmail && !validEmailAddress(senderEmail)) throw emailValidationError('Inserisci un indirizzo mittente valido.');
    if (replyTo && !validEmailAddress(replyTo)) throw emailValidationError('Inserisci un indirizzo valido per le risposte.');
    if (apiKey && !/^re_[A-Za-z0-9_-]{10,250}$/.test(apiKey)) throw emailValidationError('La chiave Resend deve iniziare con re_.');
    if (body.clearKey && apiKey) throw emailValidationError('Scegli se sostituire o rimuovere la chiave.');
    const encrypted = body.clearKey ? null : apiKey ? encryptEmailKey(apiKey, auth.secret, route.tenantKey) : row?.api_key_encrypted || null;
    if (body.enabled === true && mode === 'managed' && (!senderName || !validEmailAddress(replyTo))) throw emailValidationError('Inserisci il nome dell’organizzazione e l’email di contatto.');
    if (body.enabled === true && mode === 'custom' && (!encrypted || !senderEmail)) throw emailValidationError('Prima di abilitare l’invio, inserisci mittente e chiave API.');
    const changed = Boolean(mode !== row?.delivery_mode || apiKey || body.clearKey || senderEmail !== (row?.sender_email || '') || senderName !== (row?.sender_name || '') || replyTo !== (row?.reply_to || ''));
    const saved = { tenant_key: route.tenantKey, delivery_mode: mode, enabled: body.enabled === true, sender_name: senderName, sender_email: senderEmail,
      reply_to: replyTo, api_key_encrypted: encrypted, updated_at: new Date().toISOString(),
      last_test_at: row?.last_test_at || null, last_test_status: changed ? '' : row?.last_test_status || '' };
    const { error } = await auth.supabase.from(emailSettingsTable).upsert(saved, { onConflict: 'tenant_key' });
    if (error) throw databaseError(error);
    const settings = publicEmailSettings(saved);
    settings.configured = Boolean(await organizationEmailTransport(saved, auth, route.tenantKey));
    sendJson(response, 200, { settings }); return true;
  }
  if (route.action === 'email-settings/test' && request.method === 'POST') {
    const body = await readJsonBody(request, 4 * 1024);
    if (!validEmailAddress(body.to)) throw emailValidationError('Inserisci l’indirizzo che deve ricevere la prova.');
    const transport = await organizationEmailTransport(row, auth, route.tenantKey, { forTest: true });
    if (!transport) throw emailValidationError(row?.delivery_mode === 'custom' ? 'Salva prima mittente e chiave API.' : !managedEmailReady() ? 'Il servizio email centrale è in attivazione. I contatti sono salvati; nessuna email è stata inviata.' : 'Per la prova servono nome, email di contatto e una licenza evento attiva.', 409);
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - 60000).toISOString();
    // Atomic claim in the database: simultaneous test clicks cannot bypass the limit.
    const { data: claimed, error: claimError } = await auth.supabase.from(emailSettingsTable)
      .update({ last_test_at: now, last_test_status: 'testing' }).eq('tenant_key', route.tenantKey)
      .or(`last_test_at.is.null,last_test_at.lt.${cutoff}`).select('tenant_key');
    if (claimError) throw databaseError(claimError);
    if (!claimed?.length) throw emailValidationError('Attendi un minuto prima di ripetere la prova.', 429);
    const notification = { id: crypto.randomUUID(), subject: 'ScoreFlow — prova collegamento email',
      message: 'Questa è una prova richiesta dall’amministratore di ScoreFlow. Il servizio email ha accettato il collegamento. Controlla anche la cartella spam.', sentAt: '' };
    const result = await deliverNotification(body.to, notification, { organizationName: row.sender_name || 'ScoreFlow' }, transport);
    const status = result.deliveryStatus === 'sent' ? 'accepted' : 'failed';
    const { error } = await auth.supabase.from(emailSettingsTable).update({ last_test_status: status }).eq('tenant_key', route.tenantKey);
    if (error) throw databaseError(error);
    sendJson(response, status === 'accepted' ? 200 : 422, { settings: publicEmailSettings({ ...row, last_test_at: now, last_test_status: status }),
      message: status === 'accepted' ? 'Email di prova accettata dal servizio. Controlla la casella e lo spam: la consegna non è ancora confermata.' : result.error });
    return true;
  }
  sendJson(response, 405, { error: 'method-not-allowed' }); return true;
}

function cleanAthleteSubmission(value = {}) {
  const profile = cleanProfile(value);
  profile.registeredAt = new Date().toISOString();
  profile.attachments = {};
  profile.performanceDuration = 0;
  profile.review = cleanProfile({}).review;
  return profile;
}

function cleanAccountProfile(value = {}, { fromAthlete = false } = {}) {
  const clean = fromAthlete ? cleanAthleteSubmission : cleanProfile;
  if (value.accountType !== 'group' && !Array.isArray(value.athletes)) return clean(value);
  const manager = value.manager && typeof value.manager === 'object' ? value.manager : {};
  const athletes = (Array.isArray(value.athletes) ? value.athletes : []).slice(0, 100).map(clean);
  return {
    accountType: 'group',
    manager: {
      name: String(manager.name || '').trim().slice(0, 140),
      schoolName: String(manager.schoolName || '').trim().slice(0, 180),
      phone: String(manager.phone || '').trim().slice(0, 40),
      plannedAthletes: String(manager.plannedAthletes || '').slice(0, 20),
      preferredLanguage: normalizeLanguage(manager.preferredLanguage)
    },
    athletes
  };
}

function accountAthletes(profile = {}) {
  return profile.accountType === 'group' && Array.isArray(profile.athletes) ? profile.athletes : [profile];
}

function findAccountAthlete(profile, athleteId = '') {
  const athletes = accountAthletes(profile);
  return athletes.find(item => item.id === athleteId) || (athleteId ? null : athletes[0]) || null;
}

function replaceAccountAthlete(profile, athlete) {
  if (profile.accountType !== 'group' || !Array.isArray(profile.athletes)) return athlete;
  return { ...profile, athletes: profile.athletes.map(item => item.id === athlete.id ? athlete : item) };
}

function registrationCompleteness(profile) {
  const attachments = profile.attachments || {};
  const review = profile.review || {};
  const missing = [];
  if (review.videoStatus !== 'approved') missing.push('video entry approvato');
  if (review.paymentStatus !== 'received') missing.push('pagamento');
  if (!attachments.photo) missing.push('foto');
  if (!attachments.medicalCertificate) missing.push('certificato medico');
  if (!attachments.music) missing.push('MP3');
  return { complete: missing.length === 0, missing };
}

function registrationPhase(registration = {}) {
  const now = Date.now();
  const preOpen = Date.parse(registration.preRegistrationOpensAt || 0);
  const preClose = Date.parse(registration.preRegistrationClosesAt || 0);
  const close = Date.parse(registration.registrationClosesAt || 0);
  if (!registration.enabled) return 'disabled';
  if (preOpen && now < preOpen) return 'scheduled';
  if (preClose && now <= preClose) return 'pre-registration';
  if (close && now <= close) return 'registration';
  return 'closed';
}

async function athleteSession(request, supabase) {
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token.length < 32) return null;
  const { data, error } = await supabase.from(registrationSessionTable)
    .select('id,account_id,tenant_key,event_id,expires_at')
    .eq('token_hash', hashSecret(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw databaseError(error);
  return data ? { ...data, token } : null;
}

async function readJsonBody(request, maximumBytes = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maximumBytes) {
        reject(Object.assign(new Error('Payload troppo grande'), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const json = raw.startsWith('scoreflow64:')
          ? Buffer.from(raw.slice('scoreflow64:'.length), 'base64').toString('utf8')
          : raw;
        resolve(JSON.parse(json || '{}'));
      } catch {
        reject(Object.assign(new Error('JSON non valido'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

async function readBufferBody(request, maximumBytes = 50 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > maximumBytes) {
        reject(Object.assign(new Error('File troppo grande'), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function databaseError(error) {
  if(String(error?.message || '').includes('scoreflow:')) return {message:error.message};
  const missingTable = ['42P01', 'PGRST204', 'PGRST205'].includes(error?.code)
    || /scoreflow_tenants|scoreflow_access_tokens|scoreflow_athlete|scoreflow_license|schema cache|relation/i.test(String(error?.message || ''));
  return {
    statusCode: missingTable ? 503 : 502,
    message: missingTable
      ? 'Il database è collegato, ma manca lo schema ScoreFlow.'
      : 'Connessione al database non disponibile.',
    payload: {
      error: missingTable ? 'database-schema-required' : 'database-error',
      message: missingTable
        ? 'Il database è collegato, ma manca lo schema ScoreFlow.'
        : 'Connessione al database non disponibile.'
    }
  };
}

function stateFromRow(value) {
  if (value && typeof value === 'object') return value;
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

async function readTenant(supabase, tenantKey, fields = 'secret_hash,state_json,revision,updated_at') {
  const { data, error } = await supabase
    .from(tenantTable)
    .select(fields)
    .eq('tenant_key', tenantKey)
    .maybeSingle();
  if (error) throw databaseError(error);
  return data;
}

function tenantKeyFromPath(pathname) {
  const match = pathname.match(/^\/api\/tenants\/([a-z0-9-]{1,80})\/state$/);
  return match ? match[1] : null;
}

function tenantFilesRoute(pathname) {
  const match = pathname.match(/^\/api\/tenants\/([a-z0-9-]{1,80})\/files(?:\/(sign))?$/);
  return match ? { tenantKey: match[1], action: match[2] || 'upload' } : null;
}

function tenantAccessRoute(pathname) {
  const match = pathname.match(/^\/api\/tenants\/([a-z0-9-]{1,80})\/(access|device-state|public-qr)$/);
  return match ? { tenantKey: match[1], action: match[2] } : null;
}

function tenantAdminRoute(pathname) {
  const match = pathname.match(/^\/api\/tenants\/([a-z0-9-]{1,80})\/(registrations|license\/activate|email-settings(?:\/test)?)$/);
  return match ? { tenantKey: match[1], action: match[2] } : null;
}

function requestSecret(request) {
  return String(request.headers['x-scoreflow-key'] || '');
}

function requestAccessToken(request) {
  return String(request.headers['x-scoreflow-access'] || '');
}

async function authenticatedTenant(request, response, tenantKey, options = {}) {
  if (!databaseConfigured) {
    sendJson(response, 503, { error: 'database-not-configured' });
    return null;
  }
  const supabaseAccount = getSupabase();
  const {data: owner, error: ownerError} = await supabaseAccount.from(accountTable).select('owner_id').eq('tenant_key',tenantKey).maybeSingle();
  if(ownerError) throw databaseError(ownerError);
  if(owner && (!options.allowAccess || !requestAccessToken(request))) {
    const user = await organizerUser(request,response);
    if(!user || user.id !== owner.owner_id) { sendJson(response,401,{error:'account-required',message:'Accedi con l’account della società.'}); return null; }
    if(request.method !== 'GET' && !request.url.includes('/license/activate') && !request.url.includes('/files/sign')) await assertTrialWritable(supabaseAccount,tenantKey);
    return {supabase:supabaseAccount,secret:'',accountManaged:true};
  }
  const secret = requestSecret(request);
  const accessToken = requestAccessToken(request);
  if (secret.length < 24 && (!options.allowAccess || accessToken.length < 24)) {
    sendJson(response, 401, { error: 'missing-key' });
    return null;
  }
  if (!secret && options.allowAccess) {
    const supabase = getSupabase('', accessToken);
    const { data: access, error } = await supabase.from(accessTable).select('id,tenant_key,event_id,role,active').eq('tenant_key', tenantKey).eq('token_hash', hashSecret(accessToken)).eq('active', true).maybeSingle();
    if (error || !access) {
      sendJson(response, 403, { error: 'invalid-access-link', message: 'Collegamento non valido o sostituito.' });
      return null;
    }
    if(request.method !== 'GET' && !request.url.includes('/files/sign')) await assertTrialWritable(supabase,tenantKey);
    return { supabase, accessToken, access };
  }
  const supabase = getSupabase(secret);
  const row = await readTenant(supabase, tenantKey, 'secret_hash');
  if (!row) {
    sendJson(response, 404, { error: 'tenant-not-found' });
    return null;
  }
  if (row.secret_hash !== hashSecret(secret)) {
    sendJson(response, 403, { error: 'forbidden' });
    return null;
  }
  return { supabase, secret };
}

function copyParticipantOperations(current = [], incoming = []) {
  const incomingById = new Map(incoming.map(item => [item.id, item]));
  return current.map(item => {
    const update = incomingById.get(item.id);
    if (!update) return item;
    return { ...item, status: update.status, attempt: update.attempt, round: update.round, updatedAt: update.updatedAt };
  });
}

function stateAllowedForRole(currentState, incomingState, role, access = null) {
  const result = JSON.parse(JSON.stringify(currentState || {}));
  const currentEvent = result.events?.[0];
  const incomingEvent = incomingState?.events?.[0];
  if (!currentEvent || !incomingEvent) return result;
  if (role === 'judge') {
    currentEvent.scores = Array.isArray(incomingEvent.scores) ? incomingEvent.scores : currentEvent.scores;
    const incomingJudges = new Map((incomingEvent.judges || []).map(item => [item.id, item]));
    currentEvent.judges = (currentEvent.judges || []).map(item => {
      const incoming = incomingJudges.get(item.id);
      const language = ['it', 'en', 'fr', 'es'].includes(incoming?.language) ? incoming.language : item.language;
      return { ...item, language, lastActivityAt: incoming?.lastActivityAt || item.lastActivityAt };
    });
  } else if (role === 'presenter') {
    currentEvent.presenter = incomingEvent.presenter || currentEvent.presenter;
  } else if (role === 'staff') {
    currentEvent.participants = copyParticipantOperations(currentEvent.participants, incomingEvent.participants);
    currentEvent.notifications = Array.isArray(incomingEvent.notifications) ? incomingEvent.notifications : currentEvent.notifications;
  } else if (role === 'control') {
    currentEvent.control = incomingEvent.control || currentEvent.control;
    currentEvent.participants = copyParticipantOperations(currentEvent.participants, incomingEvent.participants);
    const previousScores = Array.isArray(currentEvent.scores) ? currentEvent.scores : [];
    const previousHistory = Array.isArray(currentEvent.scoreHistory) ? currentEvent.scoreHistory : [];
    const historyIds = new Set(previousHistory.map(item => item.id));
    const addedHistory = (Array.isArray(incomingEvent.scoreHistory) ? incomingEvent.scoreHistory : []).filter(item => item?.id && !historyIds.has(item.id)).map(item => ({
      ...item,
      actor: { role: 'control', accessId: String(access?.id || '').slice(0, 100), email: String(item.actor?.email || '').slice(0, 254) },
      reason: String(item.reason || item.invalidationReason || '').trim().slice(0, 1200),
      createdAt: String(item.createdAt || item.invalidatedAt || new Date().toISOString()).slice(0, 40)
    }));
    const byKey = new Map(previousScores.map(item => [`${item.participantId}:${item.judgeId}:${item.round || 'qualification'}:${Number(item.attempt || 1)}`, item]));
    const audits = new Set(addedHistory.filter(item => item.type === 'manual-override' && item.reason).map(item => `${item.originalScoreId || ''}:${item.replacementScoreId || ''}`));
    currentEvent.scores = (Array.isArray(incomingEvent.scores) ? incomingEvent.scores : previousScores).map(item => {
      const original = byKey.get(`${item.participantId}:${item.judgeId}:${item.round || 'qualification'}:${Number(item.attempt || 1)}`);
      if (original && original.id !== item.id && !audits.has(`${original.id}:${item.id}`)) return original;
      return item;
    });
    currentEvent.scoreHistory = [...previousHistory, ...addedHistory];
    currentEvent.notifications = Array.isArray(incomingEvent.notifications) ? incomingEvent.notifications : currentEvent.notifications;
  } else if (role === 'public') {
    const existing = Array.isArray(currentEvent.publicVotes) ? currentEvent.publicVotes : [];
    const incoming = Array.isArray(incomingEvent.publicVotes) ? incomingEvent.publicVotes : [];
    const ids = new Set(existing.map(item => item.id));
    const deviceVotes = new Set(existing.filter(item => item.deviceId).map(item => `${item.participantId}:${item.deviceId}`));
    const additions = [];
    if (currentEvent.publicVoting?.enabled) for (const item of incoming) {
      const id = String(item?.id || '').slice(0, 100);
      const participantId = String(item?.participantId || '').slice(0, 100);
      const deviceId = String(item?.deviceId || '').slice(0, 100);
      const value = Number(item?.value);
      const key = `${participantId}:${deviceId}`;
      if (!id || ids.has(id) || !participantId || !deviceId || deviceVotes.has(key) || !Number.isFinite(value) || value < 1 || value > 10) continue;
      ids.add(id); deviceVotes.add(key);
      additions.push({ id, participantId, deviceId, value, createdAt: new Date().toISOString() });
    }
    currentEvent.publicVotes = [...existing, ...additions];
  }
  if (['judge', 'control'].includes(role) && currentEvent.competitionRules?.enabled) {
    const previous = new Map((currentState.events?.[0]?.scores || []).map(s => [s.id, JSON.stringify(s)]));
    for (const score of currentEvent.scores || []) {
      if (previous.get(score.id) === JSON.stringify(score)) continue;
      const errors = CompetitionRules.scoreErrors(currentEvent, score);
      if (errors.length) throw Object.assign(new Error(errors.join(' ')), {statusCode:400});
    }
  }
  result.updatedAt = new Date().toISOString();
  return result;
}

const accountTable = 'scoreflow_organization_accounts';
const appOrigin = process.env.SCOREFLOW_APP_ORIGIN || 'https://scoreflow.dynamiczen.it';
const authRates = new Map();

function accountClient() { return getSupabase('organizer-auth-isolated-client'); }
function accountCookies(response, session) {
  const secure = new URL(appOrigin).protocol === 'https:' ? '; Secure' : '';
  response.setHeader('Set-Cookie', [
    `sf_access=${session?.access_token || ''}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${session ? 3600 : 0}`,
    `sf_refresh=${session?.refresh_token || ''}; Path=/api/; HttpOnly; SameSite=Lax${secure}; Max-Age=${session ? 2592000 : 0}`
  ]);
}
function cookieValue(request, key) {
  return String(request.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(key+'='))?.slice(key.length+1) || '';
}
async function organizerUser(request, response) {
  const token = cookieValue(request, 'sf_access');
  const refresh = cookieValue(request, 'sf_refresh');
  if (!token && !refresh) return null;
  const client = accountClient();
  if (token) {
    const { data, error } = await client.auth.getUser(token);
    if (!error && data?.user?.email_confirmed_at) return data.user;
  }
  if (refresh) {
    const { data, error } = await client.auth.refreshSession({ refresh_token: refresh });
    if (!error && data?.session && data.user?.email_confirmed_at) {
      accountCookies(response, data.session);
      return data.user;
    }
  }
  accountCookies(response, null);
  return null;
}
async function trialEntitlements(supabase, tenantKey) {
  const { data: account, error } = await supabase.from(accountTable).select('owner_id,trial_started_at,trial_ends_at,email_attempts').eq('tenant_key',tenantKey).maybeSingle();
  if (error) throw databaseError(error);
  if (!account) return null;
  const { data: licenses, error: licenseError } = await supabase.from(licenseTable).select('plan,expires_at').eq('tenant_key',tenantKey).eq('active',true).limit(10);
  if (licenseError) throw databaseError(licenseError);
  const license = (licenses || []).find(x=>!x.expires_at || Date.parse(x.expires_at)>Date.now());
  const expired = !license && Date.parse(account.trial_ends_at)<=Date.now();
  return { plan: license?.plan || 'trial', status: license ? 'active' : expired ? 'expired' : 'trialing',
    trialDays:14, trialStartedAt:account.trial_started_at, trialEndsAt:account.trial_ends_at,
    readOnly:expired, emailUsed:account.email_attempts, emailLimit:license ? null : 10,
    limits:license ? null : {organizations:1,events:1,athletes:6,judges:3,categories:2}, serverTime:new Date().toISOString() };
}
function accountFailure(message,statusCode=400,code='account-error') {
  return Object.assign(new Error(message),{statusCode,payload:{error:code,message}});
}
async function assertTrialWritable(supabase, tenantKey) {
  const entitlement = await trialEntitlements(supabase,tenantKey);
  if (entitlement?.readOnly) throw accountFailure('La prova di 14 giorni è terminata. I dati restano consultabili ed esportabili.',403,'trial-expired');
  return entitlement;
}
function safeAccountMutation(request) {
  const origin = request.headers.origin;
  if (origin && origin !== new URL(appOrigin).origin) throw accountFailure('Richiesta non consentita.',403);
  if (request.headers['sec-fetch-site']==='cross-site') throw accountFailure('Richiesta non consentita.',403);
}
function rateLimitAccount(request, email='', action='auth') {
  // Trust the direct peer only: spoofable forwarding headers must not disable the cap.
  const keys = [`ip:${request.socket.remoteAddress}:${action}`, ...(email ? [`email:${email}:${action}`] : [])];
  const now = Date.now();
  if(authRates.size>5000) for(const [key,value] of authRates) if(value.until<now) authRates.delete(key);
  for(const key of keys) {
    let entry=authRates.get(key);
    if(!entry || entry.until<now) { entry={count:0,until:now+15*60000}; authRates.set(key,entry); }
    if(++entry.count>(key.startsWith('ip:')?60:6)) throw accountFailure('Troppi tentativi. Riprova tra 15 minuti.',429,'rate-limited');
  }
}
async function sendAccountLink(email,type,password,requestedLanguage='it') {
  if (!managedEmailReady()) throw accountFailure('Il servizio email non è disponibile. Riprova più tardi.',503);
  const client=accountClient();
  const {data,error}=await client.auth.admin.generateLink({type,email,...(password?{password}:{} )});
  // Recovery must never reveal whether an address is registered.
  if(error || !data?.properties?.hashed_token) {
    if(type==='recovery' || error?.code==='email_exists') return;
    throw accountFailure('Non è stato possibile inviare il collegamento. Prova ad accedere o recuperare la password.',422);
  }
  const link=`${appOrigin}/#account=${type}&token=${encodeURIComponent(data.properties.hashed_token)}`;
  const recovery=type==='recovery';
  const language=normalizeLanguage(requestedLanguage);
  const copy={
    it:{subjects:['ScoreFlow — recupera la password','ScoreFlow — conferma il tuo account'],texts:['Per impostare una nuova password','Per confermare il tuo indirizzo e iniziare la prova di 14 giorni'],ignore:'Se non hai richiesto questa operazione, ignora questa email.'},
    en:{subjects:['ScoreFlow — recover your password','ScoreFlow — confirm your account'],texts:['To set a new password','To confirm your email address and start the 14-day trial'],ignore:'If you did not request this action, ignore this email.'},
    fr:{subjects:['ScoreFlow — récupérez votre mot de passe','ScoreFlow — confirmez votre compte'],texts:['Pour définir un nouveau mot de passe','Pour confirmer votre adresse e-mail et commencer l’essai de 14 jours'],ignore:'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.'},
    es:{subjects:['ScoreFlow — recupera tu contraseña','ScoreFlow — confirma tu cuenta'],texts:['Para establecer una nueva contraseña','Para confirmar tu correo y comenzar la prueba de 14 días'],ignore:'Si no solicitaste esta acción, ignora este correo.'}
  }[language];
  const result=await deliverNotification(email,{id:crypto.randomUUID(),subject:copy.subjects[recovery?0:1],
    message:`${copy.texts[recovery?0:1]}:\n${link}\n\n${copy.ignore}`},
    {organizationName:'ScoreFlow',accountLink:link,recovery,language}, {apiKey:process.env.RESEND_API_KEY,from:process.env.SCOREFLOW_EMAIL_FROM,tenantKey:'account-auth'});
  if(result.deliveryStatus!=='sent') throw accountFailure('Invio email non riuscito. Riprova più tardi.',502);
}
async function handleAccountApi(request,response,url) {
  if(!url.pathname.startsWith('/api/account/')) return false;
  if(!databaseConfigured) {sendJson(response,503,{error:'database-not-configured'});return true;}
  const action=url.pathname.slice('/api/account/'.length);
  if(request.method==='GET' && action==='session') {
    const user=await organizerUser(request,response);
    if(!user){sendJson(response,200,{user:null});return true;}
    const supabase=getSupabase();
    const {data:owner,error}=await supabase.from(accountTable).select('tenant_key').eq('owner_id',user.id).maybeSingle();
    if(error) throw databaseError(error);
    let organization=null;
    if(owner){const row=await readTenant(supabase,owner.tenant_key);const entitlement=await trialEntitlements(supabase,owner.tenant_key);
      organization={tenantKey:owner.tenant_key,revision:Number(row.revision),state:stateFromRow(row.state_json),entitlements:entitlement};}
    sendJson(response,200,{user:{email:user.email},organization});return true;
  }
  if(request.method!=='POST'){sendJson(response,405,{error:'method-not-allowed'});return true;}
  safeAccountMutation(request);
  const body=await readJsonBody(request,16*1024);
  const email=normalizeEmail(body.email),password=String(body.password || '');
  if(['signup','login','recover','verify','reset'].includes(action)) rateLimitAccount(request,email,action);
  if(['signup','login','recover'].includes(action) && !validEmailAddress(email)) throw accountFailure('Inserisci un indirizzo email valido.');
  if(['signup','reset'].includes(action) && (password.length<8 || password.length>128)) throw accountFailure('Scegli una password da 8 a 128 caratteri.');
  if(action==='signup' || action==='recover') {
    await sendAccountLink(email,action==='signup'?'signup':'recovery',action==='signup'?password:undefined,body.language);
    sendJson(response,200,{message:action==='signup'?'Controlla la tua email per confermare l’account. Se hai già un account, accedi o recupera la password.':'Se l’indirizzo è registrato, riceverai il collegamento per recuperare la password.'});return true;
  }
  if(action==='login') {
    const {data,error}=await accountClient().auth.signInWithPassword({email,password});
    if(error || !data.session || !data.user?.email_confirmed_at) throw accountFailure('Email o password non corretti, oppure email ancora da confermare.',401);
    accountCookies(response,data.session);sendJson(response,200,{ok:true});return true;
  }
  if(action==='verify' || action==='reset') {
    const type=action==='reset'?'recovery':'email';
    const token=String(body.token || '');
    if(!/^[a-f0-9]{32,128}$/i.test(token)) throw accountFailure('Collegamento non valido o scaduto. Richiedine uno nuovo.');
    const client=accountClient();
    const {data,error}=await client.auth.verifyOtp({token_hash:token,type});
    if(error || !data.session) throw accountFailure('Collegamento non valido o scaduto. Richiedine uno nuovo.');
    if(action==='reset') {
      const {error:updateError}=await client.auth.updateUser({password});
      if(updateError) throw accountFailure('Password non accettata. Richiedi un nuovo collegamento.',422);
      await client.auth.signOut({scope:'others'});
    }
    accountCookies(response,data.session);sendJson(response,200,{ok:true});return true;
  }
  if(action==='logout') {
    const token=cookieValue(request,'sf_access');
    if(token) await accountClient().auth.admin.signOut(token,'local');
    accountCookies(response,null);sendJson(response,200,{ok:true});return true;
  }
  sendJson(response,404,{error:'not-found'});return true;
}

async function handleApi(request, response, requestUrl) {
  if (request.method !== 'GET' && requestUrl.pathname.startsWith('/api/')) safeAccountMutation(request);
  if (await handleAccountApi(request,response,requestUrl)) return true;
  if (requestUrl.pathname === '/api/status' && request.method === 'GET') {
    if (!databaseConfigured) {
      sendJson(response, 200, { status: 'setup-required', database: false, email: false, emailMode: 'managed-or-custom', service: 'scoreflow', version: '3.4.0' });
      return true;
    }
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from(tenantTable).select('tenant_key').limit(1);
      if (error) throw databaseError(error);
      sendJson(response, 200, { status: 'ok', database: true, email: managedEmailReady(), emailMode: 'managed-or-custom', emailProvider: 'resend', provider: 'supabase', service: 'scoreflow', version: '3.4.0' });
    } catch (error) {
      console.error('Database status error', error);
      const details = error?.payload ? error : databaseError(error);
      sendJson(response, details.statusCode, { status: details.payload.error, database: false, ...details.payload });
    }
    return true;
  }

  if (requestUrl.pathname === '/api/registration/config' && request.method === 'GET') {
    if (!databaseConfigured) { sendJson(response, 503, { error: 'database-not-configured' }); return true; }
    const tenantKey = String(requestUrl.searchParams.get('tenant') || '').trim().toLowerCase();
    if (!/^[a-z0-9-]{1,80}$/.test(tenantKey)) { sendJson(response, 400, { error: 'invalid-tenant' }); return true; }
    const supabase = getSupabase();
    const row = await readTenant(supabase, tenantKey, 'state_json');
    if (!row) { sendJson(response, 404, { error: 'tenant-not-found' }); return true; }
    const state = stateFromRow(row.state_json);
    const event = state.events?.[0];
    const registration = event?.registration || {};
    const entitlements=await trialEntitlements(supabase,tenantKey);
    sendJson(response, 200, {
      tenantKey, organizationName: state.name || '', brand: state.brand || {}, language: normalizeLanguage(state.language),
      event: event ? { id: event.id, name: event.name, location: event.location, startsAt: event.startsAt, endsAt: event.endsAt, disciplines: event.disciplines || [], categories: event.categories || [] } : null,
      registration, readOnly:Boolean(entitlements?.readOnly), phase: entitlements?.readOnly ? 'closed' : registrationPhase(registration), serverTime: new Date().toISOString()
    });
    return true;
  }

  if (['/api/registration/signup', '/api/athlete/enroll'].includes(requestUrl.pathname) && request.method === 'POST') {
    if (!databaseConfigured) { sendJson(response, 503, { error: 'database-not-configured' }); return true; }
    const body = await readJsonBody(request, 512 * 1024);
    const tenantKey = String(body.tenantKey || '').trim().toLowerCase();
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const supabase = getSupabase();
    const tenant = await readTenant(supabase, tenantKey, 'state_json');
    const state = tenant && stateFromRow(tenant.state_json);
    const event = state?.events?.[0];
    await assertTrialWritable(supabase,tenantKey);
    const phase = registrationPhase(event?.registration || {});
    if (!event || phase !== 'pre-registration') { sendJson(response, 403, { error: 'pre-registration-closed', message: 'Non è più possibile creare nuove preiscrizioni. Gli account esistenti possono ancora completare documenti e allegati entro la chiusura finale.' }); return true; }
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) { sendJson(response, 400, { error: 'invalid-credentials', message: 'Inserisci un’email valida e una password di almeno 8 caratteri.' }); return true; }
    const profile = cleanAccountProfile(body.accountProfile || body.profile, { fromAthlete: true });
    const athletes = accountAthletes(profile);
    if (!athletes.length || athletes.some(item => !item.firstName || !item.lastName || !item.schoolName || !item.coachName || !item.coachPhone || !item.discipline || !item.categoryId || !item.privacyAccepted)) {
      sendJson(response, 400, { error: 'incomplete-profile', message: 'Completa tutti i campi obbligatori, inclusi scuola, coach e telefono coach.' }); return true;
    }
    const now = new Date().toISOString();
    const { data: account, error } = await supabase.from(registrationTable).insert({
      tenant_key: tenantKey, event_id: event.id, email, password_hash: passwordHash(password), profile_json: profile,
      status: phase === 'pre-registration' ? 'pre-registered' : 'registered', created_at: now, updated_at: now
    }).select('id,status,created_at,updated_at').single();
    if (error) {
      if (error.code === '23505') { sendJson(response, 409, { error: 'email-exists', message: 'Esiste già una scheda con questa email. Accedi con le tue credenziali.' }); return true; }
      throw databaseError(error);
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    const { error: sessionError } = await supabase.from(registrationSessionTable).insert({ account_id: account.id, tenant_key: tenantKey, event_id: event.id, token_hash: hashSecret(token), expires_at: expiresAt });
    if (sessionError) throw databaseError(sessionError);
    sendJson(response, 201, { token, expiresAt, account: { ...account, email, profile } });
    return true;
  }

  if (['/api/registration/login', '/api/athlete/access'].includes(requestUrl.pathname) && request.method === 'POST') {
    if (!databaseConfigured) { sendJson(response, 503, { error: 'database-not-configured' }); return true; }
    const body = await readJsonBody(request, 64 * 1024);
    const tenantKey = String(body.tenantKey || '').trim().toLowerCase();
    const email = normalizeEmail(body.email);
    const supabase = getSupabase();
    const { data: account, error } = await supabase.from(registrationTable).select('id,event_id,email,password_hash,profile_json,status,created_at,updated_at').eq('tenant_key', tenantKey).eq('email', email).maybeSingle();
    if (error) throw databaseError(error);
    if (!account || !passwordMatches(body.password, account.password_hash)) { sendJson(response, 401, { error: 'invalid-login', message: 'Email o password non corretti.' }); return true; }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    const { error: sessionError } = await supabase.from(registrationSessionTable).insert({ account_id: account.id, tenant_key: tenantKey, event_id: account.event_id, token_hash: hashSecret(token), expires_at: expiresAt });
    if (sessionError) throw databaseError(sessionError);
    delete account.password_hash;
    account.profile = account.profile_json; delete account.profile_json;
    sendJson(response, 200, { token, expiresAt, account });
    return true;
  }

  if (requestUrl.pathname === '/api/athlete/file' && ['GET', 'POST'].includes(request.method)) {
    if (!databaseConfigured) { sendJson(response, 503, { error: 'database-not-configured' }); return true; }
    const supabase = getSupabase();
    const session = await athleteSession(request, supabase);
    if (!session) { sendJson(response, 401, { error: 'invalid-session', message: 'Sessione scaduta. Accedi nuovamente.' }); return true; }
    const kind = String(requestUrl.searchParams.get('kind') || '');
    const rules = athleteFileKinds[kind];
    if (!rules) { sendJson(response, 400, { error: 'invalid-file-kind', message: 'Tipo di allegato non valido.' }); return true; }
    const { data: account, error: accountError } = await supabase.from(registrationTable)
      .select('id,event_id,email,profile_json,status,created_at,updated_at').eq('id', session.account_id).maybeSingle();
    if (accountError) throw databaseError(accountError);
    if (!account) { sendJson(response, 404, { error: 'account-not-found' }); return true; }
    const accountProfile = cleanAccountProfile(account.profile_json || {});
    const athleteId = String(requestUrl.searchParams.get('athleteId') || '');
    const profile = findAccountAthlete(accountProfile, athleteId);
    if (!profile) { sendJson(response, 404, { error: 'athlete-not-found', message: 'Atleta non trovato in questo account.' }); return true; }
    const attachment = profile.attachments?.[kind];

    if (request.method === 'GET') {
      if (!attachment?.cloudPath || !String(attachment.cloudPath).startsWith(`${session.tenant_key}/athletes/${account.id}/`)) {
        sendJson(response, 404, { error: 'file-not-found', message: 'File non disponibile.' }); return true;
      }
      const { data, error } = await supabase.storage.from(storageBucket).createSignedUrl(attachment.cloudPath, 3600);
      if (error || !data?.signedUrl) { sendJson(response, 404, { error: 'file-not-found', message: 'File non disponibile.' }); return true; }
      sendJson(response, 200, { url: data.signedUrl, expiresIn: 3600 });
      return true;
    }

    await assertTrialWritable(supabase,session.tenant_key);
    const tenant = await readTenant(supabase, session.tenant_key, 'state_json');
    const event = tenant && stateFromRow(tenant.state_json).events?.find(item => item.id === session.event_id);
    if (!['pre-registration', 'registration'].includes(registrationPhase(event?.registration || {}))) {
      sendJson(response, 403, { error: 'registration-closed', message: 'Il termine per modificare la scheda è scaduto.' }); return true;
    }
    const contentType = String(request.headers['content-type'] || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    if (!rules.types.test(contentType)) { sendJson(response, 415, { error: 'invalid-file-type', message: 'Formato del file non consentito.' }); return true; }
    const body = await readBufferBody(request, rules.maximumBytes);
    if (!body.length) { sendJson(response, 400, { error: 'empty-file', message: 'Il file è vuoto.' }); return true; }
    const originalName = decodeURIComponent(String(request.headers['x-file-name'] || 'file')).slice(0, 180);
    const safeName = originalName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
    const storagePath = `${session.tenant_key}/athletes/${account.id}/${profile.id}/${kind}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(storageBucket).upload(storagePath, body, { contentType, upsert: false });
    if (uploadError) { sendJson(response, 502, { error: 'storage-upload-error', message: 'Caricamento cloud non riuscito.' }); return true; }
    const now = new Date().toISOString();
    const durationSeconds = Math.max(0, Math.min(7200, Number(request.headers['x-media-duration']) || 0));
    profile.attachments = profile.attachments || {};
    profile.attachments[kind] = { name: originalName, type: contentType, size: body.length, durationSeconds, cloudPath: storagePath, provider: 'supabase-storage', uploadedAt: now };
    if (kind === 'music' && durationSeconds) profile.performanceDuration = Math.round(durationSeconds);
    const savedAccountProfile = replaceAccountAthlete(accountProfile, profile);
    const { data: updated, error: updateError } = await supabase.from(registrationTable)
      .update({ profile_json: savedAccountProfile, updated_at: now }).eq('id', account.id)
      .select('id,event_id,email,profile_json,status,created_at,updated_at').single();
    if (updateError) throw databaseError(updateError);
    const { data: signed } = await supabase.storage.from(storageBucket).createSignedUrl(storagePath, 3600);
    updated.profile = updated.profile_json; delete updated.profile_json;
    sendJson(response, 201, { account: updated, attachment: profile.attachments[kind], url: signed?.signedUrl || null });
    return true;
  }

  if (['/api/registration/profile', '/api/athlete/profile'].includes(requestUrl.pathname) && ['GET', 'PUT'].includes(request.method)) {
    if (!databaseConfigured) { sendJson(response, 503, { error: 'database-not-configured' }); return true; }
    const supabase = getSupabase();
    const session = await athleteSession(request, supabase);
    if (!session) { sendJson(response, 401, { error: 'invalid-session', message: 'Sessione scaduta. Accedi nuovamente.' }); return true; }
    const { data: account, error } = await supabase.from(registrationTable).select('id,event_id,email,profile_json,status,created_at,updated_at').eq('id', session.account_id).maybeSingle();
    if (error) throw databaseError(error);
    if (!account) { sendJson(response, 404, { error: 'account-not-found' }); return true; }
    if (request.method === 'GET') { account.profile = account.profile_json; delete account.profile_json; sendJson(response, 200, { account }); return true; }
    await assertTrialWritable(supabase,session.tenant_key);
    const tenant = await readTenant(supabase, session.tenant_key, 'state_json');
    const event = tenant && stateFromRow(tenant.state_json).events?.find(item => item.id === session.event_id);
    const phase = registrationPhase(event?.registration || {});
    if (phase !== 'pre-registration') { sendJson(response, 403, { error: 'profile-locked', message: 'I dati della preiscrizione sono chiusi. Puoi ancora caricare i documenti mancanti fino alla chiusura delle iscrizioni.' }); return true; }
    const body = await readJsonBody(request, 512 * 1024);
    const accountProfile = cleanAccountProfile(account.profile_json || {});
    const profile = cleanAthleteSubmission(body.profile);
    if (!profile.firstName || !profile.lastName || !profile.schoolName || !profile.coachName || !profile.coachPhone || !profile.discipline || !profile.categoryId || !profile.privacyAccepted) { sendJson(response, 400, { error: 'incomplete-profile', message: 'Completa tutti i campi obbligatori.' }); return true; }
    let savedProfile;
    if (accountProfile.accountType === 'group') {
      const action = String(body.action || 'update');
      if (action === 'add') savedProfile = { ...accountProfile, athletes: [...accountProfile.athletes, profile] };
      else {
        const athleteId = String(body.athleteId || profile.id || '');
        const existing = findAccountAthlete(accountProfile, athleteId);
        if (!existing) { sendJson(response, 404, { error: 'athlete-not-found', message: 'Atleta non trovato.' }); return true; }
        if (existing.review?.rosterSyncedAt && phase !== 'pre-registration') { sendJson(response, 403, { error: 'roster-profile-locked', message: 'L’atleta è già nel roster: dopo la chiusura delle preiscrizioni i dati di gara possono essere modificati soltanto dalla regia.' }); return true; }
        profile.id = existing.id;
        profile.registeredAt = existing.registeredAt || account.created_at;
        profile.attachments = existing.attachments || profile.attachments;
        profile.performanceDuration = Math.round(Number(profile.attachments.music?.durationSeconds) || 0);
        profile.review = existing.review || profile.review;
        savedProfile = replaceAccountAthlete(accountProfile, profile);
      }
    } else {
      if (accountProfile.review?.rosterSyncedAt && phase !== 'pre-registration') { sendJson(response, 403, { error: 'roster-profile-locked', message: 'L’atleta è già nel roster: dopo la chiusura delle preiscrizioni i dati di gara possono essere modificati soltanto dalla regia.' }); return true; }
      profile.id = accountProfile.id || profile.id;
      profile.registeredAt = accountProfile.registeredAt || account.created_at;
      profile.attachments = accountProfile.attachments || profile.attachments;
      profile.performanceDuration = Math.round(Number(profile.attachments.music?.durationSeconds) || 0);
      profile.review = accountProfile.review || profile.review;
      savedProfile = profile;
    }
    const { data: updated, error: updateError } = await supabase.from(registrationTable).update({ profile_json: savedProfile, updated_at: new Date().toISOString() }).eq('id', account.id).select('id,event_id,email,profile_json,status,created_at,updated_at').single();
    if (updateError) throw databaseError(updateError);
    updated.profile = updated.profile_json; delete updated.profile_json;
    sendJson(response, 200, { account: updated });
    return true;
  }

  const adminRoute = tenantAdminRoute(requestUrl.pathname);
  if (adminRoute?.action.startsWith('email-settings')) return handleEmailSettings(request, response, requestUrl, adminRoute);
  if (adminRoute && adminRoute.action === 'registrations' && request.method === 'GET') {
    const auth = await authenticatedTenant(request, response, adminRoute.tenantKey);
    if (!auth) return true;
    const eventId = String(requestUrl.searchParams.get('eventId') || '');
    const { data, error } = await auth.supabase.from(registrationTable).select('id,event_id,email,profile_json,status,created_at,updated_at').eq('tenant_key', adminRoute.tenantKey).eq('event_id', eventId).order('created_at', { ascending: true });
    if (error) throw databaseError(error);
    const registrations = (data || []).flatMap(item => {
      const accountProfile = cleanAccountProfile(item.profile_json || {});
      if (accountProfile.accountType !== 'group' && !item.profile_json?.id) accountProfile.id = `legacy-${item.id}`;
      return accountAthletes(accountProfile).map(profile => ({
        id: item.id,
        athleteId: profile.id,
        accountType: accountProfile.accountType === 'group' ? 'group' : 'individual',
        manager: accountProfile.manager || null,
        event_id: item.event_id,
        email: item.email,
        profile,
        status: item.status,
        completeness: registrationCompleteness(profile),
        created_at: item.created_at,
        updated_at: item.updated_at
      }));
    });
    sendJson(response, 200, { registrations });
    return true;
  }

  if (adminRoute && adminRoute.action === 'registrations' && request.method === 'POST') {
    const auth = await authenticatedTenant(request, response, adminRoute.tenantKey);
    if (!auth) return true;
    const body = await readJsonBody(request, 128 * 1024);
    const registrationId = String(body.registrationId || '');
    const athleteId = String(body.athleteId || '');
    const action = String(body.action || '');
    const allowedActions = new Set(['save-review', 'approve-video', 'request-video', 'mark-paid', 'mark-unpaid', 'approve-roster', 'withdraw', 'restore', 'send-notification']);
    if (!registrationId || !allowedActions.has(action)) { sendJson(response, 400, { error: 'invalid-review', message: 'Operazione di revisione non valida.' }); return true; }
    const { data: row, error } = await auth.supabase.from(registrationTable).select('id,event_id,email,profile_json,status,created_at,updated_at').eq('tenant_key', adminRoute.tenantKey).eq('id', registrationId).maybeSingle();
    if (error) throw databaseError(error);
    if (!row) { sendJson(response, 404, { error: 'registration-not-found', message: 'Iscrizione non trovata.' }); return true; }
    const accountProfile = cleanAccountProfile(row.profile_json || {});
    if (accountProfile.accountType !== 'group' && !row.profile_json?.id) accountProfile.id = `legacy-${row.id}`;
    const profile = findAccountAthlete(accountProfile, athleteId);
    if (!profile) { sendJson(response, 404, { error: 'athlete-not-found', message: 'Atleta non trovato.' }); return true; }
    const now = new Date().toISOString();
    const review = { ...(profile.review || {}), reviewedAt: now, notificationPending: true };
    review.notifications = Array.isArray(review.notifications) ? review.notifications : [];
    if (body.categoryId) {
      review.requestedCategoryId = review.requestedCategoryId || profile.categoryId;
      review.assignedCategoryId = String(body.categoryId).slice(0, 140);
      profile.categoryId = review.assignedCategoryId;
      profile.categoryName = String(body.categoryName || profile.categoryName || '').slice(0, 180);
    }
    if (action === 'approve-video') { review.videoStatus = 'approved'; review.status = 'video-approved'; }
    if (action === 'request-video') { review.videoStatus = 'changes-requested'; review.status = 'changes-requested'; }
    if (action === 'mark-paid') review.paymentStatus = 'received';
    if (action === 'mark-unpaid') review.paymentStatus = 'pending';
    if (action === 'withdraw') review.status = 'withdrawn';
    if (action === 'restore') review.status = review.videoStatus === 'approved' ? 'video-approved' : 'submitted';
    review.reason = String(body.reason || '').trim().slice(0, 1200);
    profile.review = review;
    const tenant = await readTenant(auth.supabase, adminRoute.tenantKey, 'state_json');
    const tenantState = stateFromRow(tenant?.state_json);
    const event = (tenantState.events || []).find(item => item.id === row.event_id) || tenantState.events?.[0] || {};
    if (body.facChecks && event.competitionRules?.enabled) review.facChecks = { video: body.facChecks.video === true, eligibility: body.facChecks.eligibility === true, duo: body.facChecks.duo === true };
    const completeness = registrationCompleteness(profile);
    if (action === 'approve-roster') {
      const ruleErrors = CompetitionRules.issues(event, profile, row.created_at);
      if (ruleErrors.length) { sendJson(response, 409, { error: 'competition-rules', message: ruleErrors.join(' ') }); return true; }
      if (!completeness.complete) { sendJson(response, 409, { error: 'registration-incomplete', message: `Pratica incompleta: mancano ${completeness.missing.join(', ')}.` }); return true; }
      profile.review.status = 'roster-approved';
      profile.review.rosterSyncedAt = now;
    }

    const mailSettings = await readEmailSettings(auth, adminRoute.tenantKey);
    const transport = await organizationEmailTransport(mailSettings, auth, adminRoute.tenantKey);
    const emailContext = { organizationName: tenantState.name || 'ScoreFlow', eventName: event.name || 'competizione', reason: review.reason, categoryName: String(body.categoryName || profile.categoryName || ''), missing: registrationCompleteness(profile).missing, language: normalizeLanguage(profile.preferredLanguage || tenantState.language) };
    if (action === 'send-notification') {
      const notificationId = String(body.notificationId || '');
      const index = notificationId ? review.notifications.findIndex(item => item.id === notificationId) : review.notifications.length - 1;
      if (index < 0) { sendJson(response, 404, { error: 'notification-not-found', message: 'Comunicazione non trovata.' }); return true; }
      review.notifications[index] = await deliverNotification(row.email, { ...review.notifications[index], deliveryStatus: 'pending', error: '' }, emailContext, transport);
    } else {
      const created = notificationForAction(action, profile, emailContext);
      if (created) review.notifications.push(await deliverNotification(row.email, created, emailContext, transport));
    }
    review.notifications = review.notifications.slice(-50);
    review.notificationPending = review.notifications.some(item => item.deliveryStatus !== 'sent');
    profile.review = review;
    const savedProfile = replaceAccountAthlete(accountProfile, profile);
    const { data: updated, error: updateError } = await auth.supabase.from(registrationTable).update({ profile_json: savedProfile, updated_at: now }).eq('id', row.id).select('id,email,updated_at').single();
    if (updateError) throw databaseError(updateError);
    sendJson(response, 200, { registration: { ...updated, athleteId: profile.id, profile, completeness: registrationCompleteness(profile) }, emailConfigured: Boolean(transport) });
    return true;
  }

  if (adminRoute && adminRoute.action === 'license/activate' && request.method === 'POST') {
    const auth = await authenticatedTenant(request, response, adminRoute.tenantKey);
    if (!auth) return true;
    const body = await readJsonBody(request, 64 * 1024);
    const codeHash = hashSecret(String(body.code || '').trim().toUpperCase());
    const { data: license, error } = await auth.supabase.from(licenseTable).select('id,plan,expires_at,max_activations,activation_count,active,tenant_key').eq('code_hash', codeHash).maybeSingle();
    if (error) throw databaseError(error);
    if (!license || !license.active || (license.expires_at && Date.parse(license.expires_at) < Date.now()) || Number(license.activation_count) >= Number(license.max_activations) || (license.tenant_key && license.tenant_key !== adminRoute.tenantKey)) {
      sendJson(response, 400, { error: 'invalid-license', message: 'Codice non valido, scaduto o già utilizzato.' }); return true;
    }
    const { error: updateError } = await auth.supabase.from(licenseTable).update({ tenant_key: adminRoute.tenantKey, activation_count: Number(license.activation_count) + 1, activated_at: new Date().toISOString() }).eq('id', license.id);
    if (updateError) throw databaseError(updateError);
    sendJson(response, 200, { plan: license.plan || 'professional', status: 'active', expiresAt: license.expires_at || null });
    return true;
  }

  const filesRoute = tenantFilesRoute(requestUrl.pathname);
  if (filesRoute && filesRoute.action === 'upload' && request.method === 'POST') {
    const auth = await authenticatedTenant(request, response, filesRoute.tenantKey);
    if (!auth) return true;
    const entitlement=await trialEntitlements(auth.supabase,filesRoute.tenantKey);
    if(entitlement?.status==='trialing' && !['brand','event-rules'].includes(request.headers['x-file-purpose']) && !String(request.headers['x-file-purpose'] || '').startsWith('athletes/')) throw accountFailure('Nella prova sono inclusi gli allegati delle iscrizioni e il logo. L’archivio documenti evento richiede una licenza.',403);
    const body = await readBufferBody(request);
    if (!body.length) {
      sendJson(response, 400, { error: 'empty-file', message: 'Il file è vuoto.' });
      return true;
    }
    const originalName = decodeURIComponent(String(request.headers['x-file-name'] || 'file')).slice(0, 180);
    const safeName = originalName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
    const purpose = String(request.headers['x-file-purpose'] || 'documents').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 50) || 'documents';
    const contentType = String(request.headers['content-type'] || 'application/octet-stream').slice(0, 120);
    let extractedText=null, extractionWarning=null;
    if(purpose==='event-rules'){
      if(!/\.(pdf|docx)$/i.test(originalName)||body.length>10*1024*1024)throw accountFailure('Regolamento: PDF o DOCX, massimo 10 MB.',400);
      try{extractedText=await require('./scripts/extract-regulation.cjs')(body,originalName);if(!extractedText.trim())extractionWarning='Il documento non contiene testo leggibile. Incolla il testo; le scansioni richiedono OCR.';}
      catch(error){extractionWarning=error.message;}
    }
    const storagePath = `${filesRoute.tenantKey}/${purpose}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await auth.supabase.storage.from(storageBucket).upload(storagePath, body, { contentType, upsert: false });
    if (error) {
      const missingBucket = /bucket.*not found|not found/i.test(String(error.message || ''));
      sendJson(response, missingBucket ? 503 : 502, { error: missingBucket ? 'storage-schema-required' : 'storage-upload-error', message: missingBucket ? 'Manca il bucket ScoreFlow in Supabase. Esegui lo schema 2.5.' : 'Caricamento cloud non riuscito.' });
      return true;
    }
    sendJson(response, 201, { path: storagePath, name: originalName, size: body.length, type: contentType, provider: 'supabase-storage', extractedText, extractionWarning });
    return true;
  }

  if (filesRoute && filesRoute.action === 'sign' && request.method === 'POST') {
    const auth = await authenticatedTenant(request, response, filesRoute.tenantKey, { allowAccess: true });
    if (!auth) return true;
    const body = await readJsonBody(request, 64 * 1024);
    const storagePath = String(body.path || '');
    if (!storagePath.startsWith(`${filesRoute.tenantKey}/`) || storagePath.includes('..')) {
      sendJson(response, 400, { error: 'invalid-file-path' });
      return true;
    }
    const { data, error } = await auth.supabase.storage.from(storageBucket).createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) {
      sendJson(response, 404, { error: 'file-not-found', message: 'File cloud non disponibile.' });
      return true;
    }
    sendJson(response, 200, { url: data.signedUrl, expiresIn: 3600 });
    return true;
  }

  const accessRoute = tenantAccessRoute(requestUrl.pathname);
  if (accessRoute && accessRoute.action === 'public-qr' && request.method === 'POST') {
    const auth = await authenticatedTenant(request, response, accessRoute.tenantKey);
    if (!auth) return true;
    const body = await readJsonBody(request, 32 * 1024);
    let target;
    try { target = new URL(String(body.url || '')); } catch { target = null; }
    if (!target || target.origin !== new URL(appOrigin).origin || target.searchParams.get('tenant') !== accessRoute.tenantKey || target.searchParams.get('role') !== 'public' || !/^[a-f0-9]{64}$/i.test(target.searchParams.get('token') || '')) {
      sendJson(response, 400, { error: 'invalid-public-link', message: 'Genera prima un collegamento pubblico valido.' }); return true;
    }
    const row = await readTenant(auth.supabase, accessRoute.tenantKey, 'state_json');
    const event = stateFromRow(row?.state_json).events?.[0];
    if (!event?.publicVoting?.enabled || !event.publicVoting.qrEnabled) {
      sendJson(response, 409, { error: 'public-qr-disabled', message: 'Il QR pubblico non è attivo per questo evento.' }); return true;
    }
    const svg = await QRCode.toString(target.toString(), { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 512 });
    sendJson(response, 200, { url: target.toString(), svg }); return true;
  }
  if (accessRoute && accessRoute.action === 'access' && request.method === 'POST') {
    const auth = await authenticatedTenant(request, response, accessRoute.tenantKey);
    if (!auth) return true;
    const body = await readJsonBody(request, 128 * 1024);
    const role = String(body.role || '');
    const eventId = String(body.eventId || '').slice(0, 120);
    if (!allowedRoles.has(role) || !eventId) {
      sendJson(response, 400, { error: 'invalid-role', message: 'Ruolo o evento non valido.' });
      return true;
    }
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSecret(token);
    const { error: deleteError } = await auth.supabase.from(accessTable).delete().eq('tenant_key', accessRoute.tenantKey).eq('event_id', eventId).eq('role', role);
    if (deleteError) throw databaseError(deleteError);
    const { data, error } = await auth.supabase.from(accessTable).insert({
      tenant_key: accessRoute.tenantKey,
      event_id: eventId,
      role,
      label: String(body.label || role).slice(0, 100),
      token_hash: tokenHash,
      active: true
    }).select('id,created_at').single();
    if (error) throw databaseError(error);
    sendJson(response, 201, { id: data.id, token, role, eventId, createdAt: data.created_at });
    return true;
  }

  if (accessRoute && accessRoute.action === 'device-state' && ['GET', 'PUT'].includes(request.method)) {
    const auth = await authenticatedTenant(request, response, accessRoute.tenantKey, { allowAccess: true });
    if (!auth) return true;
    if(!auth.access){sendJson(response,400,{error:'role-link-required'});return true;}
    const row = await readTenant(auth.supabase, accessRoute.tenantKey);
    if (!row) {
      sendJson(response, 404, { error: 'tenant-not-found' });
      return true;
    }
    if (request.method === 'GET') {
      sendJson(response, 200, { tenantKey: accessRoute.tenantKey, role: auth.access.role, eventId: auth.access.event_id, revision: Number(row.revision), updatedAt: row.updated_at, state: stateFromRow(row.state_json), entitlements: await trialEntitlements(auth.supabase,accessRoute.tenantKey) });
      return true;
    }
    const body = await readJsonBody(request);
    const expectedRevision = Number(body.revision);
    if (!body.state || typeof body.state !== 'object' || !Number.isInteger(expectedRevision)) {
      sendJson(response, 400, { error: 'invalid-state' });
      return true;
    }
    if (expectedRevision !== Number(row.revision)) {
      sendJson(response, 409, { error: 'revision-conflict', revision: Number(row.revision), updatedAt: row.updated_at, state: stateFromRow(row.state_json) });
      return true;
    }
    const restrictedState = stateAllowedForRole(stateFromRow(row.state_json), body.state, auth.access.role, auth.access);
    const { data: updated, error: updateError } = await auth.supabase
      .from(tenantTable)
      .update({ state_json: restrictedState, revision: expectedRevision + 1, updated_at: new Date().toISOString() })
      .eq('tenant_key', accessRoute.tenantKey)
      .eq('revision', expectedRevision)
      .select('revision')
      .maybeSingle();
    if (updateError) throw databaseError(updateError);
    if (!updated) {
      const latest = await readTenant(auth.supabase, accessRoute.tenantKey, 'state_json,revision,updated_at');
      sendJson(response, 409, { error: 'revision-conflict', revision: Number(latest.revision), updatedAt: latest.updated_at, state: stateFromRow(latest.state_json) });
      return true;
    }
    sendJson(response, 200, { tenantKey: accessRoute.tenantKey, role: auth.access.role, revision: expectedRevision + 1 });
    return true;
  }

  if (requestUrl.pathname === '/api/tenants' && request.method === 'POST') {
    if (!databaseConfigured) {
      sendJson(response, 503, { error: 'database-not-configured', message: 'Collega Supabase all’app Node.js da Hostinger.' });
      return true;
    }
    const body = await readJsonBody(request);
    const tenantKey = String(body.tenantKey || '').trim().toLowerCase();
    const secret = String(body.secret || '');
    const state = body.state;
    if (!/^[a-z0-9-]{1,80}$/.test(tenantKey) || secret.length < 24 || !state || typeof state !== 'object') {
      sendJson(response, 400, { error: 'invalid-tenant', message: 'Identificativo, chiave o configurazione non validi.' });
      return true;
    }
    const supabase = getSupabase(secret);
    const existing = await readTenant(supabase, tenantKey, 'secret_hash,revision');
    if (existing) {
      const auth=await authenticatedTenant(request,response,tenantKey);
      if(!auth) return true;
      if (!auth.accountManaged && existing.secret_hash !== hashSecret(secret)) {
        sendJson(response, 403, { error: 'forbidden' });
        return true;
      }
      sendJson(response, 200, { tenantKey, revision: Number(existing.revision), created: false });
      return true;
    }
    const user=await organizerUser(request,response);
    if(!user) throw accountFailure('Crea e conferma l’account della società prima di iniziare la prova.',401,'account-required');
    const {data,error}=await supabase.rpc('scoreflow_create_trial',{p_owner:user.id,p_tenant:tenantKey,p_name:String(body.name || tenantKey).slice(0,160),p_hash:hashSecret(crypto.randomBytes(32).toString('hex')),p_state:state});
    if(error?.code==='23505') throw accountFailure('Identificativo società già utilizzato. Scegline un altro.',409);
    if(error) throw databaseError(error);
    sendJson(response,201,{...data,entitlements:await trialEntitlements(supabase,tenantKey),accountManaged:true});
    return true;
  }

  const tenantKey = tenantKeyFromPath(requestUrl.pathname);
  if (tenantKey && ['GET', 'PUT'].includes(request.method)) {
    if (!databaseConfigured) {
      sendJson(response, 503, { error: 'database-not-configured' });
      return true;
    }
    const auth=await authenticatedTenant(request,response,tenantKey);
    if(!auth) return true;
    const supabase=auth.supabase;
    const row=await readTenant(supabase,tenantKey);
    if(!row){sendJson(response,404,{error:'tenant-not-found'});return true;}
    if (request.method === 'GET') {
      sendJson(response, 200, { tenantKey, revision: Number(row.revision), updatedAt: row.updated_at, state: stateFromRow(row.state_json), entitlements: await trialEntitlements(supabase,tenantKey) });
      return true;
    }
    const body = await readJsonBody(request);
    const expectedRevision = Number(body.revision);
    if (!body.state || typeof body.state !== 'object' || !Number.isInteger(expectedRevision)) {
      sendJson(response, 400, { error: 'invalid-state' });
      return true;
    }
    for(const event of body.state.events||[])if(event.competitionRules?.profile==='custom'){
      const r=event.competitionRules;
      const errors=Regulations.validate({name:r.source,criteria:event.scoring?.criteria,criteriaMode:r.criteriaMode,aggregation:event.scoring?.aggregation,minimumJudges:event.scoring?.minimumJudges,penaltyMin:r.penaltyMin,penaltyMax:r.penaltyMax,disciplines:event.disciplines,categories:r.customCatalog,tieBreakIds:r.tieBreakIds});
      if(errors.length)throw accountFailure(errors.join(' '),400);
    }
    CompetitionRules.validateState(stateFromRow(row.state_json), body.state);
    const { data: updated, error: updateError } = await supabase
      .from(tenantTable)
      .update({ state_json: body.state, revision: expectedRevision + 1, updated_at: new Date().toISOString() })
      .eq('tenant_key', tenantKey)
      .eq('revision', expectedRevision)
      .select('revision')
      .maybeSingle();
    if (updateError) throw databaseError(updateError);
    if (!updated) {
      const latest = await readTenant(supabase, tenantKey, 'state_json,revision,updated_at');
      sendJson(response, 409, { error: 'revision-conflict', revision: Number(latest.revision), updatedAt: latest.updated_at, state: stateFromRow(latest.state_json) });
      return true;
    }
    sendJson(response, 200, { tenantKey, revision: expectedRevision + 1 });
    return true;
  }
  return false;
}

function resolvePublicFile(urlPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  if(decodedPath.split('/').includes('..')) return null;
  if (!['/', '/index.html', '/app.js', '/styles.css', '/display.html', '/esempio-partecipanti.csv', '/favicon.ico'].includes(decodedPath) && !/^\/(assets|scripts)\/[a-zA-Z0-9_./-]+$/.test(decodedPath)) return null;
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const requestedPath = path.resolve(publicRoot, relativePath);
  const relativeToRoot = path.relative(publicRoot, requestedPath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return requestedPath;
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  try {
    if (requestUrl.pathname.startsWith('/api/') && await handleApi(request, response, requestUrl)) return;
  } catch (error) {
    console.error('API error', error);
    if (!response.headersSent) {
      if(String(error.message || '').includes('scoreflow:')) {
        const code=String(error.message).match(/scoreflow:([a-z-]+)/)?.[1] || 'trial-limit';
        const messages={'trial-expired':'La prova è terminata. Puoi consultare ed esportare i dati.','limit-athletes':'La prova include al massimo 6 atleti complessivi tra roster e iscrizioni.','limit-categories':'La prova include al massimo 2 categorie.','limit-judges':'La prova include al massimo 3 giudici.','limit-events':'La prova include un solo evento.','event-immutable':'Mantieni lo stesso evento durante la prova.','feature-public-voting':'Il voto pubblico richiede una licenza completa.','organization-exists':'Questo account ha già una società. Accedi per riaprirla.'};
        sendJson(response,409,{error:code,message:messages[code] || 'Operazione oltre i limiti della prova.'});return;
      }
      sendJson(
        response,
        error.statusCode || 500,
        error.payload || { error: 'server-error', message: error.statusCode ? error.message : 'Errore interno.' }
      );
    }
    return;
  }

  if (requestUrl.pathname === '/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'scoreflow',
      version: '3.4.0',
      email: databaseConfigured && managedEmailReady(), emailMode: 'managed-or-custom'
    });
    return;
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  const filePath = resolvePublicFile(requestUrl.pathname);
  if (!filePath) {
    response.writeHead(400);
    response.end('Bad Request');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Pagina non trovata');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Cache-Control': ['.html', '.css', '.js'].includes(extension) ? 'no-cache, must-revalidate' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!response.headersSent) response.writeHead(500);
      response.end('Errore interno');
    });
    stream.pipe(response);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`ScoreFlow disponibile sulla porta ${port}`);
  if (!databaseConfigured) console.log('Database ScoreFlow non configurato: modalità locale attiva.');
});

