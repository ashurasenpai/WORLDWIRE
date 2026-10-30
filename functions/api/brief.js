function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}})}
export async function onRequestPost({request,env}){
  const base=(env.FREE_LLM_API_BASE||"").replace(/\/$/,"");
  const key=env.FREE_LLM_API_KEY;
  if(!base||!key) return json({error:"AI briefing is not configured. Add FREE_LLM_API_BASE and FREE_LLM_API_KEY as Cloudflare Pages secrets."},503);
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
  const articles=Array.isArray(body.articles)?body.articles.slice(0,8):[];
  if(!articles.length)return json({error:"Provide at least one article"},400);
  const language=String(body.language||"English").slice(0,32);
  const safe=articles.map(a=>({title:String(a.title||"").slice(0,400),publisher:String(a.domain||"").slice(0,120),url:String(a.url||"").slice(0,1000)}));
  const prompt="Create a concise news intelligence brief in "+language+". Use only the supplied headlines and publisher metadata. Do not invent facts, dates, quotes, casualty figures, causes or event locations. Separate what the headlines explicitly say from what remains unknown. Group likely duplicate coverage cautiously. Cite supplied publisher URLs inline. End with a clear note that headlines alone are insufficient to verify claims.\n\nARTICLES:\n"+JSON.stringify(safe);
  try{
    const r=await fetch(base+"/v1/chat/completions",{method:"POST",headers:{"authorization":"Bearer "+key,"content-type":"application/json"},body:JSON.stringify({model:"auto",temperature:0.2,messages:[{role:"system",content:"You are a cautious newsroom research assistant. Never fabricate or claim independent verification."},{role:"user",content:prompt}]})});
    if(!r.ok)return json({error:"AI gateway request failed",status:r.status},502);
    const data=await r.json();const text=data.choices?.[0]?.message?.content;
    if(!text)return json({error:"AI gateway returned no briefing"},502);
    return json({brief:text,model:data.model||"auto",articlesUsed:safe.length});
  }catch(e){return json({error:"Could not contact AI gateway"},502)}
}
