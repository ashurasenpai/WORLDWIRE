function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=300","x-content-type-options":"nosniff"}})}
export async function onRequestPost({request,env}) {
  try {
    const body=await request.json();
    const articles=(Array.isArray(body.articles)?body.articles:[]).slice(0,12).filter(x=>x&&x.id!==undefined&&typeof x.title==="string");
    if(!articles.length)return json({locations:[]});
    if(!env.AI)return json({error:"Workers AI binding is not configured"},503);
    const prompt=`For each news headline, identify the most likely real-world location where the reported event happened, NOT the publisher's location. Use only places explicitly supported by the headline/context. If no place is reasonably identifiable, return place:null. Do not invent locations or coordinates. Return ONLY valid JSON in this exact shape: {"locations":[{"id":123,"place":"City, Country","confidence":"High|Medium|Low"}]}. High means clearly named; Medium means strong contextual inference; Low means ambiguous. Prefer city/region over country when supported. Headlines: ${JSON.stringify(articles)}`;
    const result=await env.AI.run("@cf/zai-org/glm-4.7-flash",{messages:[{role:"system",content:"You extract geographic event locations conservatively. Never confuse publisher origin with event location. Output JSON only."},{role:"user",content:prompt}],max_tokens:1200});
    const raw=result?.response||result?.result||"";
    const text=String(raw).replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
    let parsed;
    try{parsed=JSON.parse(text)}catch{return json({locations:[],notice:"Location analysis returned invalid structured data."})}
    const locations=[];
    for(const loc of (parsed.locations||[]).slice(0,12)){
      if(!loc||loc.place==null||!["High","Medium","Low"].includes(loc.confidence))continue;
      const original=articles.find(a=>String(a.id)===String(loc.id));
      if(!original)continue;
      const geoUrl=new URL("https://geocoding-api.open-meteo.com/v1/search");
      geoUrl.search=new URLSearchParams({name:String(loc.place).slice(0,100),count:"1",language:"en",format:"json"}).toString();
      const geo=await fetch(geoUrl.toString(),{headers:{"accept":"application/json"}});
      if(!geo.ok)continue;
      const gj=await geo.json();
      const point=gj.results?.[0];
      if(!point||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude))continue;
      locations.push({id:original.id,place:[point.name,point.country].filter(Boolean).join(", "),lat:point.latitude,lon:point.longitude,confidence:loc.confidence});
    }
    return json({locations,notice:"Locations are AI-assisted estimates geocoded to a named place, not verified incident coordinates."});
  } catch(e) {
    return json({error:"Unable to estimate event locations"},500);
  }
}