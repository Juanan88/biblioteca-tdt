// Helpers puros, compartidos con tests. Todo dato recibido se valida en el servidor.
export function text(value, maximum = 200) {
  if (typeof value !== "string") return null;
  const valueTrimmed = value.trim().replace(/\s+/g, " ");
  if (!valueTrimmed || valueTrimmed.length > maximum) return null;
  return valueTrimmed;
}
export function isbn(value) {
  if (typeof value !== "string") return null;
  const clean = value.toUpperCase().replace(/[ -]/g, "");
  if (!/^(\d{9}[\dX]|\d{13})$/.test(clean)) return null;
  if (clean.length === 10) {
    const sum = [...clean].reduce((total, char, index) => total + (10 - index) * (char === "X" ? 10 : Number(char)), 0);
    return sum % 11 === 0 ? clean : null;
  }
  const sum = [...clean].reduce((total, char, index) => total + Number(char) * (index % 2 ? 3 : 1), 0);
  return sum % 10 === 0 ? clean : null;
}
export function optionalText(value,limit,label){
 if(value==null||value==="")return null;
 if(typeof value!=="string")throw new Error(label+" no es válido.");
 if(value.trim().length>limit)throw new Error(label+" supera "+limit+" caracteres.");
 return text(value,limit);
}
export function bookInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Datos no válidos.");
  const title = text(input.title, 200);
  if (!title) throw new Error("Introduce un título de hasta 200 caracteres.");
  let code = null;
  if (input.isbn !== "" && input.isbn != null) {
    code = isbn(input.isbn);
    if (!code) throw new Error("El ISBN no es válido.");
  }
  if(input.audience!=null && input.audience!=="" && !["infantil","juvenil","adultos"].includes(input.audience))throw new Error("La categoría no es válida.");
  if(input.condition!=null && input.condition!=="" && !["nuevo","bueno","aceptable","deteriorado"].includes(input.condition))throw new Error("La conservación no es válida.");
  const audience = ["infantil", "juvenil", "adultos"].includes(input.audience) ? input.audience : null;
  const condition = ["nuevo", "bueno", "aceptable", "deteriorado"].includes(input.condition) ? input.condition : null;
  const age = (input.min_age === "" || input.min_age == null) ? null : Number(input.min_age);
  if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120)) throw new Error("La edad no es válida.");
  const rawCover = optionalText(input.cover_url,600,"La dirección de la portada");
  let cover_url = null;
  if (rawCover) {
    let parsed;
    try {parsed=new URL(rawCover);}catch {throw new Error("La dirección de la portada no es una URL válida.");}
    const host=parsed.hostname.toLowerCase();
    if(parsed.protocol!=="https:"||!["covers.openlibrary.org","books.google.com","books.googleusercontent.com"].includes(host))
      throw new Error("La portada debe venir de Open Library o Google Books y usar HTTPS.");
    cover_url=parsed.href;
  }
  return {
    isbn: code, title,
    author: optionalText(input.author,160,"El autor"),
    description: optionalText(input.description,1500,"La sinopsis"),
    cover_url,
    genre: optionalText(input.genre,60,"El género"),
    audience, min_age: age, condition
  };
}
export function aliasInput(value) {
  const valueTrimmed = text(value, 40);
  if (!valueTrimmed || valueTrimmed.length < 2 || /[<>\r\n]/.test(valueTrimmed)) throw new Error("Introduce un nombre o alias de 2 a 40 caracteres.");
  return valueTrimmed;
}
export function recommendedReturn(iso, now = Date.now()) {
  if (!iso) return false;
  const timestamp = Date.parse(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return Number.isFinite(timestamp) && (now - timestamp >= 30 * 86400000);
}
