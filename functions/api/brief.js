function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}})}
export async function onRequestPost({request,env}){
  if(!env.AI||typeof env.AI.run!=="function") return json({error:"Cloudflare Workers AI is not connected yet. Add the Workers AI binding named AI to the WORLDWIRE Pages project and redeploy."},503);
  let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
  const articles=Array.isArray(body.articles)?body.articles.slice(0,8):[];
  if(!articles.length)return json({error:"Provide at least one article"},400);
  const language=String(body.language||"English").slice(0,32);
  const safe=articles.map(a=>({title:String(a.title||"").slice(0,400),publisher:String(a.domain||"").slice(0,120),url:String(a.url||"").slice(0,1000)}));
  const prompt="Create a concise news intelligence brief in "+language+". Use only the supplied headlines and publisher metadata. Do not invent facts, dates, quotes, casualty figures, causes or event locations. Separate what the headlines explicitly say from what remains unknown. Group likely duplicate coverage cautiously. Cite supplied publisher URLs inline. End with a clear note that headlines alone are insufficient to verify claims.\n\nARTICLES:\n"+JSON.stringify(safe);
  try{
    const result=await env.AI.run("@cf/zai-org/glm-4.7-flash",{messages:[
      {role:"system",content:"You are a cautious newsroom research assistant. Never fabricate facts or claim independent verification. Only use information supplied in the user message."},
      {role:"user",content:prompt}
    ],max_tokens:900,temperature:0.2});
    const brief=typeof result==="string"?result:(result.response||result.output_text||result.result||"");
    if(!brief)return json({error:"AI model returned no briefing"},502);
    return json({brief,model:"@cf/zai-org/glm-4.7-flash",articlesUsed:safe.length});
  }catch(e){return json({error:"Cloudflare Workers AI request failed"},502)}
}
