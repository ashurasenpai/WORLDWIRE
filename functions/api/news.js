const ALLOWED_LANGUAGES = new Set(["English","Hindi","Bengali","Assamese","Spanish","French","German","Arabic","Chinese","Japanese","Portuguese","Russian","Turkish","Korean","Italian","Dutch","Indonesian","Thai","Urdu"]);
const COUNTRY = /^[A-Z]{2}$/;
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...extra}})}
function cleanTitle(s){return (s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/https?:\/\/\S+/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function normalizeDate(value){if(!value)return null;const m=String(value).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);if(m)return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString()}
function makeArticles(payload,mode){
  const seen=new Set(),articles=[];
  for(const a of payload.articles||[]){
    if(!a.title||!a.url)continue;
    const key=cleanTitle(a.title);if(!key||seen.has(key))continue;seen.add(key);
    articles.push({id:articles.length+1,title:a.title,url:a.url,domain:a.domain||"",publishedAt:normalizeDate(a.seendate),sourceCountry:a.sourcecountry||null,sourceLanguage:a.sourcelang||null,sourceCountryName:a.sourcecountry||"Unknown",image:a.socialimage||null,discovery:"GDELT"});
  }
  if(mode==="trending"){
    const tokens=articles.map(a=>cleanTitle(a.title).split(" ").filter(w=>w.length>4));
    articles.forEach((a,i)=>{a.coverageCount=1;for(let j=0;j<articles.length;j++){if(i===j)continue;const overlap=tokens[i].filter(w=>tokens[j].includes(w)).length;const denom=Math.max(1,Math.min(tokens[i].length,tokens[j].length));if(overlap/denom>=0.55)a.coverageCount++}});
    articles.sort((a,b)=>b.coverageCount-a.coverageCount||new Date(b.publishedAt||0)-new Date(a.publishedAt||0));
  }
  return articles;
}
export async function onRequestGet({request}) {
  const u=new URL(request.url),country=(u.searchParams.get("country")||"IN").toUpperCase(),language=u.searchParams.get("language")||"English",mode=u.searchParams.get("mode")||"local";
  const limit=Math.min(50,Math.max(1,Number(u.searchParams.get("limit")||50)));
  if(country!=="WORLD"&&!COUNTRY.test(country))return json({error:"Invalid country code"},400);
  if(!ALLOWED_LANGUAGES.has(language))return json({error:"Unsupported language"},400);
  if(!["local","trending","world"].includes(mode))return json({error:"Invalid mode"},400);
  const cache=typeof caches!=="undefined"?caches.default:null;
  const key=new URL("https://worldwire-cache.invalid/news");
  key.search=new URLSearchParams({country,language,mode,limit:String(limit)}).toString();
  const freshKey=new Request(key.toString()+"&age=fresh"),staleKey=new Request(key.toString()+"&age=stale");
  if(cache){const hit=await cache.match(freshKey);if(hit){const response= new Response(hit.body,hit);response.headers.set("x-worldwire-cache","HIT");return response}}
  let query;
  if(mode==="world")query="world news";else if(country==="WORLD")query=`sourcelang:${language} world news`;else query=`sourcecountry:${country} sourcelang:${language}`;
  const endpoint=new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.search=new URLSearchParams({query,mode:"ArtList",maxrecords:String(limit),format:"json",sort:mode==="trending"?"HybridRel":"DateDesc",...(mode==="trending"?{timespan:"7d"}:{})}).toString();
  try{
    const upstream=await fetch(endpoint.toString(),{headers:{"accept":"application/json"}});
    const raw=await upstream.text();
    if(upstream.status===429){
      const stale=cache?await cache.match(staleKey):null;
      if(stale){const data=await stale.json();return json({...data,stale:true,notice:"Showing previously cached headlines because the live news provider is rate-limiting requests. Refresh later for newer results."},200,{"x-worldwire-cache":"STALE"})}
      const retry=Number(upstream.headers.get("retry-after"))||60;
      return json({error:"The live news provider is temporarily rate-limiting requests. Please wait before refreshing.",providerStatus:429,retryAfterSeconds:retry},503,{"retry-after":String(retry)});
    }
    if(!upstream.ok)return json({error:"News provider returned HTTP "+upstream.status,providerStatus:upstream.status,providerMessage:raw.slice(0,240)},502);
    let payload;try{payload=JSON.parse(raw)}catch{return json({error:"News provider returned a non-JSON response",providerMessage:raw.replace(/<[^>]*>/g," ").replace(/\\s+/g," ").trim().slice(0,240)},502)}
    if(payload.error||payload.status==="error")return json({error:"News provider rejected the query",providerMessage:String(payload.error||payload.message||"Unknown provider error").slice(0,240)},502);
    const articles=makeArticles(payload,mode);
    const result=articles.length?{mode,country,language,provider:"GDELT",count:articles.length,articles,notice:"Discovery results only. Headlines and publisher links are real indexed articles, not independently fact-checked. Country refers to publisher origin when supplied, not necessarily the event location.",fetchedAt:new Date().toISOString()}:{mode,country,language,provider:"GDELT",count:0,articles:[],error:"No headlines matched this country and language. Try English or World Mode.",notice:"GDELT may return no results for narrow filters."};
    const response=json(result);
    if(cache&&articles.length){
      const body=JSON.stringify(result);
      await cache.put(freshKey,new Response(body,{headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=300"}}));
      await cache.put(staleKey,new Response(body,{headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=3600"}}));
    }
    return response;
  }catch(e){
    const stale=cache?await cache.match(staleKey):null;
    if(stale){const data=await stale.json();return json({...data,stale:true,notice:"Showing previously cached headlines because the live news provider is temporarily unreachable."},200,{"x-worldwire-cache":"STALE"})}
    return json({error:"Unable to reach the news provider. Please try again shortly."},502);
  }
}
