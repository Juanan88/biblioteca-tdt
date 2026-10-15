# Especificación funcional — Biblioteca TDT (MVP)

**Estado:** decisiones de producto aprobadas por el propietario del proyecto (octubre de 2026).

## 1. Objetivo
Biblioteca comunitaria formada a partir de donaciones de vecinos. La prioridad absoluta es **reducir la gestión y la fricción**: sin cuentas de vecinos, sin QR individuales, sin pegatinas, sin moderación cotidiana, sin gestión de reservas ni penalizaciones. Interfaz en español, móvil primero.

## 2. Ocho decisiones cerradas (no reinterpretar)
1. **Donaciones abiertas:** cualquier vecino puede añadir directamente al catálogo un libro dejado físicamente en la biblioteca, sin aprobación previa.
2. **Acceso por enlace:** web para compartir entre vecinos; sin cuentas, sin contraseñas de acceso generales. Solicitar no indexación en buscadores. **No afirmar que es una web privada o inaccesible a terceros:** conocer el enlace basta para acceder.
3. **Edición colaborativa:** cualquier visitante puede corregir metadatos y registrar operaciones; borrar/retirar definitivamente queda restringido a la administración. Guardar historial básico y permitir restauración.
4. **Quién tiene el libro:** «Me lo llevo» pide solo nombre de pila o alias; nombre visible para todo el que acceda por enlace, con fecha del préstamo. Informar explícitamente de esa visibilidad antes del envío. Evitar exigir apellidos, teléfono, correo, vivienda o número de puerta.
5. **Préstamos de 30 días recomendados:** no hay plazo exigible, multas, bloqueos ni penalizaciones. Mostrar «Devolución recomendada» desde el día 31.
6. **Alta rápida con ISBN:** pedir solo identificación del libro (ISBN o título) y confirmar que se ha depositado. Recuperar título, autor, portada, descripción y metadatos disponibles; el resto es opcional. Permitir libros antiguos sin ISBN. Detectar duplicados potenciales y permitir varios ejemplares del mismo título/ISBN.
7. **Corrección colaborativa:** «No encuentro este libro» marca «Por comprobar» (no «Perdido»); «Está en la estantería» corrige el estado a disponible sin administrador.
8. **Administración:** una contraseña única para responsables, sin cuentas individuales. Verificación solo en servidor; sesión segura; desde allí se pueden retirar/eliminar, restaurar libros e inspeccionar historial y corregir incidencias.

## 3. Flujos de vecino
### A. Catálogo
- Portada, título, autor, género/categoría (si se conoce), edad recomendada (si se conoce), disponibilidad.
- Búsqueda tolerante a mayúsculas/acentos; filtros simples (disponible, infantil/juvenil/adulto, género/edad cuando haya datos).
- Detalle con sinopsis y conservación, si existe.
- Estados visibles: **Disponible / Prestado / Por comprobar**. El estado «Retirado» solo para administración.
- Si hay varios ejemplares de un mismo título, mostrar recuentos (ejemplares totales/disponibles/prestados). No exigir identificación física de cada ejemplar mediante etiquetas.

### B. Añadir libro
- Entrada ISBN por texto; intentar lectura con cámara del código de barras del ISBN/EAN en navegadores compatibles, con **fallback manual obligatorio**.
- Consultar Open Library y/o Google Books mediante adaptador con tiempos de espera, fallos controlados y campos opcionales; no inventar edades recomendadas si la API no las aporta con fiabilidad.
- Si no hay ISBN o API falla, título obligatorio y autor opcional.
- Antes de publicar: confirmar «Ya lo he dejado en la biblioteca».
- Si coincide ISBN/título existente: sugerir «Añadir otro ejemplar» o «Volver», nunca bloquear la donación legítima.
- Proteger contra envíos repetidos/dobles clics y formatos inválidos.

### C. Préstamo
- Desde libro con ejemplar disponible, pulsar **Me lo llevo**.
- Introducir **nombre de pila o alias** (longitud razonable, por ejemplo 2–40 caracteres), mostrar aviso de que será visible a quienes tengan el enlace y confirmar.
- Guardar fecha de inicio. Mostrar alias/fecha junto al estado prestado.
- No solicitar registro, email, teléfono, vivienda ni password.

### D. Devolución
- En un libro prestado, botón **Lo he devuelto**. Sin reintroducir nombre.
- Si hay varios préstamos abiertos del mismo título, permitir escoger cuál se cierra mediante nombre/fecha o una interacción igualmente sencilla; nunca deducir identificadores físicos inexistentes.
- Marcar disponible cuando exista un ejemplar en estantería; el historial mínimo no debe exponer datos innecesarios.

### E. Corregir discrepancias
- **No encuentro este libro:** cambiar a «Por comprobar» sin declarar pérdida definitiva.
- **Está en la estantería:** confirmar disponibilidad; no crear accidentalmente ejemplares adicionales ni permitir que el conteo quede negativo.
- Mostrar mensaje breve de confirmación y ofrecer deshacer reciente cuando resulte viable.

## 4. Administración
- Zona de administración separada, contraseña única almacenada como secreto del hosting, nunca en frontend, repositorio ni localStorage.
- Usar verificación servidor y cookie de sesión firmada, HttpOnly, Secure en producción y SameSite apropiado. Limitar intentos de contraseña.
- Consultar libros, préstamos e incidencias; retirar, eliminar lógicamente (soft delete) y restaurar; historial de cambios.
- No mostrar operaciones administrativas a visitantes normales. **La seguridad debe verificarse en backend; ocultar botones no protege nada.**

## 5. Datos y modelo sugerido
- `books`: id, isbn nullable, title, authors, cover_url, description, language, category, genre, min_age nullable, metadata_source, created_at, updated_at, removed_at nullable.
- `copies`: id, book_id, condition nullable, verification_status, created_at, removed_at nullable. No identificador físico impreso necesario.
- `loans`: id, copy_id, borrower_display_name, borrowed_at, returned_at nullable.
- `events`: id, entity type/id, event type, timestamp, cambios mínimos sin secretos; evitar persistencia innecesaria de nombres históricos.
El modelo puede variar si hay una simplificación mejor que preserve la gestión de varios ejemplares, los invariantes de disponibilidad y el historial.

## 6. Seguridad, privacidad y robustez (obligatorios)
- Todas las escrituras pasan por backend/funciones validadas. Nunca exponer claves privilegiadas ni permitir modificaciones anónimas arbitrarias de la base de datos.
- Validación estricta de entradas, longitudes, normalización ISBN y control de concurrencia (doble préstamo o devolución simultánea).
- Rate limit y mitigación de spam/abuso para altas, correcciones y préstamos; no exigir CAPTCHA salvo abuso real.
- Consultas parametrizadas/ORM; evitar XSS al mostrar títulos, sinopsis y alias aportados por visitantes; no incrustar HTML libre.
- `robots.txt` y `noindex` para no promover indexación, aclarando que no constituyen control de acceso.
- No almacenar datos de vecinos adicionales al alias, fechas y estado necesarios; informar de visibilidad del nombre, establecer política breve de privacidad y borrado proporcional.
- Registros de auditoría para recuperar alteraciones, pero no exponer eventos internos completos ni nombres históricos innecesarios a público.
- Errores amigables en español, estados vacíos, indicadores de carga, manejo de APIs caídas, accesibilidad básica y tests de operaciones críticas.
- Copias de seguridad/recuperación documentadas. Sin secretos en git ni en historial.

## 7. Implementación técnica obligatoria para presupuesto 0 €
- Cloudflare Pages Free + Pages Functions para web estática y API. Sin alojamientos de pago ni servicios que cobren al superar cuotas.
- Cloudflare D1 Free (SQLite) para persistencia real. Acceso exclusivo desde el Worker, nunca desde frontend; los secretos se guardan en Cloudflare Pages (Production).
- Open Library gratuita para metadatos por ISBN, con fallback manual. La cámara de lectura de ISBN solo cuando el navegador lo soporte.
- Usar subdominio gratuito *.workers.dev, sin comprar dominio, sin pago ni tarjeta.
- Al alcanzar cuotas de la capa gratuita, se prefiere detener temporalmente operaciones antes que producir un cargo.
- Despliegue mediante integración GitHub ↔ Cloudflare desde el navegador; no exigir instalar Codex ni otras aplicaciones.
- Repositorio GitHub independiente de Hoy Toca Plan.

## 8. No incluir en el MVP
Registro/login de vecinos, emails, notificaciones personales, reservas, multas, pagos, códigos QR individuales, etiquetas físicas, gamificación, moderación obligatoria de donaciones, identificación por vivienda, procesos de aprobación.

## 9. Entregables y criterios de aceptación
1. Web funcional responsive, interfaz en español, búsqueda y filtros.
2. Alta manual y por ISBN, manejo de libros sin ISBN y varios ejemplares.
3. Préstamo con alias visible y devolución en pocos clics.
4. Recomendación automática de devolución tras 30 días.
5. Estado «Por comprobar» y recuperación colaborativa sin generar conteos imposibles.
6. Administración protegida realmente en servidor con eliminación lógica/restauración.
7. Persistencia real y migraciones de DB versionadas; no dejar un catálogo meramente de ejemplo como producto terminado.
8. Tests para préstamos duplicados, concurrencia, falta de ISBN, entradas maliciosas, validación admin y errores de APIs.
9. README de instalación, `.env.example` sin valores secretos, configuración de hosting y checklist de despliegue.
10. Entrega mediante pull request y resumen de cómo probarlo. No desplegar en producción con datos reales sin configurar y verificar protección de secretos.

## 10. Decisiones pendientes no bloqueantes
- Nombre comercial visible (provisional: «Biblioteca TDT»).
- Identidad visual (usar diseño limpio y cálido por defecto).
- Ubicación física/estanterías (campo opcional, no bloquear desarrollo).
- Cantidad inicial de libros, reglas para conservación, dominio definitivo.

## 11. Presupuesto (decisión posterior obligatoria)
- **Coste de 0 € sin excepciones**. No integrar proveedores ni planes con facturación variable, SMS, correo de pago, dominios de pago, almacenamiento con cargos o APIs de IA de pago.
- Cambios de precio o límites del proveedor requieren reevaluación antes de contratar nada. No asumir capacidades ilimitadas de planes gratuitos.
- Implementación inicial alojada en Cloudflare Pages Free (Functions), base D1 Free, catálogo por Open Library y repositorio GitHub Free.

## 12. Publicación creada por el usuario (15/10/2026)
- Proyecto de tipo **Cloudflare Pages** con URL indicada https://biblioteca-tdt.pages.dev/.
- Se adaptó el repositorio para usar `functions/api/[[path]].js` y `pages_build_output_dir: ./public` en `wrangler.jsonc`.
- Base D1 `biblioteca-tdt` (tablas creadas por el usuario); identificador configurado en el repositorio.
- El usuario indica que configuró secretos; no es posible validarlos remotamente sin diagnóstico.
- **Antes de uso real**, verificar `/api/health` y `/api/books`, y realizar pruebas end-to-end; el despliegue anterior Success no valida por sí solo el nuevo backend.
