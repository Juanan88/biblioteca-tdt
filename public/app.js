const state = {books:[],groups:new Map(),query:"",filter:"all",stream:null,scanStop:false};
const $ = (s) => document.querySelector(s);
const modal = $("#modal"), content = $("#modal-content");
const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clean = (v) => String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const shortDate = (iso) => {if(!iso) return "";const d=new Date(String(iso).replace(" ","T")+"Z");return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",year:"numeric"}).format(d);};
const due = (date) => date && Date.now()-Date.parse(String(date).replace(" ","T")+"Z") >= 30*86400000;
const pill = (status) => status==="available" ? '<span class="chip">● Disponible</span>' : status==="borrowed" ? '<span class="chip borrowed">● Prestado</span>' : '<span class="chip review">● Por comprobar</span>';
const btn = (text,action,id,style="outline") => '<button class="button '+style+'" data-action="'+action+'" data-id="'+escapeHtml(id)+'">'+text+'</button>';
function stopCamera(){
  state.scanStop=true;
  if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null;}
}
function show(html){
  stopCamera();
  if(modal.open)modal.close();
  content.innerHTML=html;
  modal.showModal();
}
function close(){stopCamera();if(modal.open)modal.close();}
modal.addEventListener("close",stopCamera);
function heading(title,body=""){
  return '<div class="dialog-top"><div><h2>'+title+'</h2></div><button class="icon-button" data-action="close" aria-label="Cerrar">×</button></div>'+body;
}
async function api(path,options={}){
  let response;
  try{response=await fetch(path,{headers:{"Content-Type":"application/json"},...options});}
  catch {throw new Error("No hay conexión. Comprueba tu internet e inténtalo de nuevo.");}
  let data;
  try{data=await response.json();}catch{data={};}
  if(!response.ok) throw new Error(data.error||"No se pudo completar la operación.");
  return data;
}
function flash(message,err=false){
  const notice=$("#notice");notice.textContent=message;notice.style.color=err?"#9a3f2a":"#2c7359";
  setTimeout(()=>{if(notice.textContent===message)notice.textContent="";},6500);
}
function keyFor(book){return book.isbn ? "isbn:"+book.isbn : "t:"+clean(book.title)+":"+clean(book.author);}
function regroup(){
  state.groups=new Map();
  for(const book of state.books){
    const key=keyFor(book);
    if(!state.groups.has(key))state.groups.set(key,[]);
    state.groups.get(key).push(book);
  }
}
function render(){
  regroup();
  $("#count-all").textContent=state.books.length;
  $("#count-free").textContent=state.books.filter(b=>b.status==="available").length;
  $("#count-borrowed").textContent=state.books.filter(b=>b.status==="borrowed").length;
  let groups=[...state.groups.entries()];
  const filter=state.filter, query=clean(state.query);
  groups=groups.filter(([key,items])=>{
    const book=items[0];
    const search=[book.title,book.author,book.genre,book.isbn].map(clean).join(" ");
    const hasFree=items.some(b=>b.status==="available");
    return (!query||search.includes(query)) && (filter==="all" || (filter==="available" ? hasFree : book.audience===filter));
  });
  if(!groups.length){
    $("#books").innerHTML='<div class="empty"><div style="font-size:35px">📚</div><strong>No hay libros con esos filtros</strong><p>Prueba otra búsqueda o dona el primero.</p></div>';
    return;
  }
  $("#books").innerHTML=groups.map(([key,items])=>{
    const book=items[0],available=items.filter(b=>b.status==="available").length,borrowed=items.filter(b=>b.status==="borrowed").length;
    const status=available ? "available" : borrowed ? "borrowed" : "review";
    const cover=book.cover_url ? '<img src="'+escapeHtml(book.cover_url)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='+"'"+"none"+"'" + '">'
      : '<div class="cover-placeholder" aria-hidden="true">✦</div>';
    return '<button class="book-card" data-action="view" data-key="'+escapeHtml(encodeURIComponent(key))+'" aria-label="Ver '+escapeHtml(book.title)+'">'+
      '<div class="cover-area">'+cover+'</div><div class="book-info">'+pill(status)+
      '<h3>'+escapeHtml(book.title)+'</h3><p class="author">'+escapeHtml(book.author||"Autor no indicado")+'</p>'+
      '<div class="bottom"><span>'+ (items.length>1 ? items.length+" ejemplares" : escapeHtml(book.audience||"Para todos"))+'</span><span>Ver libro →</span></div></div></button>';
  }).join("");
}
async function refresh(){
  try{const data=await api("/api/books");state.books=data.books||[];render();}
  catch(err){$("#books").innerHTML='<div class="empty"><strong>No hemos podido cargar la biblioteca</strong><p>'+escapeHtml(err.message)+'</p><button class="button primary" data-action="reload">Reintentar</button></div>';}
}
function detail(key){
  const items=state.groups.get(key);
  if(!items?.length) return close();
  const book=items[0];
  const free=items.filter(x=>x.status==="available"),borrowed=items.filter(x=>x.status==="borrowed"),review=items.filter(x=>x.status==="review");
  let extra='<p class="muted">'+escapeHtml(book.author||"Autor desconocido")+'</p>';
  if(book.description)extra+='<p class="dialog-body">'+escapeHtml(book.description)+'</p>';
  extra+='<p class="tiny">'+[book.audience,book.min_age!=null?"Desde "+book.min_age+" años":null,book.genre].filter(Boolean).map(escapeHtml).join(" · ")+'</p>';
  extra+='<hr class="rule"><p><strong>'+items.length+' ejemplar'+(items.length===1?"":"es")+'</strong> · '+free.length+' disponible'+(free.length===1?"":"s")+'</p>';
  if(free.length){
    extra+='<div class="actions">'+btn("Me lo llevo","borrow",free[0].id,"primary")+
     btn("No encuentro este libro","missing",free[0].id,"outline")+'</div>';
  }
  for(const b of borrowed){
    extra+='<div class="copy-row"><div class="meta"><strong>Prestado a '+escapeHtml(b.borrower_alias||"un vecino")+'</strong><small>Desde el '+escapeHtml(shortDate(b.borrowed_at))+
    (due(b.borrowed_at)?" · Devolución recomendada":"")+'</small></div>'+btn("Lo he devuelto","return",b.id,"outline")+'</div>';
    extra+='<div class="actions">'+btn("Está en la estantería","found",b.id,"subtle")+'</div>';
  }
  for(const b of review){
    extra+='<div class="copy-row"><div class="meta"><strong>Por comprobar</strong><small>Un vecino no lo encontró en la estantería</small></div>'+btn("Está en la estantería","found",b.id,"outline")+'</div>';
  }
  extra+='<hr class="rule"><p class="tiny">Si los datos del libro son incorrectos, cualquier vecino puede corregirlos.</p><div class="actions">'+
    btn("Corregir ficha","edit",book.id,"outline")+'</div>';
  show(heading(escapeHtml(book.title),extra));
}
function bookForm(book=null){
  const editing=!!book;
  const val=(name)=>escapeHtml(book?.[name] ?? "");
  show(heading(editing?"Corregir ficha":"Donar un libro",
    '<p class="dialog-body">'+(editing?"Puedes corregir los datos del catálogo. Los préstamos no cambian.":"Solo es necesario identificar el libro y confirmar que ya está en la biblioteca.")+'</p>'+
    '<form id="book-form" '+(editing?'data-edit="'+escapeHtml(book.id)+'"':"")+'>'+
    '<div class="field"><label for="isbn">ISBN (opcional)</label><div class="actions" style="margin:0"><input id="isbn" name="isbn" inputmode="numeric" placeholder="ISBN del libro" value="'+val("isbn")+'" style="flex:1;min-width:140px"><button type="button" class="button outline" data-action="lookup">Buscar datos</button><button type="button" class="button outline" data-action="scan">📷 Escanear</button></div><span id="isbn-message" class="tiny">También puedes escribir el título directamente.</span></div>'+
    '<div id="camera-region"></div>'+
    '<div class="field"><label for="title">Título *</label><input name="title" id="title" maxlength="200" required value="'+val("title")+'"></div>'+
    '<div class="field"><label for="author">Autor</label><input name="author" id="author" maxlength="160" value="'+val("author")+'"></div>'+
    '<div class="row-fields"><div class="field"><label for="audience">Categoría</label><select id="audience" name="audience"><option value="">Sin especificar</option>'+["infantil","juvenil","adultos"].map(a=>'<option value="'+a+'" '+(book?.audience===a?"selected":"")+'>'+a[0].toUpperCase()+a.slice(1)+'</option>').join("")+'</select></div>'+
    '<div class="field"><label for="age">Edad mínima orientativa</label><input id="age" name="min_age" type="number" min="0" max="120" placeholder="Opcional" value="'+val("min_age")+'"></div></div>'+
    '<div class="row-fields"><div class="field"><label for="genre">Género</label><input name="genre" id="genre" maxlength="60" value="'+val("genre")+'"></div><div class="field"><label for="condition">Conservación</label><select name="condition" id="condition"><option value="">Sin especificar</option>'+["nuevo","bueno","aceptable","deteriorado"].map(a=>'<option value="'+a+'" '+(book?.condition===a?"selected":"")+'>'+a[0].toUpperCase()+a.slice(1)+'</option>').join("")+'</select></div></div>'+
    '<div class="field"><label for="description">Sinopsis (opcional)</label><textarea id="description" maxlength="1500" name="description">'+escapeHtml(book?.description||"")+'</textarea></div>'+
    '<input type="hidden" name="cover_url" id="cover_url" value="'+val("cover_url")+'">'+
    (editing?'':'<label class="dialog-body" style="display:flex;align-items:center;gap:10px"><input type="checkbox" required style="width:18px;height:18px"> Confirmo que ya he dejado este libro en la biblioteca.</label><p id="duplicate" class="notice" hidden></p>')+
    '<div class="actions"><button class="button primary" type="submit">'+(editing?"Guardar cambios":"Añadir a la biblioteca")+'</button></div></form>'));
  if(!editing)$("#isbn").addEventListener("input",checkDuplicate);
}
function checkDuplicate(){
  const code=$("#isbn")?.value.replace(/[- ]/g,"")||"";
  const el=$("#duplicate");
  if(!el) return;
  const same=state.books.filter(b=>b.isbn===code&&code);
  el.hidden=!same.length;
  if(same.length)el.textContent="Ya hay "+same.length+" ejemplar(es) de este ISBN. Puedes añadir otro si también lo has dejado en la estantería.";
}
async function lookup(){
 const code=$("#isbn")?.value.trim();
 const message=$("#isbn-message");if(!code){message.textContent="Introduce un ISBN para buscarlo.";return;}
 message.textContent="Buscando información…";
 try{
  const result=await api("/api/isbn?code="+encodeURIComponent(code));
  if(!result.book){message.textContent=result.warning||"No hay datos de este ISBN. Completa el título manualmente.";return;}
  for(const field of ["title","author","description","cover_url","genre"]){
    if(result.book[field] && document.getElementById(field))document.getElementById(field).value=result.book[field];
  }
  message.textContent="Datos recuperados. Puedes corregirlos antes de guardar.";checkDuplicate();
 }catch(err){message.textContent=err.message;}
}
async function scan(){
 const field=$("#isbn-message"),region=$("#camera-region");
 if(!window.BarcodeDetector||!navigator.mediaDevices?.getUserMedia){field.textContent="Este navegador no admite el escaneo. Introduce el ISBN manualmente.";return;}
 try{
  state.scanStop=false;
  const detector=new BarcodeDetector({formats:["ean_13","ean_8"]});
  state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
  region.innerHTML='<div class="notice">Apunta al código de barras del libro. <button class="button outline" data-action="stop-scan">Detener cámara</button></div><video id="scan-video" autoplay playsinline muted style="width:100%;max-height:220px"></video>';
  const video=$("#scan-video");video.srcObject=state.stream;await video.play();
  const started=Date.now();
  while(!state.scanStop && Date.now()-started<22000){
    try{const codes=await detector.detect(video);const candidate=codes.find(c=>/^\d{13}$/.test(c.rawValue));
      if(candidate){$("#isbn").value=candidate.rawValue;stopCamera();region.innerHTML="";await lookup();return;}}catch{}
    await new Promise(r=>setTimeout(r,350));
  }
  stopCamera();region.innerHTML="";field.textContent="No se detectó el código. Introdúcelo manualmente.";
 }catch{stopCamera();region.innerHTML="";field.textContent="No se pudo abrir la cámara. Introduce el ISBN manualmente.";}
}
function borrowForm(id){
 show(heading("Me lo llevo",
  '<p class="dialog-body">¡Qué buena elección! Escribe solo tu nombre de pila o un alias. <strong>Será visible para cualquiera que tenga el enlace de la biblioteca.</strong> No pongas apellidos ni datos de contacto.</p>'+
  '<form id="borrow-form" data-id="'+escapeHtml(id)+'"><div class="field"><label for="borrower">Tu nombre o alias</label><input id="borrower" name="name" maxlength="40" minlength="2" autocomplete="off" placeholder="Por ejemplo, María" required autofocus></div>'+
  '<div class="actions"><button type="submit" class="button primary">Confirmar préstamo</button></div></form>'));
 $("#borrower").focus();
}
async function move(action,id){
 const book=state.books.find(b=>b.id===id),key=book?keyFor(book):"";
 if(!book)return;
 if(action==="borrow"){borrowForm(id);return;}
 const messages={return:"¿Has dejado el libro en la estantería?",missing:"¿No encuentras el libro en la estantería?",found:"¿Confirmas que el libro está físicamente en la estantería?"};
 if(!window.confirm(messages[action]))return;
 try{await api("/api/books/"+encodeURIComponent(id)+"/"+action,{method:"POST",body:"{}"});close();await refresh();flash("Disponibilidad actualizada.");if(state.groups.has(key))detail(key);}
 catch(err){window.alert(err.message);}
}
async function submitBook(form){
 const editing=form.dataset.edit;
 const data=Object.fromEntries(new FormData(form).entries());
 const values={isbn:data.isbn||null,title:data.title,author:data.author,description:data.description,cover_url:data.cover_url,
  genre:data.genre,audience:data.audience,min_age:data.min_age,condition:data.condition};
 const duplicate=state.books.filter(b=>values.isbn&&b.isbn===values.isbn);
 if(!editing&&duplicate.length && !window.confirm("Ya existe este ISBN. ¿Has dejado otro ejemplar diferente en la biblioteca?"))return;
 try{
  await api(editing?"/api/books/"+editing:"/api/books",{method:editing?"PATCH":"POST",body:JSON.stringify(values)});
  close();await refresh();flash(editing?"Ficha actualizada.":"¡Gracias! El libro ya aparece en el catálogo.");
 }catch(err){window.alert(err.message);}
}
async function admin(){
 try{
  const me=await api("/api/admin/me");
  if(!me.admin){
    show(heading("Administración",'<p class="dialog-body">Esta zona está reservada a los responsables. Los vecinos no necesitan contraseña para usar la biblioteca.</p><form id="login-form"><div class="field"><label for="admin-pass">Contraseña</label><input id="admin-pass" type="password" name="password" autocomplete="current-password" required></div><div class="actions"><button type="submit" class="button primary">Entrar</button></div></form>'));
    return;
  }
  const [list,hist]=await Promise.all([api("/api/admin/books"),api("/api/admin/events")]);
  let html='<div class="actions"><button class="button outline" data-action="logout">Cerrar sesión</button></div><h3>Ejemplares ('+list.books.length+')</h3>';
  for(const b of list.books){
    html+='<div class="admin-row"><span><strong>'+escapeHtml(b.title)+'</strong><small>'+escapeHtml(b.borrower_alias||b.status)+(b.removed_at?" · Retirado":"")+'</small></span>'+
      btn(b.removed_at?"Restaurar":"Retirar",b.removed_at?"restore":"remove",b.id,b.removed_at?"outline":"danger")+'</div>';
  }
  html+='<h3>Últimos movimientos</h3>';
  for(const item of hist.events)html+='<div class="admin-row"><span>'+escapeHtml(item.title||"Libro no disponible")+'<small>'+escapeHtml(item.action)+' · '+escapeHtml(shortDate(item.occurred_at))+'</small></span></div>';
  show(heading("Administración",html));
 }catch(err){window.alert(err.message);}
}
async function adminChange(id,action){
 if(action==="remove"&&!confirm("¿Retirar este ejemplar del catálogo? Podrás restaurarlo después."))return;
 try{await api("/api/admin/books/"+id+"/"+action,{method:"POST",body:"{}"});await refresh();await admin();}
 catch(err){alert(err.message);}
}
document.addEventListener("click",async(event)=>{
 const b=event.target.closest("[data-action]");
 if(!b)return;
 const action=b.dataset.action,id=b.dataset.id;
 if(action==="close")return close();
 if(action==="reload")return refresh();
 if(action==="view")return detail(decodeURIComponent(b.dataset.key));
 if(action==="borrow"||action==="return"||action==="missing"||action==="found")return move(action,id);
 if(action==="edit")return bookForm(state.books.find(b=>b.id===id));
 if(action==="lookup")return lookup();
 if(action==="scan")return scan();
 if(action==="stop-scan"){stopCamera();$("#camera-region").innerHTML="";return;}
 if(action==="remove"||action==="restore")return adminChange(id,action);
 if(action==="logout"){await api("/api/admin/logout",{method:"POST",body:"{}"});close();return;}
});
document.addEventListener("submit",async(event)=>{
 const f=event.target;
 if(!["book-form","borrow-form","login-form"].includes(f.id))return;
 event.preventDefault();
 const submit=f.querySelector('[type="submit"]');if(submit){submit.disabled=true;}
 try{
  if(f.id==="book-form")await submitBook(f);
  if(f.id==="borrow-form"){
    const book=state.books.find(b=>b.id===f.dataset.id);const key=book?keyFor(book):"";
    await api("/api/books/"+f.dataset.id+"/borrow",{method:"POST",body:JSON.stringify({name:new FormData(f).get("name")})});
    close();await refresh();flash("¡Disfruta la lectura! Recuerda devolver el libro cuando termines.");if(state.groups.has(key))detail(key);
  }
  if(f.id==="login-form"){await api("/api/admin/login",{method:"POST",body:JSON.stringify({password:new FormData(f).get("password")})});await admin();}
 }catch(err){alert(err.message);}
 finally{if(submit)submit.disabled=false;}
});
for(const id of ["top-add","hero-add","inline-add"])$("#"+id).addEventListener("click",()=>bookForm());
$("#top-admin").addEventListener("click",admin);
$("#search").addEventListener("input",(event)=>{state.query=event.target.value;render();});
$("#filter").addEventListener("change",(event)=>{state.filter=event.target.value;render();});
refresh();
