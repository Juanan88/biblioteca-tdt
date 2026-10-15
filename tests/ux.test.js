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
test("los filtros no están duplicados",()=>{
 assert.doesNotMatch(html,/id="filter"/);
 assert.match(html,/data-filter="infantil"/);
 assert.match(html,/data-filter="adultos"/);
 assert.match(js,/state\.filter=b\.dataset\.filter/);
});
test("tres libros ejemplo, sin mezclarse con préstamos reales",()=>{
 for (const title of ["El monstruo de colores","¿A qué sabe la luna?","Matilda"])assert.ok(js.includes(title));
 assert.match(js,/no están registrados ni disponibles para préstamo/);
 assert.match(js,/<article class="book-card sample-card"/);
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
