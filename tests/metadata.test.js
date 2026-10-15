import test from "node:test";
import assert from "node:assert/strict";
import {shortDescription, trustedBookCover, coverById, inferAudience, inferGenre, fromLegacy, fromEdition, fromWork, fromGoogle, mergeBookData} from "../src/metadata.js";

test("description acepta texto de Work o edition y elimina HTML",()=>{
 assert.equal(shortDescription({value:"<p>Cuento infantil</p> sobre <b>amistad</b>."}),"Cuento infantil sobre amistad.");
 assert.equal(shortDescription(null),"");
});
test("solo se aceptan portadas de catálogos confiables",()=>{
 assert.equal(trustedBookCover("http://books.google.com/books/content?id=123"),"https://books.google.com/books/content?id=123");
 assert.equal(trustedBookCover("javascript:alert(1)"),"");
 assert.equal(trustedBookCover("https://notbooks.example.com/img"),"");
 assert.equal(coverById(123),"https://covers.openlibrary.org/b/id/123-M.jpg");
});
test("deduce categoría infantil o juvenil solo desde materias",()=>{
 assert.equal(inferAudience(["Juvenile Fiction", "Fantasy"]), "infantil");
 assert.equal(inferAudience(["Young Adult Fiction"]), "juvenil");
 assert.equal(inferAudience(["Children's stories"]), "infantil");
 assert.equal(inferAudience(["Fantasy", "Adventure"]), "");
 assert.equal(inferGenre(["Dinosaurs", "Adventure stories"]), "Dinosaurios");
});
test("la ficha de obra proporciona sinopsis y portada si la edición carece de ellas",()=>{
 const edition=fromEdition({title:"Cuentos increíbles",works:[{key:"/works/OL123W"}]}, "9780306406157");
 const work=fromWork({description:{value:"Una historia maravillosa."},covers:[4242],subjects:["Juvenile Fiction","Adventure stories"]},"9780306406157");
 const combined=mergeBookData([edition,work],"9780306406157");
 assert.equal(combined.description,"Una historia maravillosa.");
 assert.equal(combined.cover_url,"https://covers.openlibrary.org/b/id/4242-M.jpg");
 assert.equal(combined.genre,"Aventuras");
 assert.equal(combined.audience,"infantil");
 assert.equal(combined.min_age,"");
});
test("conserva la edición correcta, no cualquier libro ofrecido por Google",()=>{
 const items=[{volumeInfo:{title:"Otro libro",industryIdentifiers:[{identifier:"1111111111111"}],description:"Otro"}},
 {volumeInfo:{title:"La edición correcta",industryIdentifiers:[{identifier:"9780306406157"}],description:"Cuento de hadas.",categories:["Juvenile Fiction / Fantasy & Magic"],imageLinks:{thumbnail:"http://books.google.com/books/content?id=2"}}}];
 const found=fromGoogle(items,"9780306406157");
 assert.equal(found.title,"La edición correcta");
 assert.equal(found.description,"Cuento de hadas.");
 assert.equal(found.audience,"infantil");
 assert.equal(found.cover_url,"https://books.google.com/books/content?id=2");
 assert.equal(fromGoogle(items,"9780140328721"),null);
});
test("combinación de fuentes preserva título del ISBN y añade campos disponibles",()=>{
 const edition=fromLegacy({title:"Mi libro",authors:[{name:"Escritora"}]},"9780306406157");
 const google=fromGoogle([{volumeInfo:{industryIdentifiers:[{identifier:"9780306406157"}],title:"Otro título",description:"Su argumento",categories:["Juvenile Fiction"],imageLinks:{thumbnail:"https://books.google.com/books/content?id=abc"}}}],"9780306406157");
 const data=mergeBookData([edition,google],"9780306406157");
 assert.equal(data.title,"Mi libro");
 assert.equal(data.author,"Escritora");
 assert.equal(data.description,"Su argumento");
 assert.equal(data.audience,"infantil");
 assert.equal(data.min_age,"");
});
