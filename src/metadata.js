// Normalización cuidadosa de metadatos públicos de libros.
// Nunca inventamos una edad exacta; es preferible dejar el campo vacío.
export function shortDescription(value) {
  const raw = typeof value === "string" ? value : (value && typeof value.value === "string" ? value.value : "");
  return raw.replace(/<[^>]*>/g," ").replace(/\s+/g," ").replace(/\s+([.,;!?])/g,"$1").trim().slice(0,1500);
}
export function trustedBookCover(value) {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value);
    if (!["https:","http:"].includes(url.protocol)) return "";
    if (!["covers.openlibrary.org","books.google.com","books.googleusercontent.com"].includes(url.hostname.toLowerCase())) return "";
    url.protocol="https:";
    return url.href;
  } catch { return ""; }
}
export function coverById(id) {
  return Number.isInteger(Number(id)) && Number(id)>0 ? "https://covers.openlibrary.org/b/id/"+Number(id)+"-M.jpg" : "";
}
export function inferAudience(subjects=[]) {
  const s=subjects.join(" ").toLowerCase();
  if (/\byoung adult\b|\byoung adults\b|\bteenagers\b|\bjuvenil\b/.test(s) && !/\bjuvenile fiction\b/.test(s)) return "juvenil";
  if (/\bjuvenile (fiction|nonfiction|literature)\b|\bchildren'?s (books|stories|literature|fiction)\b|\bpicture books\b|\bcuentos infantiles\b|\blectura infantil\b/.test(s)) return "infantil";
  return "";
}
export function inferGenre(subjects=[]) {
  const s=subjects.join(" ").toLowerCase();
  const matches=[
    [/\bdinosaur|dinosaurio/, "Dinosaurios"],
    [/\bfantas(y|ia|ía)\b|\bmagic\b|\bmagia\b|\bfairy tale/, "Fantasía"],
    [/\bmystery\b|\bmisterio\b|\bdetective/, "Misterio"],
    [/\bscience fiction\b|\bciencia ficci[oó]n/, "Ciencia ficción"],
    [/\bcomic(s)?\b|\bgraphic novel\b|\btebeo/, "Cómic"],
    [/\badventure\b|\baventura/, "Aventuras"],
    [/\banimals\b|\banimales\b|\bwildlife\b/, "Animales"],
    [/\bscience\b|\bciencia\b|\bexperiments\b/, "Ciencia"],
    [/\bpoetry\b|\bpoes[íi]a\b/, "Poesía"],
    [/\bhistory\b|\bhistoria\b/, "Historia"]
  ];
  return matches.find(([re])=>re.test(s))?.[1] || "";
}
export function fromLegacy(item={},code="") {
  if(!item||typeof item!=="object")return null;
  const subjects=(item.subjects||[]).map(s=>typeof s==="string"?s:s?.name||"").filter(Boolean);
  const cover=trustedBookCover(item.cover?.large||item.cover?.medium||item.cover?.small||item.thumbnail_url);
  return {
    isbn:code,title:item.title||"",author:(item.authors||[]).map(a=>a?.name).filter(Boolean).join(", "),
    description:shortDescription(item.description||item.notes),
    cover_url:cover,genre:inferGenre(subjects),audience:inferAudience(subjects),
    min_age:"",subjects
  };
}
export function fromEdition(edition={},code="") {
  if(!edition||typeof edition!=="object")return null;
  const subjects=(edition.subjects||[]).filter(x=>typeof x==="string");
  return {
    isbn:code,title:edition.title||"",author:"",description:shortDescription(edition.description),
    cover_url:coverById((edition.covers||[])[0]),
    genre:inferGenre(subjects),audience:inferAudience(subjects),min_age:"",subjects
  };
}
export function fromWork(work={},code="") {
  if(!work||typeof work!=="object")return null;
  const subjects=(work.subjects||[]).filter(x=>typeof x==="string");
  return {
    isbn:code,title:work.title||"",author:"",description:shortDescription(work.description),
    cover_url:coverById((work.covers||[])[0]),
    genre:inferGenre(subjects),audience:inferAudience(subjects),min_age:"",subjects
  };
}
export function fromGoogle(items=[],code="") {
  const match=items.find(item=>(item.volumeInfo?.industryIdentifiers||[]).some(x=>String(x.identifier||"").replace(/[\s-]/g,"")===code));
  if(!match)return null;
  const v=match.volumeInfo;
  const cats=Array.isArray(v.categories)?v.categories.filter(x=>typeof x==="string"):[];
  return {isbn:code,title:v.title||"",author:(v.authors||[]).join(", "),
    description:shortDescription(v.description),
    cover_url:trustedBookCover(v.imageLinks?.thumbnail||v.imageLinks?.smallThumbnail),
    genre:inferGenre(cats),audience:inferAudience(cats),min_age:"",subjects:cats};
}
export function mergeBookData(sources=[],code="") {
  const data={isbn:code,title:"",author:"",description:"",cover_url:"",genre:"",audience:"",min_age:""};
  for(const source of sources.filter(Boolean)) for(const field of ["title","author","description","cover_url","genre","audience"]) {
    if(!data[field] && typeof source[field]==="string" && source[field].trim()) data[field]=source[field].trim();
  }
  return data.title ? data : null;
}
