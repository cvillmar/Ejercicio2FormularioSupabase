# E2 — Formulario + BBDD cloud (Supabase)

**Aplicación web HTML + CSS (BEM) + JavaScript vanilla** con formulario validado, persistencia en Supabase, anti-duplicados y reintento manual.

---

## Objetivo

Construir una aplicación funcional que permita:

- Rellenar un formulario con validación en tiempo real
- Enviar solicitudes a una base de datos cloud (Supabase)
- Visualizar un listado filtrado de "mis solicitudes"
- Reintentar envíos fallidos sin duplicar registros

---

## Características

### Formulario

- Campos: **título**, **descripción**, **categoría**, **prioridad (1–5)**, **email**
- Validaciones en tiempo real:
  - Título: 5–60 caracteres
  - Descripción: 20–500 caracteres
  - Categoría: obligatoria
  - Prioridad: número entero entre 1 y 5
  - Email: formato válido
- Botón **Enviar** deshabilitado si el formulario es inválido o se está enviando
- Errores visibles por campo
- Sin `alert()`: mensajes en la interfaz

### Envío y Persistencia

- Envío a Supabase con estado **"Enviando..."**
- Bloqueo anti doble envío (el formulario se desactiva durante el envío)
- Confirmación de éxito o error claro
- Si falla por red o permisos, se ofrece **"Reintentar envío"**
- El reintento reutiliza **exactamente** el mismo payload (no regenera el ID)

### Listado ("Mis solicitudes")

- Se actualiza automáticamente después de un envío exitoso
- Filtrado por el email actual (solo si es válido)
- Ordenado por fecha descendente
- Muestra estado vacío si no hay resultados

### Anti-duplicados

- Se genera un `client_request_id` único por cada intento (UUID)
- Se persiste en Supabase con una restricción **unique**
- Al reintentar un envío fallido, reutiliza el mismo ID
- Supabase rechaza automáticamente inserts duplicados

---

## Estructura

```
E2FormularioSupabase/
├── index.html       (marcado semántico + accesible)
├── css/
│   └── styles.css   (diseño con BEM + responsive)
├── js/
│   └── app.js       (lógica vanilla)
├── README.md        (este archivo)
└── keys.txt         (configuración local)
```

### Sin dependencias externas

- No usa frameworks (React, Vue, Angular)
- No usa librerías CSS (Tailwind, Bootstrap)
- No usa jQuery ni librerías innecesarias
- Supabase se carga por CDN

---

## Flujo Técnico

```
Usuario rellena → Validación en tiempo real
   ↓
Envía → Bloqueo UI + "Enviando..."
   ↓
Genera client_request_id + construye payload
   ↓
POST a Supabase → insert en tabla solicitudes
   ↓
   ├─ Éxito → limpia error, refrescar listado, limpia campos (menos email)
   └─ Fallo → guarda payload exacto, muestra "Reintentar"
       ↓
       Usuario clickea "Reintentar"
       ↓
       Reenvía **mismo payload** (mismo client_request_id)
       ↓
       Si Supabase rechaza por unique: muestra error didáctico
       Si Supabase acepta: éxito normal
```

---

## Puntos Clave del Código

### Validación (`validate()`)

Función pura que retorna un objeto `{ campo: "mensaje de error" }` si hay problemas, o `{}` si es válido.

### Flujo de Envío (`submitPayload()`)

1. Valida el payload de nuevo antes de enviar
2. Bloquea UI con `setSubmitting(true)`
3. Intenta `insertSolicitud()`
4. Si éxito: limpia estado, refrescar listado
5. Si fallo: guarda payload exacto para reintento

### Reintento (`attachRetry()`)

Reutiliza el payload guardado sin regenerar `client_request_id`. Si Supabase rechaza por duplicado, el error dice "Solicitud duplicada" en lugar de un mensaje genérico.

### Listado (`loadAndRenderList()`)

- Valida que el email sea correcto
- Fetch a Supabase con `.eq("email", email).order("created_at", {ascending: false})`
- Renderiza con sanitización HTML (`escapeHtml()`)
- Maneja errores sin bloquear el formulario

### localStorage para Reintento

Si el navegador no tiene acceso a `localStorage` (navegación privada, etc.), el reintento se ofrece solo durante la sesión actual.

---

## Estructura CSS (BEM)

- **Bloques**: `.page`, `.header`, `.main`, `.card`, `.form`, `.button`, etc.
- **Elementos**: `.header__title`, `.form__control`, `.button--primary`, etc.
- **Modificadores**: `.button--hidden`, `.form__control--invalid`, `.notice--error`, etc.

Especificidad máxima: 0–1–2 (sin IDEs en selectores, sin `!important`).

---

## Accesibilidad

- Labels asociados correctamente con `for` y `id`
- `aria-describedby` en inputs para conectar con ayuda y errores
- `role="alert"` en los divs de error
- `aria-live="polite"` en la zona de mensajes y el listado
- `skip-link` para saltar al contenido principal
- Colores con suficiente contraste

---

## Navegadores Soportados

- **Chrome/Edge 90+**
- **Firefox 88+**
- **Safari 14+**
- Requiere JavaScript habilitado (no hay fallback sin JS)

---

## Cómo Extender

### Añadir más campos

1. Añade input/select en HTML
2. Agrega validación en `validate()`
3. Añade al mapeo en `buildInsertPayloadFromForm()`
4. Actualiza el SELECT y el renderizado del listado

### Cambiar estilos

- Los tokens CSS están en `:root` (variables)
- Las clases BEM no tienen dependencias entre sí
- Cambiar colores es seguro, mantiene especificidad

### Usar autenticación real

- Reemplaza el filtro por email con `auth.user().id`
- Genera `client_request_id` en backend (RPC o trigger)
- Actualiza policies para que solo accedan a sus propias solicitudes

---

## Preguntas Frecuentes

**¿Qué pasa si Supabase cae?**
→ Ves error claro, puedes reintentar cuando vuelva.

**¿Qué pasa si pierdo la conexión a mitad de envío?**
→ El payload se guarda en localStorage, ofrece reintento.

**¿Por qué no valida el email más estrictamente?**
→ La regex actual es suficiente para demo; en producción, usa validación en backend.

**¿Puedo duplicar una solicitud?**
→ No, `client_request_id` es unique. Si lo intentas, Supabase rechaza con error didáctico.

**¿El email es privado?**
→ No; cualquiera que conozca tu email puede ver tus solicitudes. En producción, usa autenticación real.

---

## Licencia

Proyecto de práctica académica. Sin licencia formal.
