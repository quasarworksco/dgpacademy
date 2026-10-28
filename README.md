# DGP Academy

Plataforma educativa de DGP Global Group — [academy.dgp-link.com](https://academy.dgp-link.com).

Sitio estático (GitHub Pages) con Firebase Authentication + Firestore. Sin build: se publica tal cual.

## Estructura

```
index.html            Todas las pantallas: landing, acceso, panel, curso, libros, admin, modales
assets/css/base.css   Sistema de diseño: tokens, tipografías, botones, formularios
assets/css/app.css    Landing, acceso, panel, admin, modales y certificado (incluye impresión)
assets/css/course.css Lector del curso (lecciones, tarjetas, código, quizzes)
assets/css/reader.css Lector de libros (7ST Vol. 1 y Vol. 2)
assets/js/app.js      Firebase, pantallas, accesos, panel, admin, cupos, cuenta
assets/js/course.js   Navegación del curso, progreso y configuración de la cuenta
assets/js/ui.js       Interacciones de la landing, avisos y certificados
assets/fonts/         Inter Tight, Instrument Serif y JetBrains Mono (alojadas aquí)
assets/img/           Fotografías (Unsplash, licencia libre) en WebP
firestore.rules       Reglas de seguridad de Firestore
og-image.jpg          Imagen para compartir en redes (1200×630)
```

## Oferta educativa actual

| Producto | Tipo | ID en Firestore | Estado |
|---|---|---|---|
| Diseño y Desarrollo Web con IA | Programa · 16 lecciones · 5 módulos | `courses: 'web-dev'` | Disponible ($97 lanzamiento / $147 regular) |
| 7ST Vol. 1 — Redes Sociales y Emprendimiento | Libro · 10 capítulos + evaluación | `books: '7st'` | Disponible (se activa por usuario) |
| De la Semilla al Árbol (7ST Vol. 2) | Libro · 11 capítulos + recursos | `books: 'semilla'` | Disponible (se activa por usuario) |
| IA aplicada a los negocios | Programa | — | Próximamente |
| Marketing digital | Programa | — | Próximamente |

## Registro y permisos

1. **Registro**: el estudiante crea su cuenta (nombre, apellido, teléfono, correo, contraseña segura).
   Se crea `users/{uid}` en Firestore, se avisa al equipo por Formspree y se envía bienvenida por EmailJS.
2. **Sin acceso**: el panel muestra "Tu cuenta está lista. Falta activar tu acceso" con botón para escribir
   al equipo (correo; WhatsApp si se configura `CONTACT.whatsapp` en `assets/js/app.js`).
3. **Activación**: el admin entra a *Panel admin* y activa `Web Dev`, `7ST` o `Semilla`, y marca el pago.
   Esto escribe `courses`, `books` y `payments` en el documento del estudiante.
4. **Progreso**: se guarda en `progress`, `completedLessons`, `completedCourses` y `bookProgress`.
5. **Certificados**: al completar las 16 lecciones (o aprobar la evaluación de 7ST con 7/10) se emite el
   certificado con número único; la fecha de emisión queda en `certificates.<programa>`.

El admin se identifica por `ADMIN_UID` en `assets/js/app.js` y en `firestore.rules`.

### Importante: publicar las reglas

`firestore.rules` impide que un estudiante se otorgue acceso a sí mismo (solo el admin puede cambiar
`courses`, `books` y `payments`). Publícalas en **Firebase Console → Firestore Database → Reglas**
pegando el contenido del archivo.

## Fotografías

Fotos de [Unsplash](https://unsplash.com/license) (uso libre, comercial incluido).
