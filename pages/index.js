import { useState, useEffect, useRef } from "react";
import Head from "next/head";

const COMPETITORS = [
  { name: "Matas",            markets: ["Denmark"],                  ticker: "MATAS.CO",  isMatas: true },
  { name: "KICKS",            markets: ["Sweden","Norway","Finland"], ticker: null,        isMatas: true },
  { name: "Normal",           markets: ["Denmark","Sweden","Norway"], ticker: null },
  { name: "Lyko",             markets: ["Sweden","Norway","Finland"], ticker: "LYKO-A.ST" },
  { name: "Sephora",          markets: ["Denmark"],                  ticker: "MC.PA" },
  { name: "Stockmann",        markets: ["Finland"],                  ticker: "STOCKA.HE" },
  { name: "The Body Shop",    markets: ["Denmark","Finland"],        ticker: null },
  { name: "Åhléns",           markets: ["Sweden"],                   ticker: null },
  { name: "Apotea",           markets: ["Sweden"],                   ticker: null },
  { name: "Caia",             markets: ["Sweden"],                   ticker: null },
  { name: "Fredrik & Louisa", markets: ["Norway"],                   ticker: null },
  { name: "Vita",             markets: ["Norway"],                   ticker: null },
  { name: "Ruohonjuuri",      markets: ["Finland"],                  ticker: null },
  { name: "Sokos",            markets: ["Finland"],                  ticker: null },
  { name: "Emotion",          markets: ["Finland"],                  ticker: null },
];

// Multiple queries per company - tries each until one returns results
const QUERIES = {
  "Matas":            ["Matas skønhed", "Matas butik", "Matas Group beauty"],
  "KICKS":            ["KICKS beauty Sverige", "KICKS parfymeri", "KICKS Scandinavia"],
  "Normal":           ['"Normal" butik skønhed Danmark', '"Normal stores" beauty Denmark'],
  "Lyko":             ["Lyko beauty", "Lyko hudvård Sverige", "Lyko.com"],
  "Sephora":          ["Sephora beauty", "Sephora store Denmark", "Sephora Nordic"],
  "Stockmann":        ["Stockmann Finland", "Stockmann kauneus", "Stockmann Helsinki"],
  "The Body Shop":    ["The Body Shop beauty", "Body Shop retail", "Body Shop sustainability"],
  "Åhléns":           ["Åhléns Sverige", "Åhléns varuhus", "Åhléns beauty Stockholm"],
  "Apotea":           ["Apotea apotek", "Apotea Sverige", "Apotea beauty"],
  "Caia":             ["Caia Cosmetics", "Caia beauty Sverige", "Caia makeup"],
  "Fredrik & Louisa": ["Fredrik og Louisa", "Fredrik Louisa Norway beauty"],
  "Vita":             ['"Vita apotek" Norway', "Vita helsekost Norge", "Vita.no"],
  "Ruohonjuuri":      ["Ruohonjuuri Finland", "Ruohonjuuri kauneus", "Ruohonjuuri luomu"],
  "Sokos":            ["Sokos Finland kauneus", "Sokos tavaratalo beauty", "Sokos kosmetiikka"],
  "Emotion":          ["Emotion parfymeri Finland", "Emotion beauty Finland", "Emotion kosmetiikka"],
};

const NOISE = {
  "Normal":   ["new normal","back to normal","paranormal","abnormal","return to normal"],
  "Vita":     ["vita coco","dolce vita","vita liberata"],
  "Emotion":  ["emotional","emotions","emotionally"],
  "Caia":     ["caia archon","caia island"],
  "Sokos":    ["sokos hotel"],
};

const MARKETS = ["All","Denmark","Sweden","Norway","Finland"];
const FLAGS   = { Denmark:"🇩🇰", Sweden:"🇸🇪", Norway:"🇳🇴", Finland:"🇫🇮" };
const SENT_STYLE = {
  positive: { bg:"#E8F0EC", color:"#2D6A4F", label:"Positive" },
  neutral:  { bg:"#EDE8E0", color:"#7A6A5A", label:"Neutral"  },
  negative: { bg:"#F0E8E8", color:"#7A3A3A", label:"Negative" },
};
const TODAY = () => new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
const T = {
  cream:"#EDE8E0", creamDark:"#E3DDD4", forest:"#1C2B2B",
  mauve:"#9E7B7B", mauveDark:"#7A5A5A", mauveLight:"#C9AEAE",
  border:"#D5CEC6", textMid:"#4A5A5A", textMuted:"#8A9090", white:"#FAFAF8",
};

// ── RSS parsing ───────────────────────────────────────────────────────
function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
           || xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : "";
}
function stripHtml(s) {
  return s.replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<")
          .replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
  if (h < 1)  return "Just now";
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}
function parseRSS(xml, company) {
  const cutoff = Date.now() - 30*24*60*60*1000;
  const noise  = NOISE[company] || [];
  const items  = [];
  const re     = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b     = m[1];
    const title = stripHtml(extractTag(b,"title"));
    const link  = extractTag(b,"link") || extractTag(b,"guid");
    const pub   = extractTag(b,"pubDate");
    const src   = stripHtml(extractTag(b,"source"));
    if (!title || !link) continue;
    const date  = pub ? new Date(pub) : null;
    if (date && date.getTime() < cutoff) continue;
    if (noise.some(n => title.toLowerCase().includes(n))) continue;
    items.push({ title, link, source:src, date:date?.toISOString()||null, ago:date?timeAgo(date):"" });
    if (items.length >= 5) break;
  }
  return items;
}

async function fetchCompanyNews(company) {
  const queries = QUERIES[company] || [company];
  for (const q of queries) {
    try {
      const res = await fetch(`/api/news?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml   = await res.text();
      const items = parseRSS(xml, company);
      if (items.length > 0) return items;
    } catch { continue; }
  }
  return [];
}

// ── Claude ────────────────────────────────────────────────────────────
async function callClaude(prompt, maxTokens=300) {
  const res = await fetch("/api/claude", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ prompt, maxTokens }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
function insightPrompt(c, items) {
  const hl = items.map(n=>`- ${n.title}`).join("\n");
  return `Nordic beauty retail strategist at Matas Group. Today: ${TODAY()}.
Recent headlines about "${c.name}" (${c.markets.join(", ")}):
${hl||"No recent news."}
Return ONLY valid JSON:
{"sentiment":"positive|neutral|negative","insight":"One strategic implication for Matas Group, max 20 words"}`;
}
function briefPrompt(market) {
  const scope = market==="All" ? "Denmark, Sweden, Norway, and Finland" : market;
  return `Nordic beauty analyst. Today: ${TODAY()}.
Brief for beauty retail in ${scope}. Return ONLY valid JSON:
{"summary":"2 sentences on Nordic beauty retail right now","trend":"Biggest trend in 5 words","industryNews":[{"title":"Headline","summary":"One sentence","time":"Xh ago"},{"title":"Headline","summary":"One sentence","time":"Xh ago"},{"title":"Headline","summary":"One sentence","time":"Xh ago"}]}`;
}

// ── UI ────────────────────────────────────────────────────────────────
function Shimmer({ w, h=13, radius=3, style={} }) {
  return <div style={{ width:w, height:h, borderRadius:radius,
    background:"linear-gradient(90deg,#E3DDD4 25%,#D5CEC6 50%,#E3DDD4 75%)",
    backgroundSize:"600px 100%", animation:"shimmer 1.6s infinite linear", ...style }} />;
}
function IndicatorBlock({ label, data, unit="" }) {
  const base = { background:T.white, padding:"16px 18px" };
  const lbl  = <div style={{fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textMuted,marginBottom:8}}>{label}</div>;
  if (!data) return <div style={base}>{lbl}<Shimmer w={60} h={22}/></div>;
  if (data.error) return <div style={base}>{lbl}<div style={{fontSize:11,color:T.textMuted,fontStyle:"italic"}}>Unavailable</div></div>;
  return (
    <div style={base}>
      {lbl}
      <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:4}}>
        <span style={{fontSize:22,fontWeight:300,color:T.forest,letterSpacing:"-0.02em"}}>{data.value}{unit}</span>
        {data.change && <span style={{fontSize:11,fontWeight:500,color:data.direction==="up"?"#2D6A4F":data.direction==="down"?"#7A3A3A":T.textMuted}}>
          {data.direction==="up"?"↑":data.direction==="down"?"↓":"→"} {data.change}
        </span>}
      </div>
      <div style={{fontSize:10,color:T.textMuted}}>{data.period} · {data.source}</div>
    </div>
  );
}

export default function Home() {
  const [market,     setMarket]     = useState("All");
  const [brief,      setBrief]      = useState(null);
  const [briefLoad,  setBriefLoad]  = useState(true);
  const [cards,      setCards]      = useState({});
  const [stocks,     setStocks]     = useState({});
  const [indicators, setIndicators] = useState(null);
  const [expanded,   setExpanded]   = useState(null);
  const fetched      = useRef(new Set());
  const briefFetched = useRef(new Set());
  const today = TODAY();

  const visible = COMPETITORS.filter(c => market==="All" || c.markets.includes(market));
  const sortedVisible = [...visible].sort((a,b) => {
    const da = cards[a.name], db = cards[b.name];
    const dateA = da?.items?.[0]?.date ? new Date(da.items[0].date) : new Date(0);
    const dateB = db?.items?.[0]?.date ? new Date(db.items[0].date) : new Date(0);
    return dateB - dateA;
  });
  const loaded = visible.filter(c => cards[c.name] && cards[c.name]!=="loading").length;
  const pct    = visible.length ? (loaded/visible.length)*100 : 0;

  useEffect(() => {
    fetch("/api/stocks").then(r=>r.json()).then(setStocks).catch(()=>{});
  }, []);
  useEffect(() => {
    fetch("/api/indicators").then(r=>r.json()).then(setIndicators).catch(()=>{});
  }, []);
  useEffect(() => {
    if (briefFetched.current.has(market)) return;
    briefFetched.current.add(market);
    setBrief(null); setBriefLoad(true);
    callClaude(briefPrompt(market), 500)
      .then(d  => { setBrief(d); setBriefLoad(false); })
      .catch(() => setBriefLoad(false));
  }, [market]);

  useEffect(() => {
    const toFetch = visible.filter(c => !fetched.current.has(c.name));
    toFetch.forEach(c => { fetched.current.add(c.name); setCards(p=>({...p,[c.name]:"loading"})); });
    toFetch.forEach((c,i) => {
      setTimeout(async () => {
        try {
          const items = await fetchCompanyNews(c.name);
          let sentiment="neutral", insight="";
          try {
            const ai = await callClaude(insightPrompt(c,items), 150);
            sentiment = ai.sentiment||"neutral";
            insight   = ai.insight||"";
          } catch(_) {}
          setCards(p=>({...p,[c.name]:{items,sentiment,insight}}));
        } catch {
          setCards(p=>({...p,[c.name]:{items:[],sentiment:"neutral",insight:""}}));
        }
      }, i*4000);
    });
  }, [market]);

  const indicatorMarkets = market==="All" ? ["Denmark","Sweden","Norway","Finland"] : [market];

  return (
    <>
      <Head>
        <title>Nordic Beauty Intelligence — Matas Group</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,300;0,6..12,400;0,6..12,500;0,6..12,600;1,6..12,300&display=swap" rel="stylesheet" />
      </Head>
      <style>{`
        *{box-sizing:border-box;}
        body{font-family:'Nunito Sans','Helvetica Neue',sans-serif!important;}
        @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .fade{animation:fadeUp .3s ease forwards;}
        .card{transition:box-shadow .2s,border-color .2s;display:grid;grid-template-rows:1fr auto auto;}
        .card:hover{box-shadow:0 2px 20px rgba(28,43,43,.07);border-color:#7A5A5A!important;}
        .mkt-btn{transition:all .15s;cursor:pointer;font-family:'Nunito Sans',sans-serif;}
        .mkt-btn:hover{background:#E3DDD4!important;}
        .expand-btn{transition:background .15s;cursor:pointer;border:none;font-family:'Nunito Sans',sans-serif;}
        .expand-btn:hover{background:#D8D2CA!important;}
        .news-row{transition:background .15s;display:flex;text-decoration:none;}
        .news-row:hover{background:#EDE8E0!important;}
      `}</style>

      {/* Header */}
      <div style={{background:T.forest,color:T.cream,padding:"0 40px",display:"flex",alignItems:"stretch",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",padding:"18px 0"}}>
          <div>
            <div style={{fontSize:9,letterSpacing:"0.5em",color:T.mauveLight,textTransform:"uppercase",marginBottom:5,fontWeight:400}}>MATAS GROUP</div>
            <div style={{fontSize:16,letterSpacing:"0.18em",textTransform:"uppercase",color:T.cream,fontWeight:300}}>Nordic Beauty Intelligence</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:24}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:11,color:T.mauveLight,fontWeight:300}}>{loaded}/{visible.length} loaded</span>
            <div style={{width:80,height:2,background:"rgba(255,255,255,0.12)",borderRadius:1,overflow:"hidden"}}>
              <div style={{height:"100%",background:T.mauveLight,width:`${pct}%`,transition:"width .5s ease"}}/>
            </div>
          </div>
          <div style={{fontSize:11,color:T.mauveLight,borderLeft:"1px solid rgba(255,255,255,0.12)",paddingLeft:24,fontWeight:300}}>{today}</div>
        </div>
      </div>

      {/* Market tabs */}
      <div style={{background:T.cream,borderBottom:`1px solid ${T.border}`,padding:"0 40px",display:"flex"}}>
        {MARKETS.map(m => (
          <button key={m} className="mkt-btn" onClick={()=>setMarket(m)} style={{
            padding:"13px 20px",background:"transparent",border:"none",
            borderBottom:market===m?`2px solid ${T.forest}`:"2px solid transparent",
            color:market===m?T.forest:T.textMuted,
            fontSize:11,letterSpacing:"0.18em",textTransform:"uppercase",
            fontWeight:market===m?600:400,marginBottom:-1,
          }}>
            {m!=="All"?FLAGS[m]+" ":""}{m}
          </button>
        ))}
      </div>

      <div style={{maxWidth:1400,margin:"0 auto",padding:"36px 40px"}}>

        {/* Brief */}
        <div style={{marginBottom:36}}>
          <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:22}}>
            <h2 style={{fontSize:10,letterSpacing:"0.35em",textTransform:"uppercase",color:T.textMuted,fontWeight:500}}>48h Market Brief</h2>
            <span style={{color:T.border}}>—</span>
            <span style={{fontSize:11,color:T.textMuted,fontWeight:300}}>
              {market==="All"?"All Nordic Markets":`${FLAGS[market]} ${market}`}
            </span>
          </div>
          {briefLoad ? (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Shimmer w="50%" h={15}/><Shimmer w="38%" h={15}/>
            </div>
          ) : brief ? (
            <div className="fade">
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:28,alignItems:"start",marginBottom:30}}>
                <p style={{fontSize:14,lineHeight:1.9,color:T.textMid,maxWidth:680,fontWeight:300}}>{brief.summary}</p>
                {brief.trend && <div style={{padding:"11px 20px",background:T.forest,color:T.cream,fontSize:10,letterSpacing:"0.18em",textTransform:"uppercase",whiteSpace:"nowrap",fontWeight:400}}>{brief.trend}</div>}
              </div>
              {/* Indicators */}
              <div style={{marginBottom:30}}>
                <div style={{fontSize:9.5,letterSpacing:"0.32em",textTransform:"uppercase",color:T.textMuted,marginBottom:14,fontWeight:500}}>Market Indicators — OECD & World Bank Official Data</div>
                {indicatorMarkets.map(mkt => (
                  <div key={mkt} style={{marginBottom:indicatorMarkets.length>1?20:0}}>
                    {indicatorMarkets.length>1 && <div style={{fontSize:10,color:T.textMuted,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>{FLAGS[mkt]} {mkt}</div>}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border,border:`1px solid ${T.border}`}}>
                      <IndicatorBlock label="Consumer Confidence" data={indicators?.[mkt]?.consumerConfidence}/>
                      <IndicatorBlock label="CPI Inflation"       data={indicators?.[mkt]?.cpi}               unit="%"/>
                      <IndicatorBlock label="Unemployment"        data={indicators?.[mkt]?.unemployment}      unit="%"/>
                    </div>
                  </div>
                ))}
              </div>
              {brief.industryNews?.length>0 && (
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:22}}>
                  <div style={{fontSize:9.5,letterSpacing:"0.32em",textTransform:"uppercase",color:T.textMuted,marginBottom:14,fontWeight:500}}>Industry Context</div>
                  {brief.industryNews.map((n,i) => (
                    <div key={i} style={{display:"flex",gap:20,alignItems:"baseline",marginBottom:11}}>
                      <span style={{fontSize:10,color:T.textMuted,whiteSpace:"nowrap",width:58,fontWeight:300}}>{n.time}</span>
                      <span style={{fontSize:13,color:T.textMid,lineHeight:1.6,fontWeight:300}}>
                        <strong style={{color:T.forest,fontWeight:500}}>{n.title}</strong>
                        <span style={{color:T.textMuted}}> — {n.summary}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : <p style={{fontSize:13,color:T.textMuted,fontWeight:300}}>Could not load brief.</p>}
        </div>

        <div style={{borderTop:`1px solid ${T.border}`,marginBottom:32}}/>

        <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:22}}>
          <h2 style={{fontSize:10,letterSpacing:"0.35em",textTransform:"uppercase",color:T.textMuted,fontWeight:500}}>Competitor Intelligence</h2>
          <span style={{color:T.border}}>—</span>
          <span style={{fontSize:11,color:T.textMuted,fontWeight:300}}>{visible.length} companies · sorted by latest news</span>
        </div>

        {/* Grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(380px,1fr))",gap:2,background:T.border}}>
          {sortedVisible.map(c => {
            const d        = cards[c.name];
            const isLoaded = d && d!=="loading" && d!=="error";
            const isOpen   = expanded===c.name;
            const stock    = stocks[c.ticker];
            const sentStyle= isLoaded?(SENT_STYLE[d.sentiment]||SENT_STYLE.neutral):null;
            const hasNews  = isLoaded&&d.items?.length>0;

            return (
              <div key={c.name} className="card" style={{
                background:c.isMatas?"#F2EDE4":T.white,
                border:`1px solid ${c.isMatas?"#B8A090":"transparent"}`,
              }}>
                <div style={{padding:"20px 22px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,marginBottom:13}}>
                    <div>
                      {c.isMatas && <div style={{fontSize:8.5,letterSpacing:"0.25em",color:"#9A7060",textTransform:"uppercase",marginBottom:5,fontWeight:500}}>Own brand</div>}
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <h3 style={{fontSize:14,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500,color:T.forest}}>{c.name}</h3>
                        <span style={{fontSize:12}}>{c.markets.map(m=>FLAGS[m]).join(" ")}</span>
                      </div>
                    </div>
                    {c.ticker && (
                      <div style={{textAlign:"right",flexShrink:0}}>
                        {!stock ? (
                          <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
                            <Shimmer w={55} h={18}/><Shimmer w={38} h={11}/>
                          </div>
                        ) : stock.error ? null : (
                          <div className="fade">
                            <div style={{fontSize:17,fontWeight:300,color:T.forest}}>{stock.price}</div>
                            <div style={{fontSize:10,color:T.textMuted,fontWeight:300}}>{stock.currency}</div>
                            {stock.change && <div style={{fontSize:11,fontWeight:500,color:stock.change.startsWith("+")?"#2D6A4F":"#7A3A3A"}}>{stock.change}</div>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!d||d==="loading" ? (
                    <div style={{display:"flex",flexDirection:"column",gap:7}}>
                      <Shimmer w="88%" h={12}/><Shimmer w="62%" h={12}/>
                    </div>
                  ) : (
                    <div className="fade">
                      {hasNews ? (
                        <p style={{fontSize:13,color:T.textMid,lineHeight:1.65,marginBottom:13,fontWeight:300}}>
                          {d.items[0].title}
                          <span style={{fontSize:10,color:T.textMuted,marginLeft:8}}>{d.items[0].ago}</span>
                        </p>
                      ) : (
                        <p style={{fontSize:12,color:T.textMuted,marginBottom:13,fontWeight:300}}>No recent news found</p>
                      )}
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {sentStyle && <span style={{fontSize:9.5,letterSpacing:"0.14em",textTransform:"uppercase",padding:"3px 9px",background:sentStyle.bg,color:sentStyle.color,fontWeight:500}}>{sentStyle.label}</span>}
                        {hasNews && <span style={{fontSize:10,color:T.textMuted,fontWeight:300}}>{d.items.length} article{d.items.length!==1?"s":""} · last 30 days</span>}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{marginTop:"auto"}}>
                  {isLoaded && (
                    <button className="expand-btn" onClick={()=>setExpanded(isOpen?null:c.name)} style={{
                      width:"100%",padding:"10px 22px",
                      background:T.creamDark,borderTop:`1px solid ${T.border}`,
                      display:"flex",justifyContent:"space-between",alignItems:"center",
                      color:T.textMuted,fontSize:9.5,letterSpacing:"0.18em",textTransform:"uppercase",fontWeight:500,
                    }}>
                      <span>{isOpen?"Hide detail":"Show detail"}</span>
                      <span style={{fontSize:16,fontWeight:300}}>{isOpen?"−":"+"}</span>
                    </button>
                  )}
                </div>

                {isOpen&&isLoaded && (
                  <div className="fade" style={{borderTop:`1px solid ${T.border}`,background:T.white}}>
                    {d.insight && (
                      <div style={{padding:"14px 22px",background:"#F2EDE4",borderBottom:`1px solid ${T.border}`,fontSize:12,color:"#9A7060",lineHeight:1.65,fontWeight:300}}>
                        <span style={{fontSize:8.5,letterSpacing:"0.28em",textTransform:"uppercase",color:T.mauveLight,display:"block",marginBottom:5,fontWeight:500}}>Strategic note — AI analysis of recent headlines</span>
                        {d.insight}
                      </div>
                    )}
                    {hasNews ? d.items.map((n,i) => (
                      <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="news-row"
                        style={{gap:14,alignItems:"flex-start",padding:"13px 22px",color:"inherit",borderBottom:i<d.items.length-1?`1px solid ${T.border}`:"none",background:"transparent"}}
                      >
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,color:T.forest,marginBottom:3,lineHeight:1.45,fontWeight:400}}>{n.title}</div>
                          {n.source && <div style={{fontSize:10,color:T.textMuted,fontWeight:300}}>{n.source}</div>}
                        </div>
                        <div style={{fontSize:10,color:T.textMuted,whiteSpace:"nowrap",flexShrink:0,marginLeft:14,fontWeight:300}}>{n.ago}</div>
                      </a>
                    )) : (
                      <div style={{padding:"16px 22px"}}>
                        <a href={`https://news.google.com/search?q=${encodeURIComponent(c.name+" beauty")}&hl=en`}
                          target="_blank" rel="noopener noreferrer"
                          style={{fontSize:12,color:T.mauveDark,fontWeight:400}}>
                          Search Google News for {c.name} ↗
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
