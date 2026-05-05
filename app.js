/* =========================================================
   E2 — Formulario + Supabase (vanilla)
   - Validación en tiempo real
   - Envío con estado "Enviando..." + anti doble envío
   - Persistencia en Supabase
   - Reintento manual del último envío fallido
   - Listado filtrado por email (desc por fecha)
   - Anti-duplicados con client_request_id (frontend + unique en BBDD)
   ========================================================= */

/**
 * Placeholders (sustituir por tus valores reales):
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 */
const SUPABASE_URL = "https://dzpgsrjwmqarungktypo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ih1FMr61w05oQG_bHeNbgQ_Q80xd0Hv";

/** Tabla a usar en Supabase */
const TABLE = "solicitudes";

/** LocalStorage key para persistir el último intento fallido */
const LS_LAST_FAILED = "e2_last_failed_payload_v1";

const dom = {
  form: document.getElementById("requestForm"),
  connBadge: document.getElementById("connBadge"),

  title: document.getElementById("title"),
  description: document.getElementById("description"),
  category: document.getElementById("category"),
  priority: document.getElementById("priority"),
  email: document.getElementById("email"),

  titleError: document.getElementById("titleError"),
  descError: document.getElementById("descError"),
  catError: document.getElementById("catError"),
  prioError: document.getElementById("prioError"),
  emailError: document.getElementById("emailError"),

  submitBtn: document.getElementById("submitBtn"),
  retryBtn: document.getElementById("retryBtn"),

  formNotice: document.getElementById("formNotice"),

  list: document.getElementById("requestsList"),
  listEmpty: document.getElementById("listEmpty"),
};

const state = {
  isSubmitting: false,
  supabase: null,
  lastFailedPayload: null, // { ...payload }
};

/* =========================================================
   Helpers UI
   ========================================================= */
function setConnBadge(status, text) {
  dom.connBadge.textContent = text;
  dom.connBadge.classList.remove("pill--neutral", "pill--ok", "pill--bad");
  dom.connBadge.classList.add(status);
}

function showNotice(type, message) {
  dom.formNotice.classList.remove(
    "notice--hidden",
    "notice--success",
    "notice--error",
  );
  dom.formNotice.classList.add(type);
  dom.formNotice.textContent = message;
}

function hideNotice() {
  dom.formNotice.classList.add("notice--hidden");
  dom.formNotice.textContent = "";
  dom.formNotice.classList.remove("notice--success", "notice--error");
}

function setRetryVisible(visible) {
  dom.retryBtn.classList.toggle("button--hidden", !visible);
}

function setFieldError(inputEl, errorEl, message) {
  if (message) {
    errorEl.textContent = message;
    inputEl.classList.add("form__control--invalid");
    inputEl.setAttribute("aria-invalid", "true");
  } else {
    errorEl.textContent = "";
    inputEl.classList.remove("form__control--invalid");
    inputEl.removeAttribute("aria-invalid");
  }
}

function setSubmitting(isSubmitting) {
  state.isSubmitting = isSubmitting;
  dom.submitBtn.disabled = isSubmitting || !isFormValid(getFormValues());
  dom.form.querySelectorAll("input, textarea, select, button").forEach((el) => {
    if (el === dom.retryBtn) return; // el reintento lo controlamos aparte
    if (el === dom.submitBtn) return;
    el.disabled = isSubmitting;
  });

  if (isSubmitting) {
    dom.submitBtn.textContent = "Enviando...";
  } else {
    dom.submitBtn.textContent = "Enviar solicitud";
  }
}

/* =========================================================
   Validación
   ========================================================= */
function normalizeText(value) {
  return String(value ?? "").trim();
}

function isValidEmail(value) {
  const v = normalizeText(value);
  // regex simple (suficiente para demo)
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v);
}

function validate(values) {
  const errors = {};

  const title = normalizeText(values.title);
  if (title.length < 5 || title.length > 60) {
    errors.title = "El título debe tener entre 5 y 60 caracteres.";
  }

  const description = normalizeText(values.description);
  if (description.length < 20 || description.length > 500) {
    errors.description = "La descripción debe tener entre 20 y 500 caracteres.";
  }

  const category = normalizeText(values.category);
  if (!category) {
    errors.category = "Selecciona una categoría.";
  }

  const priorityRaw = normalizeText(values.priority);
  const priorityNum = Number(priorityRaw);
  if (!Number.isInteger(priorityNum) || priorityNum < 1 || priorityNum > 5) {
    errors.priority = "La prioridad debe ser un número entero entre 1 y 5.";
  }

  const email = normalizeText(values.email);
  if (!isValidEmail(email)) {
    errors.email = "Introduce un email válido.";
  }

  return errors;
}

function isFormValid(values) {
  return Object.keys(validate(values)).length === 0;
}

function renderErrors(errors) {
  setFieldError(dom.title, dom.titleError, errors.title);
  setFieldError(dom.description, dom.descError, errors.description);
  setFieldError(dom.category, dom.catError, errors.category);
  setFieldError(dom.priority, dom.prioError, errors.priority);
  setFieldError(dom.email, dom.emailError, errors.email);
}

function clearErrors() {
  renderErrors({});
}

function getFormValues() {
  return {
    title: dom.title.value,
    description: dom.description.value,
    category: dom.category.value,
    priority: dom.priority.value,
    email: dom.email.value,
  };
}

function updateSubmitState() {
  const values = getFormValues();
  dom.submitBtn.disabled = state.isSubmitting || !isFormValid(values);
}

/* =========================================================
   client_request_id
   ========================================================= */
function generateClientRequestId() {
  // Preferir crypto.randomUUID si existe (moderno)
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  // Fallback razonable para demo
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/* =========================================================
   Persistencia local de fallo (reintento)
   ========================================================= */
function loadLastFailedFromStorage() {
  try {
    const raw = localStorage.getItem(LS_LAST_FAILED);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLastFailedToStorage(payload) {
  try {
    localStorage.setItem(LS_LAST_FAILED, JSON.stringify(payload));
  } catch {
    // Si el navegador bloquea storage, seguimos sin reintento persistente.
  }
}

function clearLastFailedStorage() {
  try {
    localStorage.removeItem(LS_LAST_FAILED);
  } catch {
    // Mantenemos el flujo principal aunque el storage no esté disponible.
  }
}

/* =========================================================
   Supabase
   ========================================================= */
function initSupabase() {
  if (!window.supabase) {
    setConnBadge("pill--bad", "Supabase: SDK no cargado");
    return null;
  }

  if (
    SUPABASE_URL === "SUPABASE_URL" ||
    SUPABASE_ANON_KEY === "SUPABASE_ANON_KEY"
  ) {
    setConnBadge("pill--bad", "Supabase: configura URL/KEY");
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); // permite demo local (fallará si no se cambia)
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  setConnBadge("pill--ok", "Supabase: configurado");
  return client;
}

function isLikelyNetworkError(error) {
  const msg = String(error?.message ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("fetch")
  );
}

function formatSupabaseError(error) {
  const msg = String(error?.message ?? "Error desconocido.");

  // Mensaje didáctico para duplicados (unique client_request_id)
  if (
    msg.toLowerCase().includes("duplicate") ||
    msg.toLowerCase().includes("unique")
  ) {
    return "Solicitud duplicada: este envío ya fue registrado (client_request_id unique).";
  }

  // Permisos/RLS
  if (
    msg.toLowerCase().includes("permission") ||
    msg.toLowerCase().includes("not allowed") ||
    msg.includes("42501")
  ) {
    return "Permisos insuficientes (RLS/Policies). Revisa las policies de Supabase.";
  }

  if (isLikelyNetworkError(error)) {
    return "Error de red: no se pudo contactar con Supabase. Comprueba tu conexión y vuelve a intentar.";
  }

  return msg;
}

async function insertSolicitud(payload) {
  const { data, error } = await state.supabase
    .from(TABLE)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function fetchSolicitudesByEmail(email) {
  const { data, error } = await state.supabase
    .from(TABLE)
    .select(
      "id, titulo, descripcion, categoria, prioridad, email, client_request_id, created_at",
    )
    .eq("email", email)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/* =========================================================
   Listado (render)
   ========================================================= */
function formatDate(iso) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderList(items, email) {
  // limpiar lista (manteniendo empty en DOM para reusarlo)
  dom.list.querySelectorAll(".item").forEach((el) => el.remove());

  if (!email || !isValidEmail(email)) {
    dom.listEmpty.textContent =
      "Introduce un email válido para ver tus solicitudes.";
    dom.listEmpty.style.display = "block";
    return;
  }

  if (!items || items.length === 0) {
    dom.listEmpty.textContent = "No hay solicitudes todavía para este email.";
    dom.listEmpty.style.display = "block";
    return;
  }

  dom.listEmpty.style.display = "none";

  const frag = document.createDocumentFragment();

  for (const it of items) {
    const el = document.createElement("article");
    el.className = "item";
    el.innerHTML = `
      <div class="item__head">
        <h3 class="item__title">${escapeHtml(it.titulo)}</h3>
        <p class="item__meta">${escapeHtml(formatDate(it.created_at))}</p>
      </div>
      <p class="item__desc">${escapeHtml(it.descripcion)}</p>
      <div class="item__badges" aria-label="Metadatos de la solicitud">
        <span class="badge badge--cat">Categoría: ${escapeHtml(it.categoria)}</span>
        <span class="badge badge--prio">Prioridad: ${escapeHtml(it.prioridad)}</span>
      </div>
    `;
    frag.appendChild(el);
  }

  dom.list.appendChild(frag);
}

async function loadAndRenderList({ silentError = false } = {}) {
  const email = normalizeText(dom.email.value);
  if (!isValidEmail(email) || !state.supabase) {
    renderList([], email);
    return;
  }

  try {
    const items = await fetchSolicitudesByEmail(email);
    renderList(items, email);
  } catch (err) {
    renderList([], email);
    if (!silentError) {
      showNotice(
        "notice--error",
        `No se pudo cargar el listado. ${formatSupabaseError(err)}`,
      );
    }
  }
}

/* =========================================================
   Envío / Reintento
   ========================================================= */
function buildInsertPayloadFromForm() {
  const values = getFormValues();
  return {
    titulo: normalizeText(values.title),
    descripcion: normalizeText(values.description),
    categoria: normalizeText(values.category),
    prioridad: Number(normalizeText(values.priority)),
    email: normalizeText(values.email).toLowerCase(),
    client_request_id: generateClientRequestId(),
  };
}

async function submitPayload(payload, { isRetry }) {
  // Validar de nuevo antes de enviar (incluye email)
  const errors2 = validate({
    title: payload.titulo,
    description: payload.descripcion,
    category: payload.categoria,
    priority: String(payload.prioridad),
    email: payload.email,
  });

  if (Object.keys(errors2).length > 0) {
    renderErrors(errors2);
    showNotice("notice--error", "Revisa los campos marcados antes de enviar.");
    return;
  }

  setSubmitting(true);
  hideNotice();

  try {
    await insertSolicitud(payload);
    showNotice(
      "notice--success",
      isRetry
        ? "Reintento completado: solicitud guardada."
        : "Solicitud enviada correctamente.",
    );

    // limpiar estado de fallo
    state.lastFailedPayload = null;
    clearLastFailedStorage();
    setRetryVisible(false);

    try {
      await loadAndRenderList({ silentError: true });
    } catch {
      // Mantenemos el mensaje de éxito del envío aunque el listado falle.
    }

    // dejar formulario en estado razonable: limpiar excepto email
    dom.title.value = "";
    dom.description.value = "";
    dom.category.value = "";
    dom.priority.value = "";
    clearErrors();
    updateSubmitState();
  } catch (err) {
    const msg = formatSupabaseError(err);
    showNotice("notice--error", `No se pudo enviar. ${msg}`);

    // guardar payload exacto para reintento (sin regenerar client_request_id)
    state.lastFailedPayload = payload;
    saveLastFailedToStorage(payload);
    setRetryVisible(true);
  } finally {
    setSubmitting(false);
    updateSubmitState();
  }
}

/* =========================================================
   Wiring (eventos)
   ========================================================= */
function attachRealtimeValidation() {
  const validateHandler = () => {
    const values = getFormValues();
    const errors = validate(values);
    renderErrors(errors);
    updateSubmitState();
  };

  const emailHandler = () => {
    validateHandler();
    scheduleEmailListLoad();
  };

  dom.title.addEventListener("input", validateHandler);
  dom.description.addEventListener("input", validateHandler);
  dom.category.addEventListener("change", validateHandler);
  dom.priority.addEventListener("input", validateHandler);
  dom.email.addEventListener("input", emailHandler);
  dom.email.addEventListener("change", emailHandler);
}

let emailDebounceTimer = null;
function scheduleEmailListLoad() {
  if (emailDebounceTimer) window.clearTimeout(emailDebounceTimer);
  emailDebounceTimer = window.setTimeout(() => {
    loadAndRenderList();
  }, 350);
}

function attachSubmit() {
  dom.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.isSubmitting) return;

    const values = getFormValues();
    const errors = validate(values);
    renderErrors(errors);
    updateSubmitState();

    if (Object.keys(errors).length > 0) {
      showNotice(
        "notice--error",
        "Formulario inválido. Corrige los errores para enviar.",
      );
      return;
    }

    const payload = buildInsertPayloadFromForm();
    await submitPayload(payload, { isRetry: false });
  });
}

function attachRetry() {
  dom.retryBtn.addEventListener("click", async () => {
    if (state.isSubmitting) return;
    if (!state.lastFailedPayload) return;

    // Reintenta EXACTAMENTE el último payload fallido (mismo client_request_id)
    await submitPayload(state.lastFailedPayload, { isRetry: true });
  });
}

/* =========================================================
   Init
   ========================================================= */
function restoreRetryState() {
  const saved = loadLastFailedFromStorage();
  if (saved) {
    state.lastFailedPayload = saved;
    setRetryVisible(true);
    showNotice(
      "notice--error",
      "Hay un envío anterior pendiente (falló). Puedes reintentarlo con el botón “Reintentar envío”.",
    );
  } else {
    setRetryVisible(false);
  }
}

function initialRender() {
  hideNotice();
  clearErrors();
  updateSubmitState();
  renderList([], normalizeText(dom.email.value));
}

function boot() {
  state.supabase = initSupabase();
  initialRender();
  restoreRetryState();

  attachRealtimeValidation();
  attachSubmit();
  attachRetry();

  // Si hay email válido en el formulario (por autocompletado) carga lista
  scheduleEmailListLoad();
}

boot();
