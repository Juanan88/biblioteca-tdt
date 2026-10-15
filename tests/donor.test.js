import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {ensureDonorColumn} from "../src/donor.js";
import {ensureHistory} from "../src/history.js";

test("migración de base antigua: conserva libros y aplica Anónimo por defecto",async()=>{
 const db=new DatabaseSync(":memory:");
 db.exec("CREATE TABLE books(id TEXT PRIMARY KEY,title TEXT NOT NULL,author TEXT,isbn TEXT,description TEXT,cover_url TEXT,genre TEXT,audience TEXT,min_age INTEGER,condition TEXT,status TEXT DEFAULT 'available',removed_at TEXT)");
 db.prepare("INSERT INTO books(id,title) VALUES(?,?)").run("ejemplar-antiguo","Cuento que ya existía");
 const DB={prepare(sql){let params=[];return {bind(...args){params=args;return this;},async run(){return db.prepare(sql).run(...params);},async all(){return {results:db.prepare(sql).all(...params)}}}}};
 await Promise.all([ensureDonorColumn(DB),ensureDonorColumn(DB)]);
 await ensureDonorColumn(DB);
 const before=db.prepare("SELECT * FROM books WHERE id='ejemplar-antiguo'").get();
 assert.equal(before.title,"Cuento que ya existía");
 assert.equal(before.donor_name,"Anónimo");
 db.prepare("INSERT INTO books(id,title,donor_name) VALUES(?,?,?)").run("nuevo","El segundo cuento","Sara");
 assert.equal(db.prepare("SELECT donor_name FROM books WHERE id='nuevo'").get().donor_name,"Sara");
 await ensureHistory(DB);
 db.prepare("UPDATE books SET donor_name=? WHERE id=?").run("Luis","ejemplar-antiguo");
 const revision=db.prepare("SELECT before_json,after_json FROM book_revisions WHERE book_id=? ORDER BY id DESC LIMIT 1").get("ejemplar-antiguo");
 assert.equal(JSON.parse(revision.before_json).donor_name,"Anónimo");
 assert.equal(JSON.parse(revision.after_json).donor_name,"Luis");
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM books").get().n,2);
});
