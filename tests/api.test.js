// Integración real contra SQLite en memoria (motor usado por D1).
// Node >=22.13: node:sqlite. Se ejecuta en CI con Node 24, sin servicios de pago.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/worker.js";

const db=new DatabaseSync(":memory:");
db.exec(readFileSync(new URL("../schema.sql",import.meta.url),"utf8"));

const DB={
 prepare(sql){
  let args=[];
  return {
   bind(...values){args=values;return this;},
   async run(){const result=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes||0)}};},
   async all(){return {results:db.prepare(sql).all(...args)};},
   async first(){return db.prepare(sql).get(...args)||null;}
  };
 },
 async batch(statements){
  db.exec("BEGIN");
  try{
   const data=[];
   for(const item of statements)data.push(await item.run());
   db.exec("COMMIT");return data;
  }catch(err){db.exec("ROLLBACK");throw err;}
 }
};
const env={DB,ADMIN_PASSWORD:"contraseña-interna-de-prueba-con-18",ADMIN_SESSION_SECRET:"clave-secreta-local-de-pruebas-que-supera-los-32-caracteres"};
const origin="https://biblioteca-tdt.pages.dev";
async function request(method,path,body,cookie){
 const headers={Origin:origin,"Content-Type":"application/json","CF-Connecting-IP":"192.0.2.9"};
 if(cookie)headers.Cookie=cookie;
 const options={method,headers};
 if(body!==undefined)options.body=JSON.stringify(body);
 const response=await worker.fetch(new Request(origin+path,options),env);
 let data;try{data=await response.json();}catch{data=null}
 return {status:response.status,data,headers:response.headers};
}
test("circuito API: catálogo, CRUD, concurrencia, historial, recuperación y administración",async()=>{
 let result=await request("GET","/api/health");
 assert.equal(result.status,200);
 assert.equal(result.data.configured,true);
 result=await request("GET","/api/books");
 assert.deepEqual(result.data.books,[]);

 result=await request("POST","/api/books",{title:"El cuento de prueba",author:"Vecindario",audience:"infantil",min_age:4});
 assert.equal(result.status,201);
 const bookId=result.data.id;
 assert.match(bookId,/^[0-9a-f-]{36}$/);
 result=await request("POST","/api/books",{title:"El cuento de prueba",author:"Vecindario"});
 assert.equal(result.status,201,"se permiten varios ejemplares");
 result=await request("POST","/api/books",{title:""});
 assert.equal(result.status,400,"un título vacío se rechaza");

 result=await request("GET","/api/books");
 assert.equal(result.data.books.length,2);
 const contenders=await Promise.all([
  request("POST","/api/books/"+bookId+"/borrow",{name:"Vecino A"}),
  request("POST","/api/books/"+bookId+"/borrow",{name:"Vecino B"})
 ]);
 assert.deepEqual(contenders.map(x=>x.status).sort(),[200,409],"solo un préstamo simultáneo gana");
 result=await request("POST","/api/books/"+bookId+"/found",{});
 assert.equal(result.status,409,"no permite marcar en estantería un ejemplar prestado");
 let row=db.prepare("SELECT * FROM books WHERE id=?").get(bookId);
 assert.equal(row.status,"borrowed");assert.ok(row.borrower_alias);
 const priorAlias=row.borrower_alias;

 // Edición y recuperación de ficha, incluso estando prestado.
 result=await request("PATCH","/api/books/"+bookId,{title:"Título corregido",author:"Vecindario",min_age:5});
 assert.equal(result.status,200);
 assert.equal(db.prepare("SELECT title FROM books WHERE id=?").get(bookId).title,"Título corregido");
 result=await request("GET","/api/admin/books");
 assert.equal(result.status,401);

 const wrong=await request("POST","/api/admin/login",{password:"incorrecta"});
 assert.equal(wrong.status,401);
 const login=await request("POST","/api/admin/login",{password:env.ADMIN_PASSWORD});
 assert.equal(login.status,200);
 const cookie=login.headers.get("set-cookie")?.split(";")[0];
 assert.ok(cookie?.startsWith("tdt_admin="));
 result=await request("GET","/api/admin/me",undefined,cookie);
 assert.equal(result.data.admin,true);

 result=await request("GET","/api/admin/revisions?book_id="+bookId,undefined,cookie);
 assert.equal(result.status,200);
 assert.ok(result.data.revisions.length>=2);
 assert.ok(result.data.revisions.every(r=>!JSON.stringify(r).includes("Vecino A")&&!JSON.stringify(r).includes("Vecino B")),"no conserva alias históricos");
 const editRevision=result.data.revisions.find(r=>r.before.title==="El cuento de prueba"&&r.after.title==="Título corregido");
 assert.ok(editRevision,"registra los metadatos anteriores");
 result=await request("POST","/api/admin/revisions/"+editRevision.id+"/restore",{},cookie);
 assert.equal(result.status,200);
 row=db.prepare("SELECT * FROM books WHERE id=?").get(bookId);
 assert.equal(row.title,"El cuento de prueba");assert.equal(row.status,"borrowed");assert.equal(row.borrower_alias,priorAlias);

 // Retirada mientras está prestado: conserva el préstamo y lo restaura intacto.
 result=await request("POST","/api/admin/books/"+bookId+"/remove",{},cookie);
 assert.equal(result.status,200);
 row=db.prepare("SELECT * FROM books WHERE id=?").get(bookId);
 assert.equal(row.status,"borrowed");assert.equal(row.borrower_alias,priorAlias);
 assert.ok(row.removed_at);
 result=await request("POST","/api/admin/books/"+bookId+"/restore",{},cookie);
 assert.equal(result.status,200);
 row=db.prepare("SELECT * FROM books WHERE id=?").get(bookId);
 assert.equal(row.status,"borrowed");assert.equal(row.borrower_alias,priorAlias);
 assert.equal(row.removed_at,null);

 result=await request("POST","/api/books/"+bookId+"/return",{});
 assert.equal(result.status,200);
 result=await request("POST","/api/books/"+bookId+"/missing",{});
 assert.equal(result.status,200);
 result=await request("POST","/api/books/"+bookId+"/found",{});
 assert.equal(result.status,200);
 result=await request("POST","/api/books/"+bookId+"/found",{});
 assert.equal(result.status,409,"no permite repetir corrección");

 // Carrera entre marcar no encontrado y prestar: solo gana una transición.
 const race=await Promise.all([
  request("POST","/api/books/"+bookId+"/missing",{}),
  request("POST","/api/books/"+bookId+"/borrow",{name:"Vecino C"})
 ]);
 assert.deepEqual(race.map(x=>x.status).sort(),[200,409]);
 row=db.prepare("SELECT status FROM books WHERE id=?").get(bookId);
 assert.ok(["review","borrowed"].includes(row.status));
 const endAction=row.status==="review"?"found":"return";
 assert.equal((await request("POST","/api/books/"+bookId+"/"+endAction,{})).status,200);

 // Exportación, recuperación no destructiva e historial de eventos.
 const backup=await request("GET","/api/admin/backup",undefined,cookie);
 assert.equal(backup.status,200);
 assert.equal(backup.data.format,"biblioteca-tdt");
 assert.equal(backup.data.books.length,2);
 assert.ok(backup.data.revisions.length>0);
 const noChange=await request("POST","/api/admin/backup/restore",{confirmation:"RESTAURAR",backup:backup.data},cookie);
 assert.equal(noChange.status,200);
 assert.equal(noChange.data.added,0,"importar nunca sobrescribe libros existentes");
 db.prepare("DELETE FROM books WHERE id=?").run(bookId);
 const recovered=await request("POST","/api/admin/backup/restore",{confirmation:"RESTAURAR",backup:backup.data},cookie);
 assert.equal(recovered.status,200);
 assert.equal(recovered.data.added,1);
 assert.equal(db.prepare("SELECT title FROM books WHERE id=?").get(bookId).title,"El cuento de prueba");
 const history=await request("GET","/api/admin/events",undefined,cookie);
 assert.equal(history.status,200);
 assert.ok(history.data.events.some(x=>x.action==="prestamo"));
 assert.ok(history.data.events.some(x=>x.action==="restaurar_ficha"));
 result=await request("POST","/api/admin/logout",{},cookie);
 assert.equal(result.status,200);
 assert.match(result.headers.get("set-cookie"),/Max-Age=0/);
});
