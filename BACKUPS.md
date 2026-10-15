# Copias de seguridad, historial y recuperación · Biblioteca TDT

**Coste: 0 €**, sin contratar servicios adicionales.

## 1. Historial de fichas
El primer alta, edición, préstamo, devolución o retirada de libro tras desplegar esta versión ejecuta una migración **no destructiva**, que crea `book_revisions` y un trigger SQLite. Los libros existentes no se borran ni se modifican.

El historial guarda una versión anterior y posterior de los **metadatos del libro, su estado y si está retirado**. No guarda los alias históricos: así respetamos la privacidad de los vecinos. Los cambios históricos ocurridos **antes de esta actualización no pueden recuperarse retroactivamente**.

En el pie de la web entra en **Administración → Historial** del libro. El botón **Recuperar ficha** restaura ISBN, título, autor, descripción, portada, género, categoría, edad y conservación del momento seleccionado. **No modifica el préstamo actual, su alias, disponibilidad ni situación de retirada**, para no cancelar préstamos por error.

## 2. Exportación manual
En **Administración → Descargar copia de seguridad** se descarga un archivo JSON con:
- todos los ejemplares (incluidos los retirados), con los préstamos **actuales**;
- historial de cambios de ficha;
- historial de eventos.

**Privacidad:** este archivo puede contener los alias de prestatarios actuales. No lo publiques en GitHub, grupos de WhatsApp ni servicios compartidos. Guárdalo en un dispositivo/ubicación privada y protegida.

## 3. Recuperación desde archivo
En Administración, en **Recuperar libros ausentes de una copia anterior**, selecciona el JSON exportado y confirma. La función **solo añade ejemplares cuyo identificador ya no exista**: nunca sobrescribe ni borra libros actuales y no restaura a ciegas préstamos ajenos. Conserva estado del ejemplar recuperado tal como figura en la copia.

**Límites:** el importador no restaura el historial antiguo de eventos/revisiones dentro de D1; estos registros siguen contenidos en el fichero exportado. Para una restauración completa de toda la base, usar D1 Time Travel o una restauración administrada de D1.

## 4. Copias automáticas incorporadas en Cloudflare
Cloudflare D1 **Time Travel está habilitado automáticamente**, sin configurarlo y sin coste adicional. En Workers Free permite restaurar el estado anterior de la base de datos dentro de **los últimos 7 días** (según la documentación de Cloudflare de octubre de 2026). Esta recuperación revierte la **base completa** y puede hacer perder cambios posteriores a la fecha restaurada.

Antes de restaurar todo D1, descarga una copia JSON del estado actual para evitar perder libros recientes. El procedimiento de Time Travel utiliza Wrangler o las opciones soportadas que indique Cloudflare:
- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/platform/limits/

## 5. Reparación de la migración automática
Si un alta o edición falla tras desplegar con un error relacionado con `book_revisions` o `books_track_revision`, la migración se puede ejecutar manualmente desde **Cloudflare D1 → biblioteca-tdt → Console**:

1. Abre [`migrations/001_book_revisions.sql`](./migrations/001_book_revisions.sql) en GitHub.
2. Copia **todo** el SQL y ejecútalo en la consola D1.
3. No ejecutes `DROP TABLE`, `DELETE` ni otras consultas que borren datos.
4. Comprueba desde la web que puedes editar una ficha; entra en Administración → Historial.

La migración es idempotente (`IF NOT EXISTS`). **No requiere crear otra base D1 ni volver a insertar los libros existentes.**

## 6. Mantenimiento
El sistema elimina automáticamente, en el siguiente acceso sujeto a límites de uso de cada nueva hora, los registros temporales `rate_limits` con más de 48 horas. No necesita un Cron ni genera facturas.

La página de administración sigue restringida mediante los secretos de Production. La aplicación no exporta automáticamente a ubicaciones externas; las exportaciones manuales son la opción para conservar copias más antiguas que los 7 días de Time Travel Free.
