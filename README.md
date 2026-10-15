# Biblioteca TDT

Biblioteca vecinal colaborativa. **Sin registro de usuarios, sin códigos QR por libro y con presupuesto obligatorio de 0 €.**

Proyecto completamente independiente de Hoy Toca Plan.

## Estado de implementación (octubre de 2026)
El repositorio **ya contiene una primera versión programada**: web responsive, API y base de datos D1, donaciones, préstamos, devoluciones, corrección colaborativa de disponibilidad y administración protegida en servidor. **Aún no está desplegada**: hay que crear la base de datos y enlazar GitHub con Cloudflare. No afirmamos que se haya probado de extremo a extremo en Cloudflare hasta completar el despliegue.

## Coste: 0 € (plan Free, sin tarjeta)

| Componente | Solución gratuita |
| --- | --- |
| Repositorio y versiones | GitHub Free |
| Web y backend | Cloudflare Workers Free + Static Assets |
| Base de datos | Cloudflare D1 Free (SQLite) |
| Portadas y fichas por ISBN | Open Library (sin clave de pago) |
| URL pública | Subdominio gratuito de workers.dev |
| Contraseña de administración | Secretos de Cloudflare, sin proveedor externo |

Cloudflare Workers Free incluye un límite diario de solicitudes y D1 Free tiene límites de operaciones y almacenamiento. **No configurar ningún plan Paid**. Al alcanzar los límites gratuitos puede haber fallos temporales, pero no se prevé una factura. Los proveedores pueden revisar precios y límites en el futuro. La web evita servicios de pago, dominios propios, correos/SMS y APIs de IA facturables.

Fuentes oficiales: https://developers.cloudflare.com/workers/platform/pricing/ · https://developers.cloudflare.com/d1/platform/pricing/ · https://developers.cloudflare.com/workers/static-assets/

## Qué pueden hacer los vecinos
1. Consultar el catálogo con portada, título, autor, categoría, edades y estado si se conoce.
2. Buscar y filtrar por disponibilidad y público.
3. **Donar:** escribir/escanear un ISBN o escribir el título, completar solo lo necesario y confirmar que el libro está físicamente en la biblioteca.
4. **Me lo llevo:** introducir nombre de pila o alias (visible para cualquiera con el enlace) y confirmar.
5. **Lo he devuelto:** un solo botón, sin contraseñas.
6. **No encuentro este libro** / **Está en la estantería:** correcciones colaborativas.
7. Corregir los datos de una ficha.

La devolución se recomienda tras **30 días**, sin sanciones, bloqueos ni devolución automática. Varios ejemplares del mismo libro son compatibles (cada ejemplar ocupa un registro interno, sin etiquetas físicas).

## Administración
Solo los responsables saben la contraseña única, almacenada como **secreto en Cloudflare**, nunca en código ni en GitHub. La sesión utiliza una cookie HttpOnly, Secure, SameSite=Strict, firmada con HMAC. El servidor comprueba permisos al retirar y restaurar un libro. Existe un historial mínimo de acciones sin guardar nombres históricos.

No es una web de acceso privado: conocer el enlace permite ver catálogo y alias de prestatarios. Robots/noindex evitan promover indexación, **pero no protegen el acceso**. Pedir solo un alias opcionalmente distinto del nombre real, informar antes del préstamo y no recoger apellidos, teléfonos, dirección o vivienda.

## Publicar desde el navegador sin instalar Codex

**Son tareas de configuración necesarias por el titular de la cuenta.** No hay que instalar Codex. Tampoco hace falta comprar un dominio.

1. Entra en https://dash.cloudflare.com/ y crea una **cuenta gratuita** (Workers Free).
2. Ve a **Workers & Pages → D1 SQL database** y crea una base de datos llamada **biblioteca-tdt**.
3. Copia el identificador (**Database ID**) que muestre Cloudflare.
4. En GitHub, abre [wrangler.jsonc](./wrangler.jsonc), edítalo y sustituye **REEMPLAZAR_CON_ID_DE_D1** por el identificador real. Guarda el cambio.
5. En la base de datos D1 de Cloudflare, abre **Console**, copia el contenido completo de [schema.sql](./schema.sql), pégalo y pulsa **Execute** para crear las tablas.
6. En Cloudflare, entra en **Workers & Pages → Create application → Import a repository** (el texto exacto puede variar). Conecta GitHub, elige **Juanan88/biblioteca-tdt**, rama \`main\`. El comando de despliegue es \`npx wrangler deploy\`. El proyecto no necesita compilar la web ni un servidor aparte.
7. Abre el Worker creado, entra en **Settings → Variables and Secrets** y agrega como secretos (Secret, **no Text**):
   - \`ADMIN_PASSWORD\`: contraseña única de al menos 16 caracteres, difícil de adivinar. No la envíes por ChatGPT ni la escribas en GitHub.
   - \`ADMIN_SESSION_SECRET\`: secuencia aleatoria distinta, de al menos 32 caracteres. No la publiques.
8. Verifica que la aplicación funciona en la dirección gratuita \`https://biblioteca-tdt.<tu-subdominio>.workers.dev\` que te muestre Cloudflare. No inventes el subdominio: utilízalo tal como aparezca en la consola.
9. Prueba el catálogo vacío, da de alta un libro, préstalo y devuélvelo; prueba «No encuentro» y «Está en la estantería»; comprueba acceso administrativo y restauración. **Solo después** comparte el enlace con los vecinos.

Si el Worker fue desplegado antes de configurar los secretos, las escrituras devuelven un mensaje de configuración hasta introducirlos. No es necesario almacenar contraseñas de vecinos.

**Privacidad del repositorio:** el repositorio se creó público. Recomendamos pasar a privado desde GitHub → Settings → General → Danger Zone → Change repository visibility. No subir nunca contraseñas. GitHub y Cloudflare soportan repos privados conectados.

Cloudflare explica el despliegue automático con GitHub en https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/ y la consola D1 en https://developers.cloudflare.com/d1/get-started/

## Desarrollo local (opcional, no necesario para la puesta en marcha)
Con Node.js instalado, solo si quieres programar localmente:

\`\`\`bash
npm install
cp .dev.vars.example .dev.vars
# Rellenar .dev.vars (gitignored) con secretos solo locales
npm run db:local
npm run dev
\`\`\`

Para publicar nuevas versiones, guardar cambios en GitHub disparará el despliegue automático si la integración está activa.

## Archivos principales
- \`public/index.html\`, \`public/styles.css\`, \`public/app.js\`: interfaz.
- \`src/worker.js\`: rutas API y administración.
- \`src/core.js\`: validación de ISBN, fichas y alias.
- \`schema.sql\`: tablas D1.
- \`wrangler.jsonc\`: Worker, estáticos y conexión D1.
- \`tests/core.test.js\`: pruebas unitarias; se ejecutan con \`npm test\` o \`node --test tests/core.test.js\`.
- \`ESPECIFICACION.md\`: requisitos aprobados.
- \`AGENTS.md\`: reglas para continuar desarrollando.

## Límites conocidos y siguientes tareas
- No está desplegado ni probado todavía con una instancia D1 real; validar flujos completos tras enlazar Cloudflare.
- Un préstamo basado en un alias no garantiza la identidad de un vecino: se asume confianza y se ofrece historial limitado.
- El escaneo por cámara depende del soporte de BarcodeDetector del navegador; siempre hay entrada manual del ISBN.
- Open Library puede no devolver todos los datos y algunas portadas pueden faltar.
- Los campos de edad no se inventan si faltan.
- La limpieza periódica de registros de rate limit y procedimientos de exportación/backup pueden añadirse tras comprobar funcionamiento.
