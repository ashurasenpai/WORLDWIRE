const ALLOWED_LANGUAGES = new Set(["English","Hindi","Bengali","Assamese","Spanish","French","German","Arabic","Chinese","Japanese","Portuguese","Russian","Turkish","Korean","Italian","Dutch","Indonesian","Thai","Urdu"]);
const COUNTRY = /^[A-Z]{2}$/;
const CATEGORY_TERMS = {
  Politics:"election OR parliament OR government OR minister OR diplomacy OR policy",
  Conflict:"war OR attack OR military OR missile OR ceasefire OR conflict",
  Economy:"economy OR inflation OR markets OR trade OR oil OR finance OR jobs",
  Technology:"technology OR artificial intelligence OR AI OR chip OR cybersecurity OR software",
  Climate:"climate OR cyclone OR storm OR flood OR earthquake OR wildfire OR glacial lake OR GLOF",
  Science:"science OR research OR space OR medicine OR discovery OR study",
  Culture:"culture OR film OR music OR entertainment OR sport OR festival"
};
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

const COUNTRY_NAMES={IN:"India",US:"United States",GB:"United Kingdom",CA:"Canada",AU:"Australia",JP:"Japan",CN:"China",FR:"France",DE:"Germany",BR:"Brazil",NG:"Nigeria",ZA:"South Africa",AE:"United Arab Emirates",PK:"Pakistan",BD:"Bangladesh",MX:"Mexico",ES:"Spain",TR:"Türkiye",BT:"Bhutan"};
const LANG_CODES={English:"en",Hindi:"hi",Bengali:"bn",Assamese:"as",Spanish:"es",French:"fr",German:"de",Arabic:"ar",Chinese:"zh-CN",Japanese:"ja",Portuguese:"pt",Russian:"ru",Turkish:"tr",Korean:"ko",Italian:"it",Dutch:"nl",Indonesian:"id",Thai:"th",Urdu:"ur"};
function xmlText(s){return String(s||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim()}
function rssTag(item,name){const m=item.match(new RegExp("<"+name+"(?:\\s+[^>]*)?>([\\s\\S]*?)</"+name+">","i"));return m?xmlText(m[1]):""}
async function fetchGoogleRSS(country,language,category,limit){
 const lang=LANG_CODES[language]||"en",region=country==="WORLD"?"US":country,place=COUNTRY_NAMES[region]||region;
 const terms=CATEGORY_TERMS[category]||"latest news";
 const query=(country==="WORLD"?"world":place)+" "+terms.replace(/ OR /g," OR ")+(category?" when:3d":" when:1d");
 const url=new URL("https://news.google.com/rss/search");
 url.search=new URLSearchParams({q:query,hl:lang+"-"+region,gl:region,ceid:region+":"+lang}).toString();
 const response=await fetch(url.toString(),{headers:{accept:"application/rss+xml, application/xml, text/xml"},signal:AbortSignal.timeout(5500)});
 if(!response.ok)throw new Error("Google News RSS returned HTTP "+response.status);
 const xml=await response.text(),items=[];
 for(const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
  const item=match[1],title=rssTag(item,"title"),link=rssTag(item,"link"),published= rssTag(item,"pubDate"),source=rssTag(item,"source");
  if(!title||!link)continue;
  items.push({id:items.length+1,title,url:link,domain:source||"Google News RSS",publishedAt:normalizeDate(published),sourceCountry:null,sourceLanguage:language,sourceCountryName:null,discovery:"Google News RSS"});
  if(items.length>=limit)break;
 }
 const seen=new Set();
 return items.filter(a=>{const key=cleanTitle(a.title);if(!key||seen.has(key))return false;seen.add(key);return true});
}

function buildQuery(country,language,mode,category){
  const base=mode==="world"||country==="WORLD"?"":`sourcecountry:${country} `;
  const lang=language==="English"?"":`sourcelang:${language} `;
  const terms=CATEGORY_TERMS[category];
  return (base+lang+(terms?`(${terms})`:"world news")).trim();
}
async function fetchAndCache(endpoint,mode,country,language,freshKey,staleKey,cache){
  const upstream=await fetch(endpoint,{headers:{"accept":"application/json"},signal:AbortSignal.timeout(9000)});
  const raw=await upstream.text();
  if(upstream.status===429)throw Object.assign(new Error("rate limited"),{status:429,retry:Number(upstream.headers.get("retry-after"))||60});
  if(!upstream.ok)throw Object.assign(new Error("News provider returned HTTP "+upstream.status),{status:upstream.status});
  let payload;try{payload=JSON.parse(raw)}catch{throw new Error("News provider returned a non-JSON response")}
  if(payload.error||payload.status==="error")throw new Error(String(payload.error||payload.message||"News provider rejected the query"));
  const articles=makeArticles(payload,mode);
  const result={mode,country,language,provider:"GDELT",count:articles.length,articles,notice:"Discovery results only. Publisher country is not necessarily event location.",fetchedAt:new Date().toISOString()};
  if(cache&&articles.length){
    const body=JSON.stringify(result);
    await cache.put(freshKey,new Response(body,{headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=90"}}));
    await cache.put(staleKey,new Response(body,{headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=1800"}}));
  }
  return result;
}
export async function onRequestGet({request,env,waitUntil}) {
  const u=new URL(request.url),country=(u.searchParams.get("country")||"IN").toUpperCase(),language=u.searchParams.get("language")||"English",mode=u.searchParams.get("mode")||"local",category=u.searchParams.get("category")||"";
  const limit=Math.min(100,Math.max(1,Number(u.searchParams.get("limit")||80)));
  if(country!=="WORLD"&&!COUNTRY.test(country))return json({error:"Invalid country code"},400);
  if(!ALLOWED_LANGUAGES.has(language))return json({error:"Unsupported language"},400);
  if(!["local","trending","world"].includes(mode))return json({error:"Invalid mode"},400);
  if(category&&!Object.hasOwn(CATEGORY_TERMS,category))return json({error:"Invalid category"},400);
  const cache=typeof caches!=="undefined"?caches.default:null;
  const key=new URL("https://worldwire-cache.invalid/news");
  key.search=new URLSearchParams({country,language,mode,category,limit:String(limit)}).toString();
  const freshKey=new Request(key.toString()+"&age=fresh"),staleKey=new Request(key.toString()+"&age=stale");
  if(cache){const hit=await cache.match(freshKey);if(hit){const response=new Response(hit.body,hit);response.headers.set("x-worldwire-cache","HIT");return response}}
  const stale=cache?await cache.match(staleKey):null;
  const query=buildQuery(country,language,mode,category);
  const endpoint=new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.search=new URLSearchParams({query,mode:"ArtList",maxrecords:String(limit),format:"json",sort:mode==="trending"?"HybridRel":"DateDesc",timespan:mode==="trending"?"7d":"24h"}).toString();
  if(stale){
    const refresh=fetchAndCache(endpoint.toString(),mode,country,language,freshKey,staleKey,cache).catch(()=>null);
    if(typeof waitUntil==="function")waitUntil(refresh);
    const data=await stale.json();
    return json({...data,stale:true,notice:"Showing cached headlines while the feed refreshes in the background."},200,{"x-worldwire-cache":"STALE-WHILE-REVALIDATE"});
  }
  try{
    const rss=await fetchGoogleRSS(country,language,category,limit);
    if(rss.length){
      const result={mode,country,language,provider:"Google News RSS",count:rss.length,articles:rss,notice:"Fast RSS discovery. Headlines link to Google News publisher redirects; confirm details with the original publisher.",fetchedAt:new Date().toISOString()};
      if(cache){const body=JSON.stringify(result);await cache.put(freshKey,new Response(body,{headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=90"}}));await cache.put(staleKey,new Response(body,{headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=1800"}}))}
      return json(result);
    }
    const result=await fetchAndCache(endpoint.toString(),mode,country,language,freshKey,staleKey,cache);
    return json(result);
  }catch(e){
    if(e.status===429)return json({error:"The live news provider is temporarily rate-limiting requests.",providerStatus:429,retryAfterSeconds:e.retry||60},503,{"retry-after":String(e.retry||60)});
    return json({error:e.message||"Unable to reach the news provider."},502);
  }
}