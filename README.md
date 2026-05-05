<![CDATA[
# E2 — Formulario + BBDD cloud (Supabase)

Aplicación web **HTML + CSS (BEM) + JavaScript vanilla** con:

- Formulario con validación en tiempo real y errores por campo
- Botón **Enviar** deshabilitado si el formulario es inválido o se está enviando
- Envío a **Supabase** con estado “Enviando…” y bloqueo anti doble envío
- Mensajes de éxito/error en UI (sin `alert()`)
- Reintento manual del **último envío fallido**, reutilizando el mismo `client_request_id`
- Listado “Mis solicitudes” filtrado por el **email actual**, ordenado por `created_at` desc
- Anti-duplicados mediante `client_request_id` con **unique constraint** en BBDD

---

## 1) Estructura del proyecto

- `index.html` — UI (semántica + accesible)
- `styles.css` — estilos con BEM y responsive básico
- `app.js` — lógica: validación, UI, Supabase, listado, reintento
- `README.md` — guía + SQL

---

> Importante: no necesitas instalar nada; se usa el SDK por CDN en `index.html`.

---

## 2) Flujo de demo (2–3 min)

1. Introduce datos inválidos → ver errores por campo y botón deshabilitado
2. Completa todo válido → botón se habilita
3. Enviar → botón cambia a “Enviando…”, no permite doble envío
4. Éxito → mensaje en UI + listado se actualiza (filtrado por email)
5. Simula fallo (p. ej. corta internet o policies) → aparece “Reintentar envío”
6. Reintentar → reenvía **exacto** el mismo payload (mismo `client_request_id`)

---
]]>
