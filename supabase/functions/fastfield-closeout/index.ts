import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, api-key, x-api-key, content-type, x-aimcg-webhook-secret","content-type":"application/json"};
function decodeBasic(v:string){if(!v.toLowerCase().startsWith("basic "))return null;try{const s=atob(v.slice(6));const i=s.indexOf(":");return i<0?null:{user:s.slice(0,i),pass:s.slice(i+1)};}catch{return null;}}
function authOk(req:Request,expected:string){if(!expected)return false;const vals=[req.headers.get("x-aimcg-webhook-secret"),req.headers.get("x-api-key"),req.headers.get("api-key"),req.headers.get("apikey")];if(vals.some(v=>v===expected))return true;const a=req.headers.get("authorization")||"";if(a.toLowerCase().startsWith("bearer "))return a.slice(7).trim()===expected;const b=decodeBasic(a);return b?.user===expected||b?.pass===expected;}
function safeName(n:string){return (n||"FastField Job Close-Out.pdf").replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,180);}
async function sha256(bytes:Uint8Array){const hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{
    if(req.method!=="POST")return new Response(JSON.stringify({ok:false,error:"POST required"}),{status:405,headers:corsHeaders});
    const expected=Deno.env.get("FASTFIELD_WEBHOOK_SECRET")||"";
    if(!authOk(req,expected))return new Response(JSON.stringify({ok:false,error:"Unauthorized"}),{status:401,headers:corsHeaders});
    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
    const contentType=req.headers.get("content-type")||"";
    let file:File|null=null;let payload:Record<string,unknown>={};let fileName="FastField Job Close-Out.pdf";let externalId="";
    if(contentType.includes("multipart/form-data")){
      const form=await req.formData();
      for(const [key,value] of form.entries()){
        if(value instanceof File&&!file){file=value;fileName=value.name||fileName;}
        else payload[key]=String(value);
      }
      externalId=String(payload.submission_id||payload.submissionId||payload.id||"");
    }else if(contentType.includes("application/pdf")||contentType.includes("octet-stream")){
      const bytes=new Uint8Array(await req.arrayBuffer());fileName=req.headers.get("x-file-name")||fileName;file=new File([bytes],fileName,{type:"application/pdf"});externalId=req.headers.get("x-submission-id")||"";
    }else{
      payload=await req.json();
      externalId=String(payload.submission_id||payload.submissionId||payload.id||"");
    }
    let bucket:string|null=null,path:string|null=null,size=0,hash="";let bytes:Uint8Array|null=null;
    if(file){bytes=new Uint8Array(await file.arrayBuffer());size=bytes.length;hash=await sha256(bytes);externalId=externalId||hash;fileName=safeName(fileName);bucket="fastfield-closeouts";path=`${new Date().getUTCFullYear()}/${externalId}/${fileName}`;}
    externalId=externalId||crypto.randomUUID();
    const record={external_submission_id:externalId,form_name:"Job Sign Off - Completed Works",raw_payload:{source:"fastfield_pdf_webhook",media_omitted:false,received_content_type:contentType,received_content_length:req.headers.get("content-length"),file_hash:hash||null},processing_status:path?"storing_pdf":"received",match_status:"unmatched",pdf_bucket:null,pdf_object_path:null,pdf_file_name:fileName,source_file_size:size||null,error_message:null,updated_at:new Date().toISOString()};
    const {data,error}=await client.from("fastfield_submissions").upsert(record,{onConflict:"external_submission_id"}).select("id").single();if(error)throw error;
    if(bytes&&bucket&&path){
      const storeTask=(async()=>{try{const {error:uploadError}=await client.storage.from(bucket!).upload(path!,bytes!,{contentType:"application/pdf",upsert:true});if(uploadError)throw uploadError;await client.from("fastfield_submissions").update({pdf_bucket:bucket,pdf_object_path:path,processing_status:"parsing_pending",error_message:null,updated_at:new Date().toISOString()}).eq("id",data.id);}catch(e){console.error(e);await client.from("fastfield_submissions").update({processing_status:"storage_failed",error_message:e instanceof Error?e.message:String(e),updated_at:new Date().toISOString()}).eq("id",data.id);}})();
      const runtime=(globalThis as any).EdgeRuntime;if(runtime?.waitUntil)runtime.waitUntil(storeTask);else await storeTask;
    }
    return new Response(JSON.stringify({ok:true,submission_id:data.id,match_status:"unmatched",pdf_received:false,processing_status:record.processing_status}),{status:200,headers:corsHeaders});
  }catch(error){console.error(error);return new Response(JSON.stringify({ok:false,error:error instanceof Error?error.message:String(error)}),{status:500,headers:corsHeaders});}
});
