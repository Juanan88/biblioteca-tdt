const VIEW_STORAGE_KEY="biblioteca-tdt-catalogue-view";
function initialView(){try{return localStorage.getItem(VIEW_STORAGE_KEY)==="list"?"list":"cards";}catch{return "cards";}}
const state={books:[],groups:new Map(),query:"",availableOnly:false,view:initialView(),stream:null,scanStop:false};
const demoBooks=[
 {title:"El monstruo de colores",author:"Anna Llenas",isbn:"9788493987749",min_age:3,genre:"Emociones",status:"available",color:"colors",symbol:"🎨",coverTitle:"EL MONSTRUO<br>DE COLORES"},
 {title:"¿A qué sabe la luna?",author:"Michael Grejniec",isbn:"9788495123619",min_age:3,genre:"Animales",status:"borrowed",color:"moon",symbol:"🌙",coverTitle:"¿A QUÉ SABE<br>LA LUNA?"},
 {title:"Matilda",author:"Roald Dahl",isbn:"9789681903268",min_age:8,genre:"Fantasía",status:"review",color:"magic",symbol:"✨",coverTitle:"MATILDA"}
];
function demoCatalog(query,availableOnly){
 const filtered=demoBooks.filter(b=>(!query||clean([b.title,b.author,b.genre].join(" ")).includes(query))&&(!availableOnly||b.status==="available"));
 if(!filtered.length)return '<div class="empty"><strong>No hay ejemplos disponibles</strong><p>Desactiva «Solo disponibles» o prueba otra búsqueda.</p><button class="button outline" data-action="clear-filters">Quitar filtros</button></div>';
 return '<div class="demo-intro"><span class="demo-intro-icon" aria-hidden="true">✦</span><div><strong>Así se verá nuestra biblioteca</strong><p>Estos tres libros son ejemplos visuales, no están registrados ni disponibles para préstamo. Se ocultarán cuando se añada el primer libro real.</p></div></div>'+
 filtered.map(b=>'<article class="book-card sample-card" aria-label="Ejemplo: '+escapeHtml(b.title)+'">'+
 '<div class="cover-area">'+coverHTML(b,true)+
 '<span class="demo-sticker">EJEMPLO</span><span class="age-tag">+'+b.min_age+' años</span></div>'+
 '<div class="book-info">'+pill(b.status)+'<h3>'+escapeHtml(b.title)+'</h3><p class="author">'+escapeHtml(b.author)+'</p><p class="donor-label">🎁 Donado por Anónimo</p>'+
 '<div class="bottom"><span>'+escapeHtml(b.genre)+'</span><span>Solo demostración</span></div></div></article>').join("");
}

const $ = (s) => document.querySelector(s);
const modal = $("#modal"), content = $("#modal-content");
const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clean = (v) => String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const shortDate = (iso) => {if(!iso) return "";const d=new Date(String(iso).replace(" ","T")+"Z");return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("es-ES",{day:"numeric",month:"short",year:"numeric"}).format(d);};
const due = (date) => date && Date.now()-Date.parse(String(date).replace(" ","T")+"Z") >= 30*86400000;
const pill = (status) => status==="available" ? '<span class="chip">● Disponible</span>' : status==="borrowed" ? '<span class="chip borrowed">● Prestado</span>' : '<span class="chip review">● Por comprobar</span>';
const btn = (text,action,id,style="outline") => '<button class="button '+style+'" data-action="'+action+'" data-id="'+escapeHtml(id)+'">'+text+'</button>';

function isbnCoverURL(book){
 const isbn=String(book.isbn||"").replace(/[\s-]/g,"");
 return /^(?:\d{10}|\d{13})$/.test(isbn)
  ? "https://covers.openlibrary.org/b/isbn/"+isbn+"-M.jpg?default=false"
  : "";
}
function coverURL(book){
 if(typeof book.cover_url==="string" && book.cover_url){
  try{const url=new URL(book.cover_url);
   if(url.protocol==="https:" && ["covers.openlibrary.org","books.google.com","books.googleusercontent.com"].includes(url.hostname.toLowerCase()))return url.href;
  }catch{}
 }
 return isbnCoverURL(book);
}
function coverHTML(book,demo=false){
 const url=coverURL(book);
 const alternative=isbnCoverURL(book);
 const fallback=demo
  ? '<div class="demo-book-cover demo-'+escapeHtml(book.color)+'"'+(url?' hidden':'')+'><span class="demo-cover-symbol" aria-hidden="true">'+escapeHtml(book.symbol)+'</span><strong>'+book.coverTitle+'</strong><small>'+escapeHtml(book.author)+'</small></div>'
  : '<div class="cover-placeholder" aria-hidden="true"'+(url?' hidden':'')+'>✦</div>';
 const backup=(url&&alternative&&url!==alternative)?' data-backup-src="'+escapeHtml(alternative)+'"':"";
 return (url?'<img class="book-cover-image" src="'+escapeHtml(url)+'"'+backup+' alt="Portada de '+escapeHtml(book.title)+'" loading="lazy" referrerpolicy="no-referrer">':"")+fallback;
}
document.addEventListener("error",(event)=>{
 const img=event.target;
 if(img instanceof HTMLImageElement && img.classList.contains("book-cover-image")){
  if(img.dataset.backupSrc){
   const retry=img.dataset.backupSrc;
   delete img.dataset.backupSrc;
   img.src=retry;
   return;
  }
  img.hidden=true;
  const fallback=img.nextElementSibling;
  if(fallback)fallback.hidden=false;
 }
},true);
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

function formError(form,message){
 if(!form || !form.isConnected){flash(message,true);return;}
 let el=form.querySelector(".form-error");
 if(!el){el=document.createElement("p");el.className="form-error";el.setAttribute("role","alert");form.prepend(el);}
 el.textContent=message;el.scrollIntoView({block:"nearest",behavior:"smooth"});
}
function donorName(book){return typeof book?.donor_name==="string" && book.donor_name.trim()?book.donor_name.trim():"Anónimo";}
function donorSummary(books){const unique=[...new Set(books.map(donorName))];return unique.length===1?"Donado por "+unique[0]:"Donantes: "+unique.join(" · ");}
function ageLabel(book){return book.min_age!=null && Number.isFinite(Number(book.min_age))?"Desde "+Number(book.min_age)+" años":"Edad no indicada";}

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
 const booksEl=$("#books");
 booksEl.classList.toggle("demo-mode",state.books.length===0);
 booksEl.classList.toggle("list-mode",state.view==="list");
 $("#only-available").checked=state.availableOnly;
 document.querySelectorAll('[data-action="view-mode"]').forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.view===state.view)));
 $("#count-all").textContent=state.books.length;
 $("#count-free").textContent=state.books.filter(b=>b.status==="available").length;
 $("#count-borrowed").textContent=state.books.filter(b=>b.status==="borrowed").length;
 let groups=[...state.groups.entries()];
 const query=clean(state.query);
 if(state.books.length===0){booksEl.innerHTML=demoCatalog(query,state.availableOnly);return;}
 groups=groups.filter(([key,items])=>{
  const book=items[0], search=[book.title,book.author,book.genre,book.isbn].map(clean).join(" ");
  return (!query||search.includes(query)) && (!state.availableOnly || items.some(b=>b.status==="available"));
 });
 if(!groups.length){
  booksEl.innerHTML='<div class="empty"><div style="font-size:35px" aria-hidden="true">📚</div><strong>No encontramos libros con esos criterios</strong><p>Prueba otra búsqueda o desactiva el filtro.</p><button class="button outline" data-action="clear-filters">Quitar filtros</button></div>';
  return;
 }
 booksEl.innerHTML=groups.map(([key,items])=>{
  const book=items.find(b=>b.cover_url)||items[0],available=items.filter(b=>b.status==="available").length,borrowed=items.filter(b=>b.status==="borrowed").length;
  const status=available ? "available" : borrowed ? "borrowed" : "review";
  return '<button class="book-card" data-action="view" data-key="'+escapeHtml(encodeURIComponent(key))+'" aria-label="Ver '+escapeHtml(book.title)+'">'+
   '<div class="cover-area">'+coverHTML(book)+(book.min_age!=null?'<span class="age-tag">+'+Number(book.min_age)+' años</span>':"")+'</div>'+
   '<div class="book-info">'+pill(status)+'<h3>'+escapeHtml(book.title)+'</h3><p class="author">'+escapeHtml(book.author||"Autor no indicado")+'</p><p class="donor-label">🎁 '+escapeHtml(donorSummary(items))+'</p>'+
   '<div class="bottom"><span>'+(items.length>1?items.length+" ejemplares":escapeHtml(book.genre||book.audience||"Para todos"))+'</span><span>Ver libro →</span></div></div></button>';
 }).join("");
}
async function refresh(){
  try{const data=await api("/api/books");state.books=data.books||[];render();}
  catch(err){$("#books").innerHTML='<div class="empty"><strong>No hemos podido cargar la biblioteca</strong><p>'+escapeHtml(err.message)+'</p><button class="button primary" data-action="reload">Reintentar</button></div>';}
}
function detail(key){
  const items=state.groups.get(key);
  if(!items?.length) return close();
  const book=items.find(b=>b.cover_url)||items[0];
  const free=items.filter(x=>x.status==="available"),borrowed=items.filter(x=>x.status==="borrowed"),review=items.filter(x=>x.status==="review");
  let extra='<div class="detail-summary"><div class="detail-cover">'+coverHTML(book)+'</div><div class="detail-intro"><p class="muted">'+escapeHtml(book.author||"Autor desconocido")+'</p><p class="donor-label">🎁 '+escapeHtml(donorSummary(items))+'</p></div></div>';
  if(book.description)extra+='<p class="dialog-body">'+escapeHtml(book.description)+'</p>';
  extra+='<p class="tiny">'+[book.audience,ageLabel(book),book.genre].filter(Boolean).map(escapeHtml).join(" · ")+'</p>';
  extra+='<hr class="rule"><p><strong>'+items.length+' ejemplar'+(items.length===1?"":"es")+'</strong> · '+free.length+' disponible'+(free.length===1?"":"s")+'</p>';
  if(free.length){
    if(items.length>1)extra+='<p class="tiny">Ejemplar disponible donado por '+escapeHtml(donorName(free[0]))+'</p>';
    extra+='<div class="actions">'+btn("Me lo llevo","borrow",free[0].id,"primary")+
     btn("No encuentro este libro","missing",free[0].id,"outline")+'</div>';
  }
  for(const b of borrowed){
    extra+='<div class="copy-row"><div class="meta"><strong>Prestado a '+escapeHtml(b.borrower_alias||"un vecino")+'</strong><small>Donado por '+escapeHtml(donorName(b))+' · Desde el '+escapeHtml(shortDate(b.borrowed_at))+
    (due(b.borrowed_at)?" · Devolución recomendada":"")+'</small></div>'+btn("Lo he devuelto","return",b.id,"outline")+'</div>';
  }
  for(const b of review){
    extra+='<div class="copy-row"><div class="meta"><strong>Por comprobar</strong><small>Donado por '+escapeHtml(donorName(b))+' · Un vecino no lo encontró en la estantería</small></div>'+btn("Está en la estantería","found",b.id,"outline")+'</div>';
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
    '<div id="camera-region"></div><div id="cover-preview" aria-live="polite"></div>'+
    '<div class="field"><label for="title">Título *</label><input name="title" id="title" maxlength="200" required value="'+val("title")+'"></div>'+
    '<div class="field"><label for="author">Autor</label><input name="author" id="author" maxlength="160" value="'+val("author")+'"></div>'+
    '<div class="field"><label for="donor_name">¿Quién dona el libro? (opcional)</label><input name="donor_name" id="donor_name" maxlength="40" autocomplete="off" placeholder="Nombre o apodo" value="'+(book?.donor_name==="Anónimo"?"":val("donor_name"))+'"><p class="tiny">Si lo dejas vacío, aparecerá «Anónimo». El nombre o apodo será visible para quien visite la biblioteca.</p></div>'+
    '<details class="book-extras" id="extra-book-data" '+(editing?'open':'')+'><summary>Más datos del libro (opcionales)</summary><p class="tiny">Género, edad, conservación y sinopsis: puedes dejarlos vacíos.</p><div class="row-fields"><div class="field"><label for="audience">Categoría</label><select id="audience" name="audience"><option value="">Sin especificar</option>'+["infantil","juvenil","adultos"].map(a=>'<option value="'+a+'" '+(book?.audience===a?"selected":"")+'>'+a[0].toUpperCase()+a.slice(1)+'</option>').join("")+'</select></div>'+
    '<div class="field"><label for="age">Edad mínima orientativa</label><input id="age" name="min_age" type="number" min="0" max="120" placeholder="Opcional" value="'+val("min_age")+'"></div></div>'+
    '<div class="row-fields"><div class="field"><label for="genre">Género</label><input name="genre" id="genre" maxlength="60" value="'+val("genre")+'"></div><div class="field"><label for="condition">Conservación</label><select name="condition" id="condition"><option value="">Sin especificar</option>'+["nuevo","bueno","aceptable","deteriorado"].map(a=>'<option value="'+a+'" '+(book?.condition===a?"selected":"")+'>'+a[0].toUpperCase()+a.slice(1)+'</option>').join("")+'</select></div></div>'+
    '<div class="field"><label for="description">Sinopsis (opcional)</label><textarea id="description" maxlength="1500" name="description">'+escapeHtml(book?.description||"")+'</textarea></div>'+
    '<div class="field"><label for="cover_url">Portada (URL de Open Library o Google Books)</label><input type="url" id="cover_url" name="cover_url" maxlength="600" placeholder="Opcional: https://covers.openlibrary.org/..." value="'+val("cover_url")+'"><p class="tiny">Si la portada recuperada no coincide, puedes corregir el enlace o dejarlo vacío.</p></div></details>'+
    (editing?'':'<label class="dialog-body" style="display:flex;align-items:center;gap:10px"><input type="checkbox" required style="width:18px;height:18px"> Confirmo que ya he dejado este libro en la biblioteca.</label><p id="duplicate" class="notice" hidden></p>')+
    '<div class="actions"><button class="button primary" type="submit">'+(editing?"Guardar cambios":"Añadir a la biblioteca")+'</button></div></form>'));
  if(!editing){
    let isbnTimer=null;
    $("#isbn").addEventListener("input",()=>{
      checkDuplicate();clearTimeout(isbnTimer);
      const value=$("#isbn").value.replace(/[\s-]/g,"").trim();
      if(/^\d{13}$|^\d{9}[\dXx]$/.test(value))isbnTimer=setTimeout(()=>lookup(),650);
    });
  }
  if(book?.cover_url)showCover(book.cover_url);
  $("#cover_url")?.addEventListener("input",event=>showCover(event.target.value));
}
function checkDuplicate(){
  const code=$("#isbn")?.value.replace(/[- ]/g,"")||"";
  const el=$("#duplicate");
  if(!el) return;
  const same=state.books.filter(b=>b.isbn===code&&code);
  el.hidden=!same.length;
  if(same.length)el.textContent="Ya hay "+same.length+" ejemplar(es) de este ISBN. Puedes añadir otro si también lo has dejado en la estantería.";
}
function showCover(url) {
 const box=$("#cover-preview");if(!box)return;
 if(!url){box.innerHTML="";return;}
 // El backend solo admite enlaces HTTPS procedentes de catálogos bibliográficos conocidos.
 try {const parsed=new URL(url);
   if(parsed.protocol!=="https:"||!["covers.openlibrary.org","books.google.com","books.googleusercontent.com"].includes(parsed.hostname))return;
   box.innerHTML='<div class="book-cover-preview"><img src="'+escapeHtml(parsed.href)+'" alt="Portada recuperada" loading="lazy"><p>Portada encontrada automáticamente. Se guardará con el libro.</p></div>';
 }catch{}
}
async function lookup(){
 const code=$("#isbn")?.value.trim();
 const message=$("#isbn-message");if(!code){message.textContent="Introduce un ISBN para buscarlo.";return;}
 message.textContent="Buscando datos…";
 const button=document.querySelector('[data-action="lookup"]');
 if(button)button.disabled=true;
 try{
  const result=await api("/api/isbn?code="+encodeURIComponent(code));
  if($("#isbn")?.value.trim()!==code)return; // Ignorar respuestas de un ISBN anterior.
  if(!result.book){message.textContent=result.warning||"No hemos encontrado ese ISBN. Escribe el título manualmente.";return;}
  const book=result.book;
  let filled=0,kept=0;
  for(const field of ["title","author","description","cover_url","genre"]){
   const el=document.getElementById(field);
   if(!el||!book[field])continue;
   if(el.value.trim()){if(el.value.trim()!==book[field].trim())kept++;continue;}
   el.value=book[field];filled++;
  }
  const audience=$("#audience");
  if(audience && !audience.value && ["infantil","juvenil","adultos"].includes(book.audience)){audience.value=book.audience;filled++;}
  const age=$("#age");
  if(age && !age.value && book.min_age!=="" && book.min_age!=null){age.value=book.min_age;filled++;}
  showCover($("#cover_url")?.value);
  const extras=$("#extra-book-data");if(extras&&(book.genre||book.audience||book.description||book.cover_url))extras.open=true;
  message.textContent="✓ "+filled+" campos completados."+ (kept?" He respetado "+kept+" datos que ya habías escrito.":"")+
   (book.min_age==null||book.min_age===""?" La edad no estaba disponible: puedes indicarla o dejarla vacía.":"");
  checkDuplicate();
 }catch(err){message.textContent=err.message;}
 finally{if(button)button.disabled=false;}
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
  genre:data.genre,audience:data.audience,min_age:data.min_age,condition:data.condition,donor_name:data.donor_name||""};
 const duplicate=state.books.filter(b=>values.isbn&&b.isbn===values.isbn);
 if(!editing&&duplicate.length && !window.confirm("Ya existe este ISBN. ¿Has dejado otro ejemplar diferente en la biblioteca?"))return;
 try{
  await api(editing?"/api/books/"+editing:"/api/books",{method:editing?"PATCH":"POST",body:JSON.stringify(values)});
  close();await refresh();flash(editing?"Ficha actualizada.":"¡Gracias! El libro ya aparece en el catálogo.");
 }catch(err){formError(form,err.message);}
}
async function admin(){
 try{
  const me=await api("/api/admin/me");
  if(!me.admin){
    show(heading("Administración",'<p class="dialog-body">Esta zona está reservada a los responsables. Los vecinos no necesitan contraseña para usar la biblioteca.</p><form id="login-form"><div class="field"><label for="admin-pass">Contraseña</label><input id="admin-pass" type="password" name="password" autocomplete="current-password" required></div><div class="actions"><button type="submit" class="button primary">Entrar</button></div></form>'));
    return;
  }
  const [list,hist]=await Promise.all([api("/api/admin/books"),api("/api/admin/events")]);
  let html='<div class="admin-tools"><button class="button primary" data-action="backup">⬇ Descargar copia de seguridad</button><button class="button outline" data-action="logout">Cerrar sesión</button></div>'+
  '<p class="tiny">La copia contiene los alias de préstamos actuales. Guárdala de forma privada. Puedes recuperar libros ausentes sin sobrescribir los que ya existan.</p>'+
  '<div class="backup-restore"><label for="backup-file">Recuperar libros ausentes de una copia anterior</label><input type="file" id="backup-file" accept=".json,application/json">'+
  '<button type="button" class="button outline" data-action="restore-backup">Recuperar libros de archivo</button></div>'+
  '<h3>Ejemplares ('+list.books.length+')</h3>';
  for(const b of list.books){
    html+='<div class="admin-row"><span><strong>'+escapeHtml(b.title)+'</strong><small>'+escapeHtml(b.borrower_alias||b.status)+' · Donado por '+escapeHtml(donorName(b))+(b.removed_at?" · Retirado":"")+'</small></span>'+
      btn("Historial","history",b.id,"outline")+btn(b.removed_at?"Restaurar":"Retirar",b.removed_at?"restore":"remove",b.id,b.removed_at?"outline":"danger")+'</div>';
  }
  html+='<h3>Últimos movimientos</h3>';
  for(const item of hist.events)html+='<div class="admin-row"><span>'+escapeHtml(item.title||"Libro no disponible")+'<small>'+escapeHtml(item.action)+' · '+escapeHtml(shortDate(item.occurred_at))+'</small></span></div>';
  show(heading("Administración",html));
 }catch(err){window.alert(err.message);}
}
async function downloadBackup(){
 try{
  const data=await api("/api/admin/backup");
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="biblioteca-tdt-"+new Date().toISOString().slice(0,10)+".json";
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
 }catch(err){flash(err.message,true);if(modal.open){const host=modal.querySelector(".backup-restore");if(host)formError(host,err.message);}}
}
async function restoreBackup(){
 const file=$("#backup-file")?.files?.[0];
 if(!file){formError($(".backup-restore"),"Selecciona un archivo JSON de copia de seguridad.");return;}
 if(file.size>3000000){formError($(".backup-restore"),"El archivo supera el tamaño permitido (3 MB).");return;}
 try{
  const backup=JSON.parse(await file.text());
  if(backup.format!=="biblioteca-tdt"||backup.version!==1||!Array.isArray(backup.books))throw new Error("Este archivo no es una copia válida de Biblioteca TDT.");
  if(!confirm("¿Recuperar hasta "+backup.books.length+" libros de esta copia? Solo se añadirán los ejemplares que falten, sin sobrescribir los actuales."))return;
  const result=await api("/api/admin/backup/restore",{method:"POST",body:JSON.stringify({confirmation:"RESTAURAR",backup})});
  await refresh();await admin();
  flash("Recuperados: "+result.added+". Ya existentes: "+result.skipped+".");
 }catch(err){formError($(".backup-restore"),err.message);}
}
async function bookHistory(id){
 try{
  const data=await api("/api/admin/revisions?book_id="+encodeURIComponent(id));
  const book=state.books.find(b=>b.id===id);
  let html='<p class="tiny">Se guardan cambios de ficha y estado, sin nombres históricos de prestatarios. «Recuperar ficha» restaura solo los metadatos: no cambia préstamos ni disponibilidad.</p>'+
    '<div class="actions"><button class="button outline" data-action="back-admin">← Volver a administración</button></div>';
  if(!data.revisions.length)html+='<p class="dialog-body">Todavía no hay cambios registrados en este ejemplar.</p>';
  for(const rev of data.revisions){
   const before=rev.before||{},after=rev.after||{};
   const changes=["title","author","isbn","description","cover_url","genre","audience","min_age","condition","donor_name","status","removed_at"]
     .filter(field=>JSON.stringify(before[field])!==JSON.stringify(after[field]));
   html+='<div class="admin-row"><span><strong>'+escapeHtml(shortDate(rev.changed_at))+'</strong><small>'+
     escapeHtml(changes.map(field=>({title:"Título",author:"Autor",isbn:"ISBN",description:"Sinopsis",cover_url:"Portada",genre:"Género",audience:"Categoría",min_age:"Edad",condition:"Conservación",donor_name:"Donante",status:"Estado",removed_at:"Retirada"}[field]||field)).join(", ")||"Sin cambios")+
     '</small></span>'+btn("Recuperar ficha","restore-revision",rev.id,"outline")+'</div>';
  }
  show(heading("Historial · "+escapeHtml(book?.title||"Libro"),html));
 }catch(err){flash(err.message,true);}
}
async function restoreRevision(id){
 if(!confirm("¿Restaurar los datos anteriores de esta versión? No se modificarán los préstamos actuales."))return;
 try{await api("/api/admin/revisions/"+id+"/restore",{method:"POST",body:"{}"});await refresh();await admin();flash("Ficha anterior recuperada.");}
 catch(err){alert(err.message);}
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
 if(action==="view-mode"){
  const mode=b.dataset.view;
  if(mode!=="cards"&&mode!=="list")return;
  state.view=mode;
  try{localStorage.setItem(VIEW_STORAGE_KEY,mode);}catch{}
  render();return;
 }
 if(action==="clear-filters"){state.availableOnly=false;state.query="";$("#search").value="";render();return;}
 if(action==="backup")return downloadBackup();
 if(action==="restore-backup")return restoreBackup();
 if(action==="history")return bookHistory(id);
 if(action==="back-admin")return admin();
 if(action==="restore-revision")return restoreRevision(id);
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
 }catch(err){formError(f,err.message);}
 finally{if(submit)submit.disabled=false;}
});
$("#top-add").addEventListener("click",()=>bookForm());
$("#top-admin").addEventListener("click",admin);
$("#search").addEventListener("input",(event)=>{state.query=event.target.value;render();});
$("#only-available").addEventListener("change",(event)=>{state.availableOnly=event.target.checked;render();});
refresh();
