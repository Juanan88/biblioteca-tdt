import { text, isbn, bookInput, aliasInput } from "./core.js";
import { fromLegacy, fromEdition, fromWork, fromGoogle, mergeBookData } from "./metadata.js";
import { ensureHistory } from "./history.js";

function reply(data, status = 200, extra = {}) {
  return Response.json(data, {status, headers:{
    "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff",
    ...extra
  }});
}
function fail(message, status = 400) { return reply({error:message}, status); }
function isConfigured(env) {
  return !!(env.DB && env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 16 && env.ADMIN_SESSION_SECRET && env.ADMIN_SESSION_SECRET.length >= 32);
}
function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}
async function bodyOf(request, maxLength=12000) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) throw new Error("Envía los datos en formato JSON.");
  const raw = await request.text();
  if (raw.length > maxLength) throw new Error("La solicitud es demasiado grande.");
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error("JSON no válido."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Datos no válidos.");
  return data;
}
async function sha(s) {
  const data = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function fixedCompare(a,b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff=0;
  for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff === 0;
}
async function signed(exp, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("biblioteca-tdt-admin:" + exp));
  return [...new Uint8Array(sig)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function cookieValue(request) {
  const entry=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("tdt_admin="));
  return entry ? entry.slice("tdt_admin=".length) : null;
}
async function isAdmin(request, env) {
  const val=cookieValue(request);
  if (!val || !env.ADMIN_SESSION_SECRET) return false;
  const match=/^(\d{10,13})\.([a-f0-9]{64})$/.exec(val);
  if (!match || Number(match[1]) < Date.now() || Number(match[1]) > Date.now()+86400000) return false;
  return fixedCompare(match[2],await signed(match[1],env.ADMIN_SESSION_SECRET));
}
let lastCleanupHour="";
async function rateLimit(request, env, action, max=45) {
 // Purga oportunista: no necesita Cron, no guarda direcciones IP y limita el crecimiento de D1.
 const currentHour=new Date().toISOString().slice(0,13);
 if(lastCleanupHour!==currentHour){
  try{await env.DB.prepare("DELETE FROM rate_limits WHERE hour_bucket < ?").bind(new Date(Date.now()-48*3600000).toISOString().slice(0,13)).run();lastCleanupHour=currentHour;}
  catch(error){console.warn("No se pudo limpiar rate_limits",error);}
 }
  const ip=request.headers.get("CF-Connecting-IP") || "unknown";
  const identity=await sha(env.ADMIN_SESSION_SECRET + ":" + ip);
  const hour=new Date().toISOString().slice(0,13);
  await env.DB.prepare(
    "INSERT INTO rate_limits(action,actor_hash,hour_bucket,hits) VALUES(?,?,?,1) "+
    "ON CONFLICT(action,actor_hash,hour_bucket) DO UPDATE SET hits=hits+1"
  ).bind(action,identity,hour).run();
  const row=await env.DB.prepare(
    "SELECT hits FROM rate_limits WHERE action=? AND actor_hash=? AND hour_bucket=?"
  ).bind(action,identity,hour).first();
  return Number(row?.hits||0) <= max;
}
async function log(db,id,action) {
  try { await db.prepare("INSERT INTO events(book_id,action) VALUES (?,?)").bind(id,action).run(); }
  catch { /* Una caída del log no invalida un préstamo ya confirmado. */ }
}
const bookSelect="SELECT id,isbn,title,author,description,cover_url,genre,audience,min_age,condition,status,borrower_alias,borrowed_at,created_at,updated_at FROM books";

async function fetchBookJson(url, ms=4800) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try {
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json"}});
    if(!response.ok)return null;
    return await response.json();
  } catch {return null;}
  finally{clearTimeout(timer);}
}
async function lookupIsbn(code) {
  // Edición y obra de Open Library, con Google Books como complemento gratuito.
  const [raw, edition]=await Promise.all([
    fetchBookJson("https://openlibrary.org/api/books?bibkeys=ISBN:"+encodeURIComponent(code)+"&format=json&jscmd=data"),
    fetchBookJson("https://openlibrary.org/isbn/"+encodeURIComponent(code)+".json")
  ]);
  const legacy=fromLegacy(raw?.["ISBN:"+code],code);
  const specific=fromEdition(edition,code);
  const workRef=edition?.works?.[0]?.key;
  const safeWork=typeof workRef==="string" && /^\/works\/OL\d+W$/.test(workRef) ? workRef : null;
  const combined=mergeBookData([legacy,specific],code);
  const needsDetail=!combined?.description || !combined?.cover_url || !combined?.genre || !combined?.audience;
  let work=null,google=null;
  if(needsDetail) {
    const [workJson, googleJson]=await Promise.all([
      safeWork ? fetchBookJson("https://openlibrary.org"+safeWork+".json") : Promise.resolve(null),
      fetchBookJson("https://www.googleapis.com/books/v1/volumes?q="+encodeURIComponent("isbn:"+code)+"&maxResults=4",4800)
    ]);
    work=fromWork(workJson,code);
    google=fromGoogle(googleJson?.items||[],code);
  }
  return mergeBookData([legacy,specific,work,google],code);
}
const idRegex=/^\/api\/books\/([0-9a-f-]{36})(?:\/(borrow|return|missing|found))?$/;
const adminBookRegex=/^\/api\/admin\/books\/([0-9a-f-]{36})\/(remove|restore)$/;

export default {
 async fetch(request,env) {
  const url=new URL(request.url), path=url.pathname, method=request.method;
  if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (!env.DB) return fail("Falta configurar la base de datos D1.",503);
  try {
    if (!["GET","HEAD"].includes(method)) {
      if (!sameOrigin(request)) return fail("Origen de solicitud no permitido.",403);
      if (!isConfigured(env)) return fail("Falta configurar los secretos en Cloudflare Pages (Production). Comprueba ADMIN_PASSWORD (mínimo 16 caracteres) y ADMIN_SESSION_SECRET (mínimo 32); guarda ambos como Secret y vuelve a desplegar.",503);
    }
    if(method==="GET" && path==="/api/health") return reply({ok:true,configured:isConfigured(env)});
    if(method==="GET" && path==="/api/books") {
      const {results}=await env.DB.prepare(bookSelect+" WHERE removed_at IS NULL ORDER BY created_at DESC LIMIT 1500").all();
      return reply({books:results});
    }
    if(method==="GET" && path==="/api/isbn") {
      const code=isbn(url.searchParams.get("code"));
      if(!code) return fail("ISBN no válido.");
      if(!await rateLimit(request,env,"isbn",35)) return fail("Demasiadas consultas. Prueba en una hora.",429);
      try {return reply({book:await lookupIsbn(code)});}
      catch{return reply({book:null,warning:"No se han podido recuperar datos. Puedes introducir el libro manualmente."});}
    }
    if(method==="POST" && path==="/api/books") {
      await ensureHistory(env.DB);
      if(!await rateLimit(request,env,"add",30)) return fail("Demasiadas altas desde esta conexión.",429);
      const input=bookInput(await bodyOf(request));
      const id=crypto.randomUUID();
      await env.DB.prepare(
       "INSERT INTO books(id,isbn,title,author,description,cover_url,genre,audience,min_age,condition) VALUES(?,?,?,?,?,?,?,?,?,?)"
      ).bind(id,input.isbn,input.title,input.author,input.description,input.cover_url,input.genre,input.audience,input.min_age,input.condition).run();
      await log(env.DB,id,"alta");
      return reply({ok:true,id},201);
    }
    const match=idRegex.exec(path);
    if(match && method==="PATCH" && !match[2]) {
      await ensureHistory(env.DB);
      if(!await rateLimit(request,env,"edit",45)) return fail("Demasiadas modificaciones.",429);
      const input=bookInput(await bodyOf(request));
      const result=await env.DB.prepare("UPDATE books SET isbn=?,title=?,author=?,description=?,cover_url=?,genre=?,audience=?,min_age=?,condition=?,updated_at=datetime('now') WHERE id=? AND removed_at IS NULL")
       .bind(input.isbn,input.title,input.author,input.description,input.cover_url,input.genre,input.audience,input.min_age,input.condition,match[1]).run();
      if(!result.meta.changes) return fail("No encontramos el libro.",404);
      await log(env.DB,match[1],"edicion");
      return reply({ok:true});
    }
    if(match && method==="POST" && match[2]) {
      await ensureHistory(env.DB);
      const [ ,id,action]=match;
      if(!await rateLimit(request,env,"movement",55)) return fail("Demasiados movimientos.",429);
      let statement,values,event;
      if(action==="borrow") {
        const data=await bodyOf(request);
        const name=aliasInput(data.name);
        statement="UPDATE books SET status='borrowed',borrower_alias=?,borrowed_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND removed_at IS NULL AND status='available'";
        values=[name,id]; event="prestamo";
      } else if(action==="return") {
        statement="UPDATE books SET status='available',borrower_alias=NULL,borrowed_at=NULL,updated_at=datetime('now') WHERE id=? AND removed_at IS NULL AND status='borrowed'";
        values=[id]; event="devolucion";
      } else if(action==="missing") {
        statement="UPDATE books SET status='review',updated_at=datetime('now') WHERE id=? AND removed_at IS NULL AND status='available'";
        values=[id]; event="no_encontrado";
      } else {
        statement="UPDATE books SET status='available',borrower_alias=NULL,borrowed_at=NULL,updated_at=datetime('now') WHERE id=? AND removed_at IS NULL AND status='review'";
        values=[id]; event="en_estanteria";
      }
      const result=await env.DB.prepare(statement).bind(...values).run();
      if(!result.meta.changes) return fail("El estado ya ha cambiado. Actualiza el catálogo.",409);
      await log(env.DB,id,event);
      return reply({ok:true});
    }
    if(method==="POST" && path==="/api/admin/login") {
      if(!await rateLimit(request,env,"admin_login",7)) return fail("Demasiados intentos. Prueba dentro de una hora.",429);
      const data=await bodyOf(request);
      if(typeof data.password!=="string" || data.password.length>200) return fail("Contraseña incorrecta.",401);
      const [one,two]=await Promise.all([sha(data.password),sha(env.ADMIN_PASSWORD)]);
      if(!fixedCompare(one,two)) return fail("Contraseña incorrecta.",401);
      const exp=String(Date.now()+8*60*60*1000), sig=await signed(exp,env.ADMIN_SESSION_SECRET);
      return reply({ok:true},200,{"Set-Cookie":"tdt_admin="+exp+"."+sig+"; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=28800"});
    }
    if(method==="GET" && path==="/api/admin/me") return reply({admin:await isAdmin(request,env)});
    if(method==="POST" && path==="/api/admin/logout") return reply({ok:true},200,{"Set-Cookie":"tdt_admin=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0"});
    if(path.startsWith("/api/admin/")) {
      if(!await isAdmin(request,env)) return fail("Acceso reservado a administración.",401);
      if(method==="GET" && path==="/api/admin/books") {
        const {results}=await env.DB.prepare(bookSelect.replace(" FROM books",",removed_at FROM books")+" ORDER BY created_at DESC LIMIT 1500").all();
        return reply({books:results});
      }
      if(method==="GET" && path==="/api/admin/events") {
        const {results}=await env.DB.prepare("SELECT events.action,events.occurred_at,books.title FROM events LEFT JOIN books ON books.id=events.book_id ORDER BY events.id DESC LIMIT 80").all();
        return reply({events:results});
      }
      if(method==="GET" && path==="/api/admin/backup") {
        await ensureHistory(env.DB);
        const {results:books}=await env.DB.prepare(bookSelect.replace(" FROM books",",removed_at FROM books")+" ORDER BY created_at,id LIMIT 10001").all();
        if(books.length>10000)return fail("La biblioteca es demasiado grande para una copia única. Contacta con administración.",413);
        const {results:revisions}=await env.DB.prepare("SELECT id,book_id,before_json,after_json,changed_at FROM book_revisions ORDER BY id LIMIT 30001").all();
        if(revisions.length>30000)return fail("Hay demasiadas revisiones para exportarlas de una vez.",413);
        const {results:events}=await env.DB.prepare("SELECT id,book_id,action,occurred_at FROM events ORDER BY id LIMIT 30001").all();
        if(events.length>30000)return fail("Hay demasiados eventos para exportarlos de una vez.",413);
        return reply({format:"biblioteca-tdt",version:1,exported_at:new Date().toISOString(),books,revisions,events,
          note:"La copia incluye los alias de los préstamos activos: guárdala solo en un lugar privado."},200,{"Content-Disposition":'attachment; filename="biblioteca-tdt-backup.json"'});
      }
      if(method==="POST" && path==="/api/admin/backup/restore") {
        if(!await rateLimit(request,env,"admin_restore",5))return fail("Demasiados intentos de recuperación.",429);
        const data=await bodyOf(request,4000000);
        if(data.confirmation!=="RESTAURAR"||data.backup?.format!=="biblioteca-tdt"||data.backup?.version!==1||!Array.isArray(data.backup.books)||data.backup.books.length>5000)
          return fail("Copia no válida o falta confirmación RESTAURAR.");
        await ensureHistory(env.DB);
        const existing=new Set();
        const statements=[];
        for(const original of data.backup.books){
          if(!original||typeof original.id!=="string"||!/^[0-9a-f-]{36}$/.test(original.id)||existing.has(original.id))return fail("La copia contiene identificadores inválidos o repetidos.");
          existing.add(original.id);
          const b=bookInput(original);
          if(!["available","borrowed","review"].includes(original.status))return fail("Estado de un libro inválido.");
          const borrowed=original.status==="borrowed";
          if(borrowed && (typeof original.borrower_alias!=="string"||!original.borrower_alias.trim()||typeof original.borrowed_at!=="string"))return fail("Hay un préstamo incompleto en la copia.");
          const date=(x)=>typeof x==="string" && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(x) ? x : null;
          statements.push(env.DB.prepare(
           "INSERT OR IGNORE INTO books(id,isbn,title,author,description,cover_url,genre,audience,min_age,condition,status,borrower_alias,borrowed_at,created_at,updated_at,removed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
          ).bind(original.id,b.isbn,b.title,b.author,b.description,b.cover_url,b.genre,b.audience,b.min_age,b.condition,original.status,
           borrowed?original.borrower_alias:null,borrowed?date(original.borrowed_at):null,
           date(original.created_at)||new Date().toISOString().slice(0,19).replace("T"," "),
           date(original.updated_at)||new Date().toISOString().slice(0,19).replace("T"," "),date(original.removed_at)));
        }
        // Los datos existentes nunca se sobrescriben; se recuperan solo libros que faltan.
        let inserted=0;
        for(let i=0;i<statements.length;i+=80){
          const result=await env.DB.batch(statements.slice(i,i+80));
          inserted+=result.reduce((count,x)=>count+Number(x.meta?.changes||0),0);
        }
        return reply({ok:true,added:inserted,skipped:statements.length-inserted,
         note:"Se han recuperado los libros ausentes sin modificar los existentes. Historial antiguo y eventos siguen en el archivo descargado."});
      }
      if(method==="GET" && path==="/api/admin/revisions") {
        await ensureHistory(env.DB);
        const bookId=url.searchParams.get("book_id");
        if(!bookId||!/^[0-9a-f-]{36}$/.test(bookId))return fail("Identificador de libro incorrecto.");
        const {results}=await env.DB.prepare("SELECT id,book_id,before_json,after_json,changed_at FROM book_revisions WHERE book_id=? ORDER BY id DESC LIMIT 100").bind(bookId).all();
        return reply({revisions:results.map(row=>({...row,before:JSON.parse(row.before_json),after:JSON.parse(row.after_json),before_json:undefined,after_json:undefined}))});
      }
      const revisionRestore=/^\/api\/admin\/revisions\/(\d+)\/restore$/.exec(path);
      if(method==="POST" && revisionRestore){
        if(!await rateLimit(request,env,"admin_revert",25))return fail("Demasiadas recuperaciones.",429);
        await ensureHistory(env.DB);
        const row=await env.DB.prepare("SELECT book_id,before_json FROM book_revisions WHERE id=?").bind(Number(revisionRestore[1])).first();
        if(!row)return fail("Versión no encontrada.",404);
        const old=bookInput(JSON.parse(row.before_json));
        // Solo metadatos: nunca alterar un préstamo actual ni resucitar libros retirados.
        const result=await env.DB.prepare(
          "UPDATE books SET isbn=?,title=?,author=?,description=?,cover_url=?,genre=?,audience=?,min_age=?,condition=?,updated_at=datetime('now') WHERE id=? AND removed_at IS NULL"
        ).bind(old.isbn,old.title,old.author,old.description,old.cover_url,old.genre,old.audience,old.min_age,old.condition,row.book_id).run();
        if(!result.meta.changes)return fail("El libro está retirado o ya no existe.",409);
        await log(env.DB,row.book_id,"restaurar_ficha");
        return reply({ok:true});
      }
      const adminMatch=adminBookRegex.exec(path);
      if(adminMatch && method==="POST") {
        await ensureHistory(env.DB);
        if(!await rateLimit(request,env,"admin_change",45)) return fail("Demasiadas modificaciones.",429);
        const removed=adminMatch[2]==="remove";
        const sql=removed
          ? "UPDATE books SET removed_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND removed_at IS NULL"
          : "UPDATE books SET removed_at=NULL,updated_at=datetime('now') WHERE id=? AND removed_at IS NOT NULL";
        const result=await env.DB.prepare(sql).bind(adminMatch[1]).run();
        if(!result.meta.changes) return fail("Este libro ya ha cambiado.",409);
        await log(env.DB,adminMatch[1],removed?"retirado":"restaurado");
        return reply({ok:true});
      }
    }
    return fail("Ruta no encontrada.",404);
  } catch(err) {
    if(err instanceof Error && (/^Introduce|^El ISBN|^Datos no|^La edad|^Envía|^JSON no|^La solicitud/.test(err.message))) return fail(err.message);
    console.error("Biblioteca API error:",err);
    return fail("No hemos podido completar la operación. Inténtalo de nuevo.",500);
  }
 }
};
