import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders={"content-type":"application/json"};
function authOk(req:Request, expected:string){
  if(!expected)return false;
  const values=[req.headers.get("x-aimcg-import-secret"),req.headers.get("x-api-key"),req.headers.get("api-key"),req.headers.get("apikey")];
  if(values.some(v=>v===expected))return true;
  const auth=req.headers.get("authorization")||"";
  if(auth.toLowerCase().startsWith("bearer "))return auth.slice(7).trim()===expected;
  if(auth.toLowerCase().startsWith("basic ")){try{const s=atob(auth.slice(6));const [,password]=s.split(/:(.*)/s);return s.split(":")[0]===expected||password===expected;}catch{return false;}}
  return false;
}
function safeName(name:string){return (name||"Tradify Job Pack.pdf").replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,180);}
async function sha256(bytes:Uint8Array){const hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");}
Deno.serve(async req=>{
  try{
    if(req.method!=="POST")return new Response(JSON.stringify({ok:false,error:"POST required"}),{status:405,headers:jsonHeaders});
    const expected=Deno.env.get("JOB_PACK_IMPORT_SECRET")||"";
    if(!authOk(req,expected))return new Response(JSON.stringify({ok:false,error:"Unauthorized"}),{status:401,headers:jsonHeaders});
    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const type=req.headers.get("content-type")||"";
    let file:File|null=null; let name=req.headers.get("x-file-name")||"Tradify Job Pack.pdf"; let external=req.headers.get("x-import-id")||"";
    if(type.includes("multipart/form-data")){
      const form=await req.formData();
      for(const [key,value] of form.entries()){
        if(value instanceof File&&!file){file=value;name=value.name||name;}
        else if(key==="file_name")name=String(value);
        else if(["import_id","id","external_id"].includes(key))external=String(value);
      }
    }else{
      const bytes=new Uint8Array(await req.arrayBuffer());
      file=new File([bytes],name,{type:type.includes("pdf")?type:"application/pdf"});
    }
    if(!file)throw new Error("No PDF file was supplied");
    const bytes=new Uint8Array(await file.arrayBuffer());
    const hash=await sha256(bytes); external=external||hash;
    const fileName=safeName(name);const path=`${new Date().getUTCFullYear()}/${external}/${fileName}`;
    const {error:uploadError}=await client.storage.from("job-pack-imports").upload(path,bytes,{contentType:"application/pdf",upsert:true});
    if(uploadError)throw uploadError;
    const {data,error}=await client.from("job_pack_imports").upsert({external_import_id:external,source:"power_automate",original_file_name:fileName,source_file_size:bytes.length,file_hash:hash,storage_bucket:"job-pack-imports",storage_object_path:path,processing_status:"received",import_status:"pending",updated_at:new Date().toISOString()},{onConflict:"external_import_id"}).select("id,import_status").single();
    if(error)throw error;
    return new Response(JSON.stringify({ok:true,import_id:data.id,status:data.import_status,file_name:fileName}),{status:200,headers:jsonHeaders});
  }catch(error){console.error(error);return new Response(JSON.stringify({ok:false,error:error instanceof Error?error.message:String(error)}),{status:500,headers:jsonHeaders});}
});
