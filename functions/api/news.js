const ALLOWED_LANGUAGES = new Set(["English","Hindi","Bengali","Assamese","Spanish","French","German","Arabic","Chinese","Japanese","Portuguese","Russian","Turkish","Korean","Italian","Dutch","Indonesian","Thai","Urdu"]);
const COUNTRY = /^[A-Z]{2}$/;
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=60, s-maxage=120","x-content-type-options":"nosniff"}})}
function cleanTitle(s){return (s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/https?:\/\/\S+/g,"").replace(/[^a-z0-9]+/g," ").trim()}
export async function onRequestGet({request}) {
  const u=new URL(request.url);
  const country=(u.searchParams.get("country")||"IN").toUpperCase();
  const language=u.searchParams.get("language")||"English";
  const mode=u.searchParams.get("mode")||"local";
  const limit=Math.min(50,Math.max(1,Number(u.searchParams.get("limit")||50)));
  if(country!=="WORLD"&&!COUNTRY.test(country)) return json({error:"Invalid country code"},400);
  if(!ALLOWED_LANGUAGES.has(language)) return json({error:"Unsupported language"},400);
  if(!["local","trending","world"].includes(mode)) return json({error:"Invalid mode"},400);
  let query;
  if(mode==="world") query="world news";
  else if(country==="WORLD") query=`sourcelang:${language} world news`;
  else query=`sourcecountry:${country} sourcelang:${language}`;
  const sort=mode==="trending"?"HybridRel":"DateDesc";
  const endpoint=new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.search=new URLSearchParams({query,mode:"ArtList",maxrecords:String(limit),format:"json",sort}).toString();
  try{
    const upstream=await fetch(endpoint.toString(),{headers:{"accept":"application/json"}});
    const raw=await upstream.text();
    if(!upstream.ok) return json({error:"News provider returned HTTP "+upstream.status,providerStatus:upstream.status,providerMessage:raw.slice(0,240)},502);
    let payload;
    try { payload=JSON.parse(raw); }
    catch { return json({error:"News provider returned a non-JSON response",providerMessage:raw.replace(/<[^>]*>/g," ").replace(/\\s+/g," ").trim().slice(0,240)},502); }
    if(payload.error || payload.status==="error") return json({error:"News provider rejected the query",providerMessage:String(payload.error||payload.message||"Unknown provider error").slice(0,240)},502);
    const seen=new Set(); const articles=[];
    for(const a of payload.articles||[]){
      if(!a.title||!a.url) continue;
      const key=cleanTitle(a.title);
      if(!key||seen.has(key)) continue;
      seen.add(key);
      articles.push({id:articles.length+1,title:a.title,url:a.url,domain:a.domain||"",publishedAt:a.seendate||null,sourceCountry:a.sourcecountry||null,sourceLanguage:a.sourcelang||null,sourceCountryName:a.sourcecountry||"Unknown",image:a.socialimage||null,discovery:"GDELT"});
    }
    if(!articles.length) return json({mode,country,language,provider:"GDELT",count:0,articles:[],error:"No headlines matched this country and language. Try English or World Mode.",notice:"GDELT may return no results for narrow filters."});
    return json({mode,country,language,provider:"GDELT",count:articles.length,articles,notice:"Discovery results only. Headlines and publisher links are real indexed articles, not independently fact-checked. Country refers to publisher origin when supplied, not necessarily the event location.",fetchedAt:new Date().toISOString()});
  }catch(e){return json({error:"Unable to reach the news provider"},502)}
}
