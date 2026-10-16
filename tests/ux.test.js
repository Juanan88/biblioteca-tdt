import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../public/styles.css",import.meta.url),"utf8");

test("una sola acción persistente para donar libros",()=>{
 const ids=["top-add","hero-add","inline-add"];
 const present=ids.filter(id=>html.includes('id="'+id+'"'));
 assert.deepEqual(present,["top-add"]);
 assert.match(js,/\$\("#top-add"\)\.addEventListener/);
});
test("solo queda un filtro de disponibilidad",()=>{
 assert.doesNotMatch(html,/class="quick-filters"/);
 assert.doesNotMatch(html,/id="filter"/);
 assert.match(html,/id="only-available"/);
 assert.match(html,/Solo disponibles/);
 assert.match(js,/state\.availableOnly/);
 assert.match(js,/items\.some\(b=>b\.status==="available"\)/);
});
test("selector accesible de tarjetas y lista, con preferencia recordada",()=>{
 assert.match(html,/id="view-cards"/);
 assert.match(html,/id="view-list"/);
 assert.match(html,/aria-pressed="true"/);
 assert.match(js,/VIEW_STORAGE_KEY/);
 assert.match(js,/localStorage\.setItem/);
 assert.match(js,/booksEl\.classList\.toggle\("list-mode"/);
 assert.match(css,/\.books-grid\.list-mode/);
});
test("portadas de ISBN con fallback si no existen",()=>{
 assert.match(js,/covers\.openlibrary\.org\/b\/isbn\//);
 assert.match(js,/book-cover-image/);
 assert.match(js,/addEventListener\("error"/);
 assert.match(js,/img\.hidden=true/);
 assert.match(js,/coverHTML\(book\)/);
});
test("tres libros ejemplo, sin mezclarse con préstamos reales",()=>{
 for (const title of ["El monstruo de colores","¿A qué sabe la luna?","Matilda"])assert.ok(js.includes(title));
 assert.match(js,/no están registrados ni disponibles para préstamo/);
 assert.match(js,/<article class="book-card sample-card"/);
 assert.match(js,/9788493987749/);
 assert.match(js,/9788495123619/);
 assert.match(js,/9789681903268/);
 assert.match(js,/if\(state\.books\.length===0\)/);
 assert.match(css,/\.books-grid\.demo-mode/);
});
test("formulario rápido con más detalles opcionales",()=>{
 assert.match(js,/<details class="book-extras"/);
 assert.match(js,/<summary>Más datos del libro \(opcionales\)<\/summary>/);
 assert.match(js,/id="title"[^>]*required/);
});
test("acceso administrativo discreto en el pie",()=>{
 assert.match(html,/id="top-admin" class="footer-admin"/);
 assert.doesNotMatch(html,/<nav[\s\S]*?id="top-admin"[\s\S]*?<\/nav>/);
});

test("el donante se muestra en tarjetas y puede omitirse en el formulario",()=>{
 assert.match(js,/function donorName\(book\)/);
 assert.match(js,/Donado por Anónimo/);
 assert.match(js,/escapeHtml\(donorSummary\(items\)\)/);
 assert.match(js,/id="donor_name"/);
 assert.match(js,/Si lo dejas vacío, aparecerá «Anónimo»/);
 assert.match(js,/donor_name:data\.donor_name/);
 assert.match(css,/\.donor-label/);
});


test("fase 1: el catálogo llega después de una sola portada breve, sin estadísticas bloqueando la entrada",()=>{
 const startHero=html.indexOf('class="hero hero--compact"');
 const startCatalog=html.indexOf('id="catalogo"');
 const stats=html.indexOf('class="stats stats-inline"');
 const books=html.indexOf('id="books"');
 assert.ok(startHero!==-1&&startCatalog>startHero&&stats>startCatalog&&books>stats);
 assert.equal((html.match(/id="count-(?:all|free|borrowed)"/g)||[]).length,3);
 assert.equal((html.match(/id="catalogo"/g)||[]).length,1);
 assert.doesNotMatch(html,/class="hero-buttons"/,"evita añadir una segunda CTA antes de libros");
 assert.match(html,/class="catalogue catalogue--focused"/);
});
test("fase 1: las estadísticas son compactas y la portada se acorta para móvil",()=>{
 assert.match(css,/\.hero\.hero--compact\s*\{[^}]*min-height:0/s);
 assert.match(css,/\.catalogue--focused \.stats\.stats-inline/);
 assert.match(css,/\.catalogue--focused \.searchbox:focus-within/);
 assert.match(css,/@media\(max-width:690px\)\s*\{[\s\S]*?\.hero--compact \.hero-copy\{padding:21px 20px 22px\}/);
 assert.match(css,/\.catalogue--focused \.catalog-controls\{margin:9px 0 15px\}/);
});

test("donar un libro no requiere una casilla de confirmación redundante",()=>{
 const form=js.slice(js.indexOf("function bookForm("),js.indexOf("function checkDuplicate("));
 assert.ok(form.includes("Añade el libro cuando ya lo hayas dejado en la estantería"));
 assert.ok(form.includes("Confirmar donación"));
 assert.doesNotMatch(form,/type="checkbox"/);
 assert.ok(form.includes("id=\"duplicate\""),"el aviso de ISBN duplicado se mantiene");
 assert.ok(form.includes("id=\"title\""),"el título sigue siendo obligatorio");
});
