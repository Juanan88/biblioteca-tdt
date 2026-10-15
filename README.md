# Biblioteca TDT

> **UX fase 1 completada (15/10/2026):** portada reducida a una bienvenida breve, sin segundo botón de navegación; los contadores de libros/disponibles/prestados se muestran compactos junto al título del catálogo, y la búsqueda, el filtro de disponibilidad, el cambio Tarjetas/Lista y las portadas quedan mucho más arriba, también en móvil. No se han tocado las acciones de donación, préstamo, devolución ni administración. Incluye tests de estructura responsive en `tests/ux.test.js`.

> **Donaciones con nombre (15/10/2026):** al donar se puede escribir opcionalmente **nombre o apodo del donante** (máximo 40 caracteres). Si queda vacío, la ficha mostrará **«Donado por Anónimo»**. Se ve en tarjetas, lista y detalle; en títulos con varios ejemplares se indican sus donantes. El nombre es visible para cualquiera que conozca el enlace, así que no escribas apellidos ni datos personales. Los libros antiguos reciben **«Anónimo»** mediante migración automática y no destructiva. El historial y las copias de seguridad también incluyen este campo. No hay servicios de pago nuevos.

> **Actualización de seguridad y UX (15/10/2026):**
> - Préstamos protegidos contra peticiones simultáneas; «Está en la estantería» solo puede recuperar libros en estado **Por comprobar**.
> - Retirar/restaurar un libro **no borra el alias ni la fecha de un préstamo activo**.
> - **Historial de versiones automático** en D1, con recuperación de datos bibliográficos para administración y sin conservar alias históricos. La migración es idempotente y se aplica en la primera escritura.
> - **Copia de seguridad JSON y recuperación no destructiva** de ejemplares ausentes desde Administración. Además, D1 Time Travel Free proporciona recuperación integral dentro de su ventana gratuita de **7 días**, según Cloudflare.
> - Autocompletado ISBN respetuoso con el texto escrito, portada principal/secundaria, edición de URL bibliográfica, validación de campos y errores cerca de los formularios.
> - Nueva suite `tests/api.test.js` con SQLite para préstamos en paralelo, cambio de estado, retirada, historial, backup/restauración y autenticación; GitHub Actions ejecuta las pruebas en cada commit.
>
> **Seguridad:** Los respaldos JSON incluyen nombres/alias de los préstamos **vigentes**. Descárgalos solo desde Administración y no los compartas. Consulta [BACKUPS.md](./BACKUPS.md).
>
> **Actualización catálogo (15/10/2026):** se han eliminado los filtros por edades/categorías y ahora queda **un único interruptor «Solo disponibles»**. Se puede alternar entre vista de **Tarjetas** y **Lista**; la preferencia se guarda en este navegador. Las fichas muestran la **portada real procedente de catálogos bibliográficos** cuando está disponible (primero `cover_url`, o por ISBN a través de Open Library); si no hay imagen, aparece una cubierta ilustrativa de sustitución. Los tres libros de demostración intentan mostrar sus portadas por ISBN, siguen siendo solo ejemplos visuales y **no se insertan en D1**.

> **Actualización UX (15/10/2026):** Se ha reducido a **un único botón «+ Donar un libro»** en la cabecera, eliminado los filtros duplicados y simplificado el formulario de donación. Mientras no existan libros reales, el catálogo muestra **tres libros de ejemplo señalados claramente como «EJEMPLO»**, con portadas ilustrativas creadas con CSS. No se guardan en D1 y desaparecen con el primer libro real. Consulta [AUDITORIA_UX.md](./AUDITORIA_UX.md).

Biblioteca vecinal colaborativa. **Sin registro de usuarios, sin QR individuales y con coste obligatorio de 0 €**. Proyecto completamente independiente de Hoy Toca Plan.

## Estado del proyecto · 15 octubre 2026

El usuario ha creado una base de datos Cloudflare D1 llamada `biblioteca-tdt`, ha ejecutado `schema.sql` y ha publicado un proyecto de **Cloudflare Pages** con URL comunicada: **https://biblioteca-tdt.pages.dev/**.

El código original fue adaptado a **Cloudflare Pages Functions** y la base D1 ya está vinculada. El usuario ha confirmado que el flujo principal funciona en la aplicación desplegada. **Las mejoras de historial, copia y revisión de estados de octubre de 2026 aún requieren confirmar el nuevo despliegue y la batería automatizada**; no asumir que un «Success» antiguo valida los cambios recientes.

## Servicios utilizados: coste 0 €

| Parte | Servicio |
|---|---|
| Repositorio | GitHub Free |
| Hosting web | Cloudflare Pages Free |
| API / backend | Cloudflare Pages Functions (cuota Workers Free) |
| Base de datos | Cloudflare D1 Free (SQLite) |
| Búsqueda por ISBN y portadas | Open Library (API pública) |
| URL | [biblioteca-tdt.pages.dev](https://biblioteca-tdt.pages.dev/) |

**Nunca activar un plan Paid ni un upgrade automático**. El funcionamiento depende de los límites y de las condiciones vigentes de los planes gratuitos: al agotarse un límite se prefiere un fallo temporal antes que un cargo. No son necesarios dominios, SMS, correos, IA de pago ni suscripciones.

## Funciones previstas para vecinos

- Catálogo responsive con título, autor, **portada real si existe**, categoría y disponibilidad; cubierta ilustrativa si no hay foto.
- Búsqueda por título/autor y un único filtro opcional **Solo disponibles**. Alternancia **Tarjetas / Lista**, con preferencia recordada en este navegador.
- Alta rápida por ISBN (incluyendo cámara si el navegador la admite) y alternativa por título. Nombre/apodo del donante opcional (Anónimo por defecto).
- Préstamo con nombre de pila/alias visible y fecha: «Me lo llevo».
- Devolución con un botón: «Lo he devuelto».
- Aviso de devolución recomendada tras 30 días, sin multas ni bloqueos.
- Corrección colaborativa con «No encuentro este libro» y «Está en la estantería».
- Edición abierta de fichas; retirada y restauración reservadas a administración.

Los duplicados legítimos del mismo título se pueden registrar como ejemplares independientes.

## Seguridad y privacidad

La web es accesible para cualquiera que conozca el enlace; `robots.txt` y `noindex` **no son autenticación**. Antes de registrar un préstamo se avisa de que el nombre o alias será visible en el catálogo. No solicitamos email, domicilio, número de vivienda ni apellidos.

El acceso administrativo usa dos secretos almacenados en **Cloudflare Pages → Settings → Variables and Secrets**, nunca en el repositorio ni en el navegador:

- `ADMIN_PASSWORD`: contraseña de al menos 16 caracteres.
- `ADMIN_SESSION_SECRET`: cadena diferente y aleatoria de al menos 32 caracteres.

Las operaciones administrativas se comprueban en el backend. Los préstamos emplean actualizaciones condicionadas para evitar dobles confirmaciones de un mismo ejemplar.

## Configuración del proyecto Pages

La cuenta Cloudflare, el proyecto Pages y la base D1 ya se han creado por el usuario. Para comprobar o completar el despliegue:

1. En **Cloudflare → Workers & Pages**, abre el proyecto de tipo **Pages** `biblioteca-tdt`.
2. Comprueba que GitHub está conectado al repositorio `Juanan88/biblioteca-tdt`, rama `main`, y que los últimos cambios generan un despliegue nuevo con estado Success.
3. La salida de archivos estáticos debe ser **`public`**. La configuración `wrangler.jsonc` ahora fija `pages_build_output_dir: "./public"`. No hay comando de compilación necesario.
4. La ruta `functions/api/[[path]].js` activa el backend con **Pages Functions**. La configuración `wrangler.jsonc` declara el binding D1 llamado **`DB`** con el identificador conocido.
5. Comprueba que los secretos `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET` estén en el entorno **Production**, de tipo Secret. Nunca copiarlos a GitHub ni compartirlos.
6. Abre [el endpoint de diagnóstico](https://biblioteca-tdt.pages.dev/api/health). La respuesta esperada, una vez configurado y desplegado, es JSON con `"ok":true` y `"configured":true`. Si devuelve HTML, 404 o 405, es probable que **Pages Functions no se haya publicado**; comprobar logs del último deploy y output `public`. Si devuelve 503, revisar binding DB. Si `configured:false`, revisar ambos secretos de Production.
7. Abre [la API de catálogo](https://biblioteca-tdt.pages.dev/api/books): en biblioteca nueva debería responder JSON `{"books":[]}`.
8. Cuando los pasos anteriores funcionen, probar alta, préstamo, devolución, discrepancias, login admin, retirada y restauración. **No compartir con los vecinos antes de verificar estos flujos.**

### Guías oficiales

- [Funciones de Pages y rutas](https://developers.cloudflare.com/pages/functions/routing/)
- [Configuración Wrangler de Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Bindings D1 para Pages](https://developers.cloudflare.com/pages/functions/bindings/)
- [Git integration de Pages](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Pricing de Pages](https://developers.cloudflare.com/pages/functions/pricing/)

## Desarrollo local (opcional)

```bash
npm install
cp .dev.vars.example .dev.vars
# Introducir secretos locales, nunca versionarlos
npm run db:local
npm run dev
npm test
npm run check
```

Para desplegar manualmente con el CLI desde una sesión autenticada (no obligatorio, ya hay Git integration): `npm run deploy`.

## Estructura

- `public/`: HTML, CSS y JavaScript de la web.
- `functions/api/[[path]].js`: entrada de Pages Functions a la API.
- `src/worker.js`: operaciones de servidor y permisos.
- `src/core.js`: validación y lógica pura.
- `schema.sql`: esquema de D1.
- `wrangler.jsonc`: configuración de Pages y binding de D1.
- `tests/core.test.js`, `tests/metadata.test.js`, `tests/ux.test.js`: pruebas unitarias y de interfaz.
- `tests/api.test.js`: pruebas de integración con SQLite en memoria, incluidos cambios simultáneos.
- `.github/workflows/test.yml`: ejecución automática de Node 24 en cada commit.
- `src/history.js` y `migrations/001_book_revisions.sql`: historial recuperable y migración no destructiva.
- `src/donor.js` y `migrations/002_donor.sql`: donante Anónimo por defecto para libros ya existentes, sin borrar datos; la migración se realiza automáticamente cuando llega la primera solicitud tras publicar.
- `BACKUPS.md`: guía de copias, restauración de datos y Time Travel en plan Free.
- `ESPECIFICACION.md`: ocho decisiones aprobadas por el usuario.
- `AGENTS.md`: instrucciones para seguir el desarrollo.

## Limitaciones pendientes de revisión

- No hay verificación remota efectiva desde ChatGPT del contenido de `pages.dev`; el despliegue debe comprobarse con `/api/health` y pruebas manuales.
- El ISBN no siempre permite recuperar todos los metadatos; cualquier dato faltante queda opcional.
- Las acciones anónimas se basan en confianza vecinal y pueden ser incorrectas; existe el estado «Por comprobar» para corregirlas.
- Es recomendable hacer pruebas de concurrencia y gestionar copias de seguridad antes de uso real.
- El repositorio se detectó como público: se recomienda cambiarlo a privado en GitHub, sin alterar la web pública.

## Solucionar «Falta configurar los secretos»

Si `/api/books` devuelve correctamente el catálogo pero las altas fallan con ese error, el enlace D1 funciona y falta ajustar la configuración de variables del backend.

1. Abre **Cloudflare Dashboard → Workers & Pages → biblioteca-tdt (proyecto Pages) → Settings → Variables and Secrets** y selecciona **Production**.
2. Crea o actualiza exactamente **`ADMIN_PASSWORD`** (mínimo 16 caracteres) y **`ADMIN_SESSION_SECRET`** (mínimo 32 caracteres), eligiendo **Secret / Encrypt**, sin espacios en los nombres. No copies valores al chat o GitHub.
3. Guarda los cambios. Comprueba en **Deployments** que se crea un despliegue **Production** nuevo *después* de haber guardado los secretos. Si no, inicia uno nuevo desde la interfaz de Pages.
4. Abre https://biblioteca-tdt.pages.dev/api/health y comprueba `"configured":true`. Si continúa `false`, revisa nombres y longitudes de secretos del entorno Production.

Guía oficial: https://developers.cloudflare.com/pages/functions/bindings/
