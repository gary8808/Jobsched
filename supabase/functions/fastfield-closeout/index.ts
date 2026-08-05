import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-aimcg-webhook-secret" };

function flatten(value: unknown, prefix = "", out: Record<string, unknown> = {}) {
  if (Array.isArray(value)) value.forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
  else if (value && typeof value === "object") Object.entries(value as Record<string, unknown>).forEach(([k,v]) => flatten(v, prefix ? `${prefix}.${k}` : k, out));
  else out[prefix] = value;
  return out;
}
function normKey(s:string){return s.toLowerCase().replace(/[^a-z0-9]/g,"");}
function pick(flat:Record<string,unknown>, aliases:string[]){
  const wanted=aliases.map(normKey);
  const entry=Object.entries(flat).find(([k])=>wanted.some(a=>normKey(k).endsWith(a)));
  return entry?.[1] == null ? "" : String(entry[1]).trim();
}
function normaliseJobNumber(value:string){return value.toUpperCase().trim().replace(/^J(?=\d)/,"").replace(/[^0-9]/g,"");}
function boolValue(value:string){const v=value.toLowerCase(); if(["yes","true","1","complete","completed"].includes(v))return true;if(["no","false","0","incomplete"].includes(v))return false;return null;}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const expected=Deno.env.get("FASTFIELD_WEBHOOK_SECRET")||"";
    if(expected && req.headers.get("x-aimcg-webhook-secret")!==expected) return new Response("Unauthorized",{status:401,headers:corsHeaders});
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const contentType=req.headers.get("content-type")||"";
    let payload:any={}; let pdfBytes:Uint8Array|null=null; let pdfName="FastField Job Close-Out.pdf";
    if(contentType.includes("multipart/form-data")){
      const form=await req.formData();
      for(const [key,val] of form.entries()){
        if(val instanceof File){ if(val.type==="application/pdf"||val.name.toLowerCase().endsWith(".pdf")){pdfBytes=new Uint8Array(await val.arrayBuffer());pdfName=val.name;} }
        else payload[key]=val;
      }
    } else if(contentType.includes("application/pdf")){
      pdfBytes=new Uint8Array(await req.arrayBuffer());
      pdfName=req.headers.get("x-file-name")||pdfName;
      payload={job_number:req.headers.get("x-job-number"),work_order_number:req.headers.get("x-work-order-number"),submission_id:req.headers.get("x-submission-id")};
    } else payload=await req.json();

    const flat=flatten(payload);
    const externalId=pick(flat,["submissionid","submission_id","id","uuid"])||crypto.randomUUID();
    const formName=pick(flat,["formname","form_name","formtitle","form_title"])||"Job Sign Off - Completed Works";
    const formId=pick(flat,["formid","form_id"]);
    const rawJob=pick(flat,["jobnumberonly","job_number_only","jobnumber","job_number"]);
    const normalisedJob=normaliseJobNumber(rawJob);
    const workOrder=pick(flat,["workordernumbersodexoonly","work_order_number_sodexo_only","workordernumber","work_order_number"]);
    const reference=pick(flat,["referenceasperjobsheet","reference_as_per_job_sheet","reference"]);
    const submittedEmail=pick(flat,["submittedby","submitted_by","email"]);
    const submittedName=pick(flat,["name","submittedbyname","submitted_by_name"]);
    const submittedAt=pick(flat,["datesubmitted","date_submitted","submittedat","submitted_at"]);
    const overall=boolValue(pick(flat,["istheoveralljobcomplete","overalljobcomplete","overall_job_complete"]));
    const tradeComplete=boolValue(pick(flat,["areyourpartoftheworkscomplete","tradeworkcomplete","trade_work_complete"]));
    const furtherText=pick(flat,["iftheoveralljobisnotcompletepleasestatewhatslefttofinish","furtherworkdescription","further_work_text"]);
    const additionalTrade=boolValue(pick(flat,["isthereanyadditionalworkstobecompletedbyanothertrade","additionaltraderequired","additional_trade_required"]));
    const requiredTrade=pick(flat,["ifadditionalworksarelefttobecompletedbyothertradespleasestateifknown","requiredtrade","required_trade"]);
    const supervisorChecked=boolValue(pick(flat,["hasyouraimconstructiongroupsupervisorbeenaroundtocheckyourworks","supervisorchecked","supervisor_checked"]));
    const furtherWork=Boolean(furtherText)||additionalTrade===true;

    let job:any=null;
    if(normalisedJob){
      const {data:candidates}=await supabase.from("jobs").select("id,job_number,work_order_number,title").ilike("job_number",`%${normalisedJob}%`).limit(20);
      const exact=(candidates||[]).filter((j:any)=>normaliseJobNumber(j.job_number||"")===normalisedJob);
      const confirmed=workOrder?exact.filter((j:any)=>String(j.work_order_number||"").replace(/\s/g,"")===workOrder.replace(/\s/g,"")):exact;
      if(confirmed.length===1) job=confirmed[0]; else if(exact.length===1&&!workOrder) job=exact[0];
    }

    let pdfBucket:string|null=null,pdfPath:string|null=null;
    if(!pdfBytes&&payload.pdf_base64){pdfBytes=Uint8Array.from(atob(String(payload.pdf_base64).replace(/^data:application\/pdf;base64,/,"")),c=>c.charCodeAt(0));}
    if(!pdfBytes&&payload.pdf_url){const r=await fetch(String(payload.pdf_url));if(r.ok)pdfBytes=new Uint8Array(await r.arrayBuffer());}
    if(pdfBytes){pdfBucket="fastfield-closeouts";pdfPath=`${new Date().getUTCFullYear()}/${externalId}/${pdfName.replace(/[^a-zA-Z0-9._-]/g,"_")}`;const {error}=await supabase.storage.from(pdfBucket).upload(pdfPath,pdfBytes,{contentType:"application/pdf",upsert:true});if(error)throw error;}

    const record:any={external_submission_id:externalId,form_name:formName,form_id:formId||null,job_id:job?.id||null,raw_job_number:rawJob||null,normalised_job_number:normalisedJob||null,work_order_number:workOrder||null,reference_text:reference||null,submitted_by_email:submittedEmail||null,submitted_by_name:submittedName||null,submitted_at:submittedAt?new Date(submittedAt).toISOString():null,overall_job_complete:overall,trade_work_complete:tradeComplete,further_work_identified:furtherWork,further_work_text:furtherText||null,additional_trade_required:additionalTrade,required_trade:requiredTrade||null,supervisor_checked:supervisorChecked,closeout_summary:{overall_job_complete:overall,trade_work_complete:tradeComplete,further_work_identified:furtherWork,additional_trade_required:additionalTrade,supervisor_checked:supervisorChecked},raw_payload:payload,processing_status:pdfPath?(job?"attached":"stored_unmatched"):(job?"pdf_pending":"received"),match_status:job?"matched":"unmatched",pdf_bucket:pdfBucket,pdf_object_path:pdfPath,pdf_file_name:pdfName,error_message:null,updated_at:new Date().toISOString()};
    const {data:submission,error:upsertError}=await supabase.from("fastfield_submissions").upsert(record,{onConflict:"external_submission_id"}).select("*").single();if(upsertError)throw upsertError;
    if(job&&pdfPath){
      const {data:attachment,error:attError}=await supabase.from("attachments").upsert({job_id:job.id,worker_id:null,bucket:pdfBucket,object_path:pdfPath,file_name:pdfName,mime_type:"application/pdf",size_bytes:pdfBytes?.length||0,attachment_type:"fastfield_closeout",label:"FastField Job Close-Out",uploaded_by:null},{onConflict:"bucket,object_path"}).select("id").single();if(attError)throw attError;
      await supabase.from("fastfield_submissions").update({attachment_id:attachment.id,processing_status:"attached",updated_at:new Date().toISOString()}).eq("id",submission.id);
      await supabase.from("job_history").insert({job_id:job.id,action:"FastField close-out received",details:`Close-out ${externalId} received${furtherWork?"; further work was identified":""}.`,created_by:null});
    }
    return new Response(JSON.stringify({ok:true,submission_id:submission.id,match_status:job?"matched":"unmatched",job_id:job?.id||null,pdf_received:Boolean(pdfPath),further_work_identified:furtherWork}),{headers:{...corsHeaders,"content-type":"application/json"}});
  } catch(error){console.error(error);return new Response(JSON.stringify({ok:false,error:error instanceof Error?error.message:String(error)}),{status:500,headers:{...corsHeaders,"content-type":"application/json"}});}
});
