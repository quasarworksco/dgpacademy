# DGP Academy

Plataforma educativa de DGP Global Group — [academy.dgpglobalgroup.com](https://academy.dgpglobalgroup.com).

Sitio estático (GitHub Pages) con **Supabase** (autenticación + base de datos). Sin build: se publica tal cual.

## Estructura

```
index.html            Todas las pantallas: landing, acceso, panel, curso, libros, admin, modales
assets/css/base.css   Sistema de diseño: tokens, tipografías, botones, formularios
assets/css/app.css    Landing, acceso, panel, admin, modales y certificado (incluye impresión)
assets/css/course.css Lector del curso (lecciones, tarjetas, código, quizzes)
assets/css/reader.css Lector de libros (7ST Vol. 1 y Vol. 2)
assets/js/i18n.js     Idiomas ES/EN: selector y traducción automática de la interfaz
assets/js/i18n-en.js  Diccionario de la interfaz al inglés
assets/js/data.js     Conexión con Supabase y estado del usuario
assets/js/app.js      Pantallas, acceso, panel, libros, evaluación, admin, cupos
assets/js/course.js   Navegación del curso, progreso y configuración de la cuenta
assets/js/ui.js       Landing, avisos, certificados y verificación pública
assets/fonts/         Inter Tight, Instrument Serif y JetBrains Mono (alojadas aquí)
assets/img/           Fotografías (Unsplash, licencia libre) en WebP
supabase/README.md    Tablas, seguridad y funciones de la base de datos
og-image.jpg          Imagen para compartir en redes (1200×630)
```

## Oferta educativa actual

| Producto | Tipo | ID | Estado |
|---|---|---|---|
| Diseño y Desarrollo Web con IA | Programa · 16 lecciones · 5 módulos | `web-dev` | Disponible ($97 lanzamiento / $147 regular) |
| 7ST Vol. 1 — Redes Sociales y Emprendimiento | Libro · 10 capítulos + evaluación | `7st` | Disponible |
| De la Semilla al Árbol (7ST Vol. 2) | Libro · 11 capítulos + recursos | `semilla` | Disponible |
| IA aplicada a los negocios | Programa | `ia` | Próximamente |
| Marketing digital | Programa | `marketing` | Próximamente |

El contenido de las lecciones y los libros vive en la tabla `content` de Supabase (una versión por idioma,
columna `lang`) y solo se descarga para usuarios con acceso activo. No está en el código público del sitio.

## Idiomas

Todo el sitio está en español e inglés (selector ES / EN en cada pantalla). El idioma se detecta del navegador,
se recuerda en el dispositivo y se guarda en el perfil del estudiante (`profiles.lang`).
Para traducir un texto nuevo de la interfaz, agrega la línea en `assets/js/i18n-en.js`.

## Registro y permisos

1. **Registro**: el estudiante crea su cuenta y confirma su correo (los correos salen de info@dgpglobalgroup.com
   vía SMTP de Google Workspace). Se crea su perfil automáticamente y aparece en el panel admin.
2. **Sin acceso**: el panel muestra "Tu cuenta está lista. Falta activar tu acceso" con botón para escribir
   al equipo (correo; WhatsApp si se configura `CONTACT.whatsapp` en `assets/js/app.js`).
3. **Activación**: el admin entra a *Panel admin* y activa `Web Dev`, `7ST` o `Semilla`, y marca el pago.
4. **Progreso**: lecciones y capítulos se guardan en la tabla `progress`; la posición de lectura en `reading_state`.
5. **Evaluación 7ST**: se califica en el servidor (las respuestas no están en el navegador). Aprueba con 7/10.
6. **Certificados**: los emite el servidor solo si el estudiante completó las 16 lecciones o aprobó la evaluación.
   Cada uno tiene un número único verificable en la landing ("Verificar un certificado" o `?verificar=NÚMERO`).

La seguridad está en la base de datos (políticas RLS): un estudiante no puede darse acceso, hacerse admin,
aprobar la evaluación a mano ni leer contenido que no tiene activado. Detalle en `supabase/README.md`.

### Administrador

info@dgpglobalgroup.com es administrador permanente (la base de datos lo asigna al crear la cuenta).
Para nombrar a otra persona, que cree su cuenta y luego, en Supabase → SQL Editor:

```sql
update public.profiles set is_admin = true where email = 'correo@del-admin.com';
```

### Configuración en Supabase

- Authentication → URL Configuration: Site URL `https://academy.dgpglobalgroup.com` y Redirect URL `https://academy.dgpglobalgroup.com/**`.
- Authentication → Emails → SMTP: `smtp.gmail.com:587` con info@dgpglobalgroup.com y contraseña de aplicación.

## Fotografías

Fotos de [Unsplash](https://unsplash.com/license) (uso libre, comercial incluido).
