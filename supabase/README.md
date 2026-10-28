# Base de datos — Supabase (proyecto "DGP Academy", ref `qiwqrnsedzfluvllryka`)

## Tablas (esquema `public`)

| Tabla | Para qué | Quién puede |
|---|---|---|
| `profiles` | Un perfil por usuario (se crea solo al registrarse): correo, nombre, teléfono, `is_admin` | El estudiante lee su perfil y edita solo nombre y teléfono. El admin ve todos. |
| `products` | Programas y libros: `web-dev`, `7st`, `semilla`, `ia`, `marketing` | Lectura pública. |
| `access` | Acceso (`active`) y pago (`paid`) de cada usuario a cada producto | El estudiante solo lee lo suyo. **Solo el admin** crea/edita. |
| `progress` | Lecciones completadas y capítulos leídos | El estudiante registra lo suyo **solo si tiene acceso**. |
| `reading_state` | Último capítulo leído y nota de la evaluación | El estudiante guarda su posición; la nota solo la escribe `submit_quiz()`. |
| `certificates` | Certificados emitidos con número único | Solo los emite `issue_certificate()` tras validar que terminó. |
| `content` | HTML de las 17 lecciones y de los capítulos de los dos libros | **Solo usuarios con acceso activo** a ese producto (o admin). |
| `settings` | `cupos` de la landing | Lectura pública, edición solo admin. |

`private.quiz_keys` guarda las respuestas correctas de la evaluación de 7ST (no es accesible por la API).

## Funciones (RPC)

- `submit_quiz(p, answers)` — califica la evaluación en el servidor (aprueba con 7/10).
- `issue_certificate(p)` — emite el certificado si completó las 16 lecciones o aprobó la evaluación.
- `verify_certificate(num)` — verificación pública de un certificado (nombre, programa, fecha).
- `admin_students()` — listado para el panel admin (solo admins).
- `touch_last_seen()` — registra la última visita.

## Nombrar administrador

Después de que la persona cree su cuenta en la academia, en el SQL Editor de Supabase:

```sql
update public.profiles set is_admin = true where email = 'correo@del-admin.com';
```
