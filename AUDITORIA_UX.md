# Auditoría UX — Biblioteca TDT · 15/10/2026

## Alcance y fiabilidad
Auditoría de **código y flujos de interfaz** de la rama principal, sin simulación de usuarios reales ni captura verificada del proyecto desplegado. Los hallazgos corregidos han quedado versionados en GitHub. No interpretar estas comprobaciones como una prueba de despliegue satisfactoria.

## Hallazgos y acciones

| Impacto | Hallazgo | Acción realizada | Estado |
|---|---|---|---|
| Alto | Se mostraban tres botones distintos para añadir libros (cabecera, portada y catálogo), dos incluso en móvil. | Queda **un único botón persistente «+ Donar un libro»** en la cabecera, visible también en móvil. | Corregido |
| Alto | Duplicidad de filtros: desplegable y chips que realizaban lo mismo. | Ahora solo queda un interruptor «Solo disponibles». Se retiraron los chips y el desplegable, sin duplicidades. | Corregido |
| Alto | Catálogo nuevo sin libros: no permite evaluar estética ni estados. | **Tres fichas ilustrativas en frontend** con títulos, autores, edades orientativas, y tres estados; llevan sello «EJEMPLO» y explicación visible. No crean registros D1 ni préstamos falsos. Se ocultan automáticamente al incorporar cualquier libro real. | Corregido |
| Medio | El formulario de donación presentaba muchos campos a la vez, pese a que solo se exige el título. | El nombre e ISBN y autor quedan visibles y el resto va en **«Más datos del libro (opcionales)»**; la sección se abre tras autocompletar metadatos. | Corregido |
| Medio | En las fichas prestadas había dos botones que devolvían a disponible: «Lo he devuelto» y «Está en la estantería». | Se deja **solo «Lo he devuelto»** para prestados. «Está en la estantería» permanece para estado «Por comprobar». | Corregido |
| Medio | La administración ocupaba espacio en la navegación principal. | Acceso secundario desde el pie de página, sin eliminar seguridad de servidor. | Corregido |
| Medio | Tres muestras podían dejar una cuarta columna vacía. | Rejilla de tres columnas para las muestras, con opción de lista compacta y diseño adaptable a móvil. | Corregido |
| Medio | Estética demasiado institucional y poco adaptada a niños. | Hero más cálido, portadas reales si se encuentran por ISBN (con cubierta ilustrativa alternativa), etiquetas por edad y contraste legible para adultos. | Corregido |
| Bajo | Los estados vacíos de búsqueda no permitían recuperarse fácilmente. | Botón «Quitar filtros». | Corregido |
| Bloqueante | El usuario informó de «Falta configurar los secretos de la aplicación» al guardar. | Error más orientativo en servidor; **sigue pendiente la verificación/configuración efectiva de secretos en Cloudflare Pages Production**. No puede resolverse editando GitHub. | Pendiente de Cloudflare |

## Los tres títulos de demostración

1. **El monstruo de colores** — Anna Llenas — ilustración CSS, «Disponible».
2. **¿A qué sabe la luna?** — Michael Grejniec — ilustración CSS, «Prestado».
3. **Matilda** — Roald Dahl — ilustración CSS, «Por comprobar».

Son **ejemplos visuales**, no libros realmente donados, y se muestran **solo cuando D1 no devuelve libros reales**. No tienen botones para prestar ni devolver. Intentan cargar portadas bibliográficas de Open Library por ISBN (si falta alguna, muestran una cubierta ilustrativa alternativa); las edades de ejemplo son orientativas, no datos confirmados para cada edición.

## Riesgos pendientes y próximos ensayos

- **Producción**: comprobar que el despliegue más reciente está en estado Success y que la web muestra las tres muestras.
- **Secretos**: verificar `ADMIN_PASSWORD` (≥16 caracteres) y `ADMIN_SESSION_SECRET` (≥32 caracteres), exactamente esos nombres, como secretos de **Production**. Cloudflare Pages requiere un nuevo despliegue posterior a configurar secretos para que las Pages Functions los reciban. Confirmar que `/api/health` devuelve `configured:true`.
- **Primer libro real**: probar alta ISBN y manual, recarga, préstamo con alias, devolución e incidencias. El primer libro sustituirá las muestras de forma automática.
- **Móvil y accesibilidad**: pendiente revisión visual en dispositivo real, lector de pantalla y teclado. Comprobar especialmente modal, botones y chips de filtros.
- **Robustez**: ensayar a futuro carga con cientos de libros y comportamiento de red lenta; nunca introducir dependencias de pago.

## Pruebas
Se han realizado comprobaciones de sintaxis y estructura desde la conexión a GitHub. Existe `tests/ux.test.js` para detectar regresiones en duplicados, catálogo de muestra y simplificación de formularios. **No hay todavía confirmación externa de que los tests del repositorio se hayan ejecutado en un entorno Node/Cloudflare de producción.**

## Actualización posterior de UX (15/10/2026)
- A petición del usuario, se retiraron todos los filtros excepto **Solo disponibles**.
- Se añadió un selector **Tarjetas / Lista** con `aria-pressed`, responsive y preferencia recordada en `localStorage`.
- El catálogo y la ficha de detalle muestran portadas bibliográficas reales mediante `cover_url` o la portada asociada al ISBN en Open Library, con fallback visual si no existe.
- Los tres libros de demostración intentan cargar sus portadas por ISBN, pero siguen siendo ejemplos visuales sin registros en D1.
- Los cambios se han revisado mediante verificaciones estáticas; queda pendiente la prueba de despliegue y la corrección de secretos de Cloudflare (`configured:false`).
