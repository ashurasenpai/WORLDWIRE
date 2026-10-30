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
const COUNTRY_NAMES={IN:"India",US:"United States",GB:"United Kingdom",CA:"Canada",AU:"Australia",JP:"Japan",CN:"China",FR:"France",DE:"Germany",BR:"Brazil",NG:"Nigeria",ZA:"South Africa",AE:"United Arab Emirates",PK:"Pakistan",BD:"Bangladesh",MX:"Mexico",ES:"Spain",TR:"Türkiye",BT:"Bhutan"};
const LANG_CODES={English:"en",Hindi:"hi",Bengali:"bn",Assamese:"as",Spanish:"es",French:"fr",German:"de",Arabic:"ar",Chinese:"zh-CN",Japanese:"ja",Portuguese:"pt",Russian:"ru",Turkish:"tr",Korean:"ko",Italian:"it",Dutch:"nl",Indonesian:"id",Thai:"th",Urdu:"ur"};
const FEEDS = {
  global:[
    ["BBC World","https://feeds.bbci.co.uk/news/world/rss.xml","GB"],
    ["Al Jazeera","https://www.aljazeera.com/xml/rss/all.xml","QA"],
    ["DW English","https://rss.dw.com/xml/rss-en-all","DE"],
    ["France 24","https://www.france24.com/en/rss","FR"],
    ["Euronews","https://www.euronews.com/rss","FR"],
    ["The Guardian World","https://www.theguardian.com/world/rss","GB"],
    ["UN News","https://news.un.org/feed/subscribe/en/news/all/rss.xml","UN"]
  ],
  asia:[
    ["Channel News Asia","https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml","SG"],
    ["Times of India","https://timesofindia.indiatimes.com/rssfeedstopstories.cms","IN"],
    ["NDTV","https://feeds.feedburner.com/ndtvnews-top-stories","IN"],
    ["Bangkok Post","https://www.bangkokpost.com/rss/data/topstories.xml","TH"],
    ["ABC Australia","https://www.abc.net.au/news/feed/51120/rss.xml","AU"]
  ],
  americas:[
    ["NPR","https://feeds.npr.org/1001/rss.xml","US"],
    ["CBC Canada","https://www.cbc.ca/webfeed/rss/rss-topstories","CA"],
    ["ABC News US","https://abcnews.com/abcnews/topstories","US"]
  ],
  europe:[
    ["BBC Top Stories","https://feeds.bbci.co.uk/news/rss.xml","GB"],
    ["Sky News World","https://feeds.skynews.com/feeds/rss/world.xml","GB"],
    ["Le Monde English","https://www.lemonde.fr/en/rss/une.xml","FR"],
    ["Der Spiegel International","https://www.spiegel.de/international/index.rss","DE"]
  ],
  africa:[
    ["Africa News","https://www.africanews.com/feed/rss","ZA"],
    ["News24 South Africa","https://feeds.24.com/articles/news24/TopStories/rss","ZA"]
  ],
  oceania:[
    ["ABC Australia","https://www.abc.net.au/news/feed/51120/rss.xml","AU"],
    ["RNZ","https://www.rnz.co.nz/rss/national.xml","NZ"]
  ]
};
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...extra}})}
function cleanTitle(s){return (s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/https?:\/\/\S+/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function normalizeDate(value){if(!value)return null;const m=String(value).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);if(m)return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString()}
function xmlText(s){return String(s||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim()}
function rssTag(item,name){const m=item.match(new RegExp("<"+name+"(?:\\s+[^>]*)?>([\\s\\S]*?)</"+name+">","i"));return m?xmlText(m[1]):""}
function classify(title){const t=title.toLowerCase();for(const [c,re] of Object.entries({Conflict:/war|attack|military|missile|ceasefire|conflict|strike/,Climate:/climate|cyclone|storm|flood|earthquake|wildfire|glacier|glof/,Technology:/technology|artificial intelligence|\bai\b|chip|cybersecurity|software/,Economy:/economy|inflation|market|trade|oil|finance|jobs/,Science:/science|research|space|medicine|discovery|study/,Culture:/culture|film|music|entertainment|sport|festival/,Politics:/election|parliament|government|minister|diplomacy|policy/})){if(re.test(t))return c}return "Politics"}
function regionFor(code){if(["IN","BD","PK","BT","NP","LK","CN","JP","KR","KP","TW","HK","SG","MY","ID","TH","VN","PH","MM","KH","LA","AU","NZ","FJ"].includes(code))return "asia";if(["US","CA","MX","BR","AR","CL","CO","PE","VE","CU"].includes(code))return "americas";if(["GB","FR","DE","ES","IT","NL","BE","CH","AT","PL","UA","RU","SE","NO","FI","IE","PT","GR","TR"].includes(code))return "europe";if(["ZA","NG","KE","GH","ET","EG","MA","DZ","TN","UG","TZ","SD","CD","SN","CI"].includes(code))return "africa";if(["AU","NZ","FJ","PG"].includes(code))return "oceania";return "global"}
function feedList(country){const region=country==="WORLD"?"global":regionFor(country);const chosen=[...(FEEDS.global||[]),...(FEEDS[region]||[])];const seen=new Set();return chosen.filter(x=>{if(seen.has(x[1]))return false;seen.add(x[1]);return true}).slice(0,12)}
async function fetchRSSFeed(feed,limit){const [name,url,sourceCountry]=feed;const r=await fetch(url,{headers:{accept:"application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9,*/*;q=0.5","user-agent":"WORLDWIRE/1.0 news discovery contact: hello@worldwire.invalid"},signal:AbortSignal.timeout(4200)});if(!r.ok)throw new Error(name+" HTTP "+r.status);const xml=await r.text(),out=[];for(const m of xml.matchAll(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)){const item=m[0],title=rssTag(item,"title");let link=rssTag(item,"link");if(!link){const lm=item.match(/<link[^>]+href=["']([^"']+)["']/i);link=lm?.[1]||""}const date=rssTag(item,"pubDate")||rssTag(item,"published")||rssTag(item,"updated")||rssTag(item,"dc:date");if(title&&link&&/^https?:\/\//i.test(link)){out.push({title,url:link,domain:name,publishedAt:normalizeDate(date),sourceCountry,sourceLanguage:null,sourceCountryName:COUNTRY_NAMES[sourceCountry]||sourceCountry,discovery:name});if(out.length>=limit)break}}return out}
async function fetchGoogleRSS(country,language,category,limit){const lang=LANG_CODES[language]||"en",region=country==="WORLD"?"US":country,place=COUNTRY_NAMES[region]||region,terms=CATEGORY_TERMS[category]||"latest news";const query=(country==="WORLD"?"world":place)+" "+terms+(category?" when:3d":" when:1d");const url=new URL("https://news.google.com/rss/search");url.search=new URLSearchParams({q:query,hl:lang+"-"+region,gl:region,ceid:region+":"+lang}).toString();const r=await fetch(url.toString(),{headers:{accept:"application/rss+xml, application/xml, text/xml"},signal:AbortSignal.timeout(4500)});if(!r.ok)throw new Error("Google News RSS HTTP "+r.status);const xml=await r.text(),out=[];for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){const item=m[1],title=rssTag(item,"title"),link=rssTag(item,"link"),date=rssTag(item,"pubDate"),source=rssTag(item,"source");if(title&&link)out.push({title,url:link,domain:source||"Google News",publishedAt:normalizeDate(date),sourceCountry:null,sourceLanguage:language,sourceCountryName:null,discovery:"Google News RSS"});if(out.length>=limit)break}return out}
function buildGdeltURL(country,language,mode,category,limit){const base=mode==="world"||country==="WORLD"?"":`sourcecountry:${country} `,lang=language==="English"?"":`sourcelang:${language} `,terms=CATEGORY_TERMS[category];const query=(base+lang+(terms?`(${terms})`:"world news")).trim();const u=new URL("https://api.gdeltproject.org/api/v2/doc/doc");u.search=new URLSearchParams({query,mode:"ArtList",maxrecords:String(limit),format:"json",sort:mode==="trending"?"HybridRel":"DateDesc",timespan:mode==="trending"?"7d":"24h"}).toString();return u.toString()}
async function fetchGDELT(country,language,mode,category,limit){const r=await fetch(buildGdeltURL(country,language,mode,category,limit),{headers:{accept:"application/json"},signal:AbortSignal.timeout(6000)});if(!r.ok)throw new Error("GDELT HTTP "+r.status);const p=await r.json();if(p.error||p.status==="error")throw new Error(String(p.error||p.message||"GDELT rejected query"));return (p.articles||[]).filter(a=>a.title&&a.url).map(a=>({title:a.title,url:a.url,domain:a.domain||"",publishedAt:normalizeDate(a.seendate),sourceCountry:a.sourcecountry||null,sourceLanguage:a.sourcelang||null,sourceCountryName:a.sourcecountry||null,image:a.socialimage||null,discovery:"GDELT"}))}
function dedupe(rows,category,limit){const seen=new Set(),out=[];for(const a of rows){if(category&&classify(a.title)!==category)continue;const key=cleanTitle(a.title);if(!key||seen.has(key))continue;seen.add(key);out.push({...a,category:classify(a.title)})}out.sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0));return out.slice(0,limit).map((a,i)=>({...a,id:i+1}))}
async function saveCache(cache,freshKey,staleKey,result){if(!cache||!result.articles.length)return;const body=JSON.stringify(result);await Promise.all([cache.put(freshKey,new Response(body,{headers:{"content-type":"application/json","cache-control":"public, max-age=60"}})),cache.put(staleKey,new Response(body,{headers:{"content-type":"application/json","cache-control":"public, max-age=1800"}}))])}
export async function onRequestGet({request,env,waitUntil}) {
 const u=new URL(request.url),country=(u.searchParams.get("country")||"IN").toUpperCase(),language=u.searchParams.get("language")||"English",mode=u.searchParams.get("mode")||"local",category=u.searchParams.get("category")||"",limit=Math.min(100,Math.max(1,Number(u.searchParams.get("limit")||80)));
 if(country!=="WORLD"&&!COUNTRY.test(country))return json({error:"Invalid country code"},400);if(!ALLOWED_LANGUAGES.has(language))return json({error:"Unsupported language"},400);if(!["local","trending","world"].includes(mode))return json({error:"Invalid mode"},400);if(category&&!Object.hasOwn(CATEGORY_TERMS,category))return json({error:"Invalid category"},400);
 const cache=typeof caches!=="undefined"?caches.default:null,key=new URL("https://worldwire-cache.invalid/news");key.search=new URLSearchParams({country,language,mode,category,limit:String(limit)}).toString();const freshKey=new Request(key.toString()+"&age=fresh"),staleKey=new Request(key.toString()+"&age=stale");
 if(cache){const hit=await cache.match(freshKey);if(hit){const response=new Response(hit.body,hit);response.headers.set("x-worldwire-cache","HIT");return response}}
 const stale=cache?await cache.match(staleKey):null;
 if(stale){const data=await stale.json();const refresh=collectNews(country,language,mode,category,limit).then(async result=>saveCache(cache,freshKey,staleKey,result)).catch(()=>null);if(typeof waitUntil==="function")waitUntil(refresh);return json({...data,stale:true,notice:"Cached headlines shown immediately while independent sources refresh."},200,{"x-worldwire-cache":"STALE-WHILE-REVALIDATE"})}
 try{const result=await collectNews(country,language,mode,category,limit);if(!result.articles.length)throw new Error("No source returned usable headlines. Providers may be temporarily unreachable.");await saveCache(cache,freshKey,staleKey,result);return json(result,200,{"x-worldwire-sources":String(result.sources.length)})}catch(e){return json({error:e.message||"Unable to reach news sources.",providerErrors:e.providerErrors||[]},502)}
}
async function collectNews(country,language,mode,category,limit){
 const feeds=feedList(country),tasks=[...feeds.map(feed=>({name:feed[0],run:()=>fetchRSSFeed(feed,20)})),{name:"Google News RSS",run:()=>fetchGoogleRSS(country,language,category,limit)},{name:"GDELT",run:()=>fetchGDELT(country,language,mode,category,limit)}];
 const settled=await Promise.allSettled(tasks.map(t=>t.run())),rows=[],sources=[],errors=[];
 settled.forEach((result,i)=>{if(result.status==="fulfilled"){rows.push(...result.value);if(result.value.length)sources.push({name:tasks[i].name,count:result.value.length,status:"ok"})}else errors.push({name:tasks[i].name,error:String(result.reason?.message||result.reason).slice(0,140)})});
 const articles=dedupe(rows,category,limit);if(mode==="trending"){const tokens=articles.map(a=>cleanTitle(a.title).split(" ").filter(w=>w.length>4));articles.forEach((a,i)=>{a.coverageCount=1;for(let j=0;j<articles.length;j++){if(i===j)continue;const overlap=tokens[i].filter(w=>tokens[j].includes(w)).length,denom=Math.max(1,Math.min(tokens[i].length,tokens[j].length));if(overlap/denom>=.55)a.coverageCount++}});articles.sort((a,b)=>b.coverageCount-a.coverageCount||new Date(b.publishedAt||0)-new Date(a.publishedAt||0))}
 return {mode,country,language,provider:"Multi-source RSS + Google News + GDELT",count:articles.length,articles,sources,sourceErrors:errors,notice:"Aggregated public headlines. Publisher location is not event location; Google News links may redirect. Verify claims with original publishers.",fetchedAt:new Date().toISOString(),partial:sources.length<tasks.length};
}
