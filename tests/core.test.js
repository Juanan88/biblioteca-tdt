import test from "node:test";
import assert from "node:assert/strict";
import {isbn, bookInput, aliasInput, recommendedReturn, text} from "../src/core.js";

test("validar ISBN-10 e ISBN-13 con checksum",()=>{
  assert.equal(isbn("0-306-40615-2"),"0306406152");
  assert.equal(isbn("978-0-306-40615-7"),"9780306406157");
  assert.equal(isbn("9780306406158"),null);
  assert.equal(isbn("hola"),null);
  assert.equal(isbn(""),null);
});
test("libro mínimo sin ISBN ni campos adicionales",()=>{
  const b=bookInput({title:"   Matilda   "});
  assert.equal(b.title,"Matilda");
  assert.equal(b.isbn,null);
  assert.equal(b.min_age,null);
});
test("metadatos y varios tipos opcionales",()=>{
  const b=bookInput({title:"El Principito",isbn:"9780306406157",min_age:"8",audience:"infantil",condition:"bueno"});
  assert.equal(b.isbn,"9780306406157");
  assert.equal(b.min_age,8);
  assert.equal(b.audience,"infantil");
});
test("rechaza datos inválidos",()=>{
  assert.throws(()=>bookInput({title:""}));
  assert.throws(()=>bookInput({title:"A",isbn:"9999999999999"}));
  assert.throws(()=>bookInput({title:"A",min_age:-1}));
  assert.throws(()=>bookInput({title:"A",min_age:"no"}));
  assert.throws(()=>bookInput({title:"A".repeat(201)}));
  assert.throws(()=>aliasInput("M"));
  assert.throws(()=>aliasInput("<script>"));
  assert.equal(text(null),null);
});
test("portadas admiten únicamente alojamientos bibliográficos HTTPS",()=>{
  assert.equal(bookInput({title:"A",cover_url:"http://evil.example/x.jpg"}).cover_url,null);
  assert.equal(bookInput({title:"A",cover_url:"https://evil.example/x.jpg"}).cover_url,null);
  assert.equal(bookInput({title:"A",cover_url:"https://covers.openlibrary.org/b/id/11-M.jpg"}).cover_url,"https://covers.openlibrary.org/b/id/11-M.jpg");
});
test("plazo recomendado sin bloqueo ni devolución automática",()=>{
  const now=Date.parse("2026-10-15T12:00:00Z");
  assert.equal(recommendedReturn("2026-09-16 12:00:00",now),false);
  assert.equal(recommendedReturn("2026-09-15 12:00:00",now),true);
  assert.equal(recommendedReturn(null,now),false);
});
