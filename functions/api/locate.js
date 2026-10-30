function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"public, max-age=300","x-content-type-options":"nosniff"}})}
function extractText(result){
  const value=result?.response??result?.result??result?.output_text??"";
  if(typeof value==="string")return value;
  if(value&&typeof value==="object")return JSON.stringify(value);
  return "";
}
export async function onRequestPost({request,env}) {
  try {
    const body=await request.json();
    const articles=(Array.isArray(body.articles)?body.articles:[]).slice(0,20).filter(x=>x&&x.id!==undefined&&typeof x.title==="string");
    if(!articles.length)return json({locations:[]});
    if(!env.AI)return json({error:"Workers AI binding is not configured"},503);
    const prompt=`For each news headline, identify the most likely real-world location where the reported event happened, NOT the publisher's location. Use a clearly named city, region, river, lake or country from the headline or well-established event context. If the headline only gives a country, use that country. If no event place is reasonably identifiable, return place:null. Never use the publisher's country as a substitute. Return ONLY JSON: {"locations":[{"id":123,"place":"City, Country","confidence":"High|Medium|Low"}]}. High means explicitly named; Medium means strong context; Low means country-level or inferred. Headlines: ${JSON.stringify(articles)}`;
    const result=await env.AI.run("@cf/zai-org/glm-4.7-flash",{messages:[{role:"system",content:"Extract conservative event locations from news headlines. Output valid JSON only, no markdown."},{role:"user",content:prompt}],max_tokens:2200});
    const raw=extractText(result).replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
    let parsed;
    try{parsed=JSON.parse(raw)}catch{
      const match=raw.match(/\{[\s\S]*\}/);
      if(!match)return json({locations:[],notice:"Location analysis returned invalid structured data."});
      try{parsed=JSON.parse(match[0])}catch{return json({locations:[],notice:"Location analysis returned invalid structured data."})}
    }
    const candidates=(Array.isArray(parsed.locations)?parsed.locations:[]).slice(0,20);
    const locations=await Promise.all(candidates.map(async loc=>{
      if(!loc||loc.place==null||typeof loc.place!=="string"||!["High","Medium","Low"].includes(loc.confidence))return null;
      const original=articles.find(a=>String(a.id)===String(loc.id));
      if(!original)return null;
      const geoUrl=new URL("https://geocoding-api.open-meteo.com/v1/search");
      geoUrl.search=new URLSearchParams({name:loc.place.slice(0,100),count:"1",language:"en",format:"json"}).toString();
      try{
        const geo=await fetch(geoUrl.toString(),{headers:{"accept":"application/json"},signal:AbortSignal.timeout(7000)});
        if(!geo.ok)return null;
        const gj=await geo.json(),point=gj.results?.[0];
        if(!point||!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude))return null;
        return {id:original.id,place:[point.name,point.country].filter(Boolean).join(", "),lat:point.latitude,lon:point.longitude,confidence:loc.confidence};
      }catch{return null}
    }));
    return json({locations:locations.filter(Boolean),notice:"Locations are AI-assisted estimates geocoded to a named place, not verified incident coordinates."});
  } catch(e) {
    return json({error:"Unable to estimate event locations"},500);
  }
}