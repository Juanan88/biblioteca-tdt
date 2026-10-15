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
