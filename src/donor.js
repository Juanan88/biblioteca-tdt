// Actualización no destructiva: los libros existentes se atribuyen a Anónimo.
// Compatibilidad con D1 ya creada antes de añadir el campo donante.
let ready=false;
let pending=null;
export async function ensureDonorColumn(db){
 if(ready)return;
 if(!pending)pending=(async()=>{
   const columns=await db.prepare("PRAGMA table_info(books)").all();
   if(!(columns.results||[]).some(c=>c.name==="donor_name")){
     try{
       await db.prepare("ALTER TABLE books ADD COLUMN donor_name TEXT NOT NULL DEFAULT 'Anónimo'").run();
     }catch(error){
       // Dos solicitudes pueden intentar migrar la misma base a la vez.
       const after=await db.prepare("PRAGMA table_info(books)").all();
       if(!(after.results||[]).some(c=>c.name==="donor_name"))throw error;
     }
   }
   ready=true;
 })().catch(error=>{pending=null;throw error;});
 return pending;
}
