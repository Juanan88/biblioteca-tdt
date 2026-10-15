# Biblioteca TDT

Web comunitaria de biblioteca para vecinos de una urbanización.

**Objetivo:** una biblioteca de autoservicio fácil de usar desde el móvil, sin cuentas para vecinos, sin QR individuales, sin etiquetas impresas y con casi cero mantenimiento.

## Estado
Proyecto en fase inicial. Las decisiones de producto están definidas en [ESPECIFICACION.md](./ESPECIFICACION.md) y las instrucciones de trabajo para Codex en [AGENTS.md](./AGENTS.md). **Aún no está desplegado ni conectado a una base de datos.**

## Funciones acordadas
- Cualquier vecino consulta, busca, añade y corrige libros sin registrarse.
- Alta rápida por ISBN (incluido escaneo mediante cámara cuando sea compatible) con entrada manual como alternativa.
- Préstamo: seleccionar libro → «Me lo llevo» → introducir nombre de pila o alias.
- Devolución con un botón, sin exigir identificación.
- El nombre o alias de quien tiene un libro prestado será visible para quienes tengan el enlace; informar antes de confirmar.
- Devolución recomendada a los 30 días, sin sanciones ni bloqueos.
- Corrección colaborativa: «No encuentro este libro» y «Está en la estantería».
- Solo administración puede borrar/restaurar; acceso mediante una contraseña única y sesión segura.

## Implementación
Priorizar un MVP real, accesible, responsive y sencillo. No añadir registro de vecinos, gestión de reservas, multas, QR por libro ni un sistema de administración complejo.

Para trabajar con Codex, abre este repositorio y pídele: «Implementa el MVP siguiendo ESPECIFICACION.md y AGENTS.md. Trabaja en una rama y prepara un PR con instrucciones de despliegue y pruebas».
