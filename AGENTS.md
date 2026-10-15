# Instrucciones para agentes de desarrollo (Codex)

Lee primero [ESPECIFICACION.md](./ESPECIFICACION.md). Sus ocho decisiones son requisitos **aprobados**, no propuestas.

## Prioridades
1. Simplicidad radical para vecinos; mínimo mantenimiento.
2. Seguridad real del backend y respeto a la privacidad incluso sin registro.
3. Experiencia móvil excelente, accesibilidad y textos íntegramente en español.
4. Persistencia real, tests de transacciones y facilidad de despliegue.
5. Código claro, modular, sin sobreingeniería ni dependencias innecesarias.

## Prohibiciones
- No añadir autenticación/registro para vecinos, reservas, multas o QR por libro.
- No exponer una service-role key, contraseña de administrador ni credenciales en el cliente/código versionado.
- No considerar que noindex o un enlace compartido equivale a privacidad.
- No implementar permisos solo a nivel de UI: backend debe verificarlos.
- No marcar automáticamente un préstamo como devuelto tras 30 días.
- No usar mocks o almacenamiento local como persistencia final.

## Método de trabajo
- Trabajar en rama nueva y proponer pull request pequeño y verificable.
- Documentar decisiones técnicas importantes y cualquier limitación real.
- Implementar y ejecutar tests, lint y build cuando el entorno lo permita. Reportar explícitamente lo no comprobado.
- Mantener una lista de variables de entorno necesarias en `.env.example` sin valores secretos.
- Si hace falta crear un proyecto externo (Supabase, Vercel, dominio), preparar instrucciones concretas y detenerse en los puntos que requieran autorización o credenciales del propietario.

## Presupuesto estricto (decisión del propietario)
**COSTE 0 €**. Usar exclusivamente Cloudflare Pages Free + Pages Functions, D1 Free, GitHub Free y Open Library; no proponer Supabase/Vercel de pago ni componentes que puedan facturar consumo. Las cuotas se pueden agotar: no habilitar upgrades automáticos. No exigir instalar Codex: continuar implementación directamente desde ChatGPT/GitHub y documentar los pasos de Cloudflare que deba realizar la persona titular.

## Despliegue real del usuario
El proyecto que el usuario ha creado es **Cloudflare Pages** (no un Worker independiente), en `https://biblioteca-tdt.pages.dev/`. Usa `functions/api/[[path]].js` para las rutas API, `src/worker.js` como lógica compartida, `pages_build_output_dir: ./public`, y D1 binding `DB`. No recomendar borrar ni recrear Pages ni pedir subdominio workers.dev. Validar logs del último despliegue y la ruta `/api/health`.
