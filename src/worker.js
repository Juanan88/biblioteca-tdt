import { text, isbn, bookInput, aliasInput } from "./core.js";

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
async function bodyOf(request) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) throw new Error("Envía los datos en formato JSON.");
  const raw = await request.text();
  if (raw.length > 12000) throw new Error("La solicitud es demasiado grande.");
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
async function rateLimit(request, env, action, max=45) {
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

async function lookupIsbn(code) {
  // Open Library es gratuito; puede carecer de ciertos libros o metadatos.
  const url="https://openlibrary.org/api/books?bibkeys=ISBN:"+encodeURIComponent(code)+"&format=json&jscmd=data";
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),5500);
  try {
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json"}});
    if(!response.ok) return null;
    const data=await response.json();
    const item=data["ISBN:"+code];
    if(!item || !item.title) return null;
    const cover=item.cover?.medium || item.cover?.small || null;
    const urlCover=typeof cover==="string" && cover.startsWith("https://covers.openlibrary.org/") ? cover : null;
    return {isbn:code,title:item.title,author:(item.authors||[]).map(a=>a.name).filter(Boolean).join(", ")||"",
      description:typeof item.notes==="string" ? item.notes : "",
      cover_url:urlCover, genre:(item.subjects||[])[0]?.name || "", audience:"", min_age:""};
  } finally {clearTimeout(timeout);}
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
      if (!isConfigured(env)) return fail("Falta configurar los secretos de la aplicación.",503);
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
      if(!await rateLimit(request,env,"edit",45)) return fail("Demasiadas modificaciones.",429);
      const input=bookInput(await bodyOf(request));
      const result=await env.DB.prepare("UPDATE books SET isbn=?,title=?,author=?,description=?,cover_url=?,genre=?,audience=?,min_age=?,condition=?,updated_at=datetime('now') WHERE id=? AND removed_at IS NULL")
       .bind(input.isbn,input.title,input.author,input.description,input.cover_url,input.genre,input.audience,input.min_age,input.condition,match[1]).run();
      if(!result.meta.changes) return fail("No encontramos el libro.",404);
      await log(env.DB,match[1],"edicion");
      return reply({ok:true});
    }
    if(match && method==="POST" && match[2]) {
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
        statement="UPDATE books SET status='available',borrower_alias=NULL,borrowed_at=NULL,updated_at=datetime('now') WHERE id=? AND removed_at IS NULL AND status!='available'";
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
        const {results}=await env.DB.prepare(bookSelect+",removed_at FROM books ORDER BY created_at DESC LIMIT 1500").all();
        return reply({books:results});
      }
      if(method==="GET" && path==="/api/admin/events") {
        const {results}=await env.DB.prepare("SELECT events.action,events.occurred_at,books.title FROM events LEFT JOIN books ON books.id=events.book_id ORDER BY events.id DESC LIMIT 80").all();
        return reply({events:results});
      }
      const adminMatch=adminBookRegex.exec(path);
      if(adminMatch && method==="POST") {
        if(!await rateLimit(request,env,"admin_change",45)) return fail("Demasiadas modificaciones.",429);
        const removed=adminMatch[2]==="remove";
        const sql=removed
          ? "UPDATE books SET removed_at=datetime('now'),borrower_alias=NULL,borrowed_at=NULL,status='available',updated_at=datetime('now') WHERE id=? AND removed_at IS NULL"
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
