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

const MARKETS = ["All","Denmark","Sweden","Norway","Finland"];
const FLAGS = { Denmark:"🇩🇰", Sweden:"🇸🇪", Norway:"🇳🇴", Finland:"🇫🇮" };
const SENT_STYLE = {
  positive: { bg:"#E8F0EC", color:"#2D6A4F", label:"Positive" },
  neutral:  { bg:"#F0EBE3", color:"#7A6A5A", label:"Neutral" },
  negative: { bg:"#F0E8E8", color:"#7A3A3A", label:"Negative" },
};
const SIGNAL_STYLE = {
  threat:      { bg:"#F0E8E8", color:"#7A3A3A", label:"Threat" },
  opportunity: { bg:"#E8F0EC", color:"#2D6A4F", label:"Opportunity" },
  watch:       { bg:"#F0EBE3", color:"#7A6A5A", label:"Watch" },
};
const TIMING_COLOR = { immediate:"#7A3A3A", "this quarter":"#7A6A5A", "next quarter":"#2D6A4F" };
const T = {
  cream:"#EDE8E0", creamDark:"#E3DDD4", forest:"#1C2B2B", forestMid:"#2D4040",
  mauve:"#9E7B7B", mauveDark:"#7A5A5A", mauveLight:"#C9AEAE",
  border:"#D5CEC6", text:"#1C2B2B", textMid:"#4A5A5A", textMuted:"#8A9090", white:"#FAFAF8",
};
const TABS = ["Intelligence","Playbook","Indicators"];
const TODAY = () => new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});

function Shimmer({ w, h=13, radius=3, style={} }) {
  return <div style={{ width:w, height:h, borderRadius:radius, background:`linear-gradient(90deg,#E3DDD4 25%,#D5CEC6 50%,#E3DDD4 75%)`, backgroundSize:"600px 100%", animation:"shimmer 1.6s infinite linear", ...style }} />;
}

function SectionLabel({ children }) {
  return <div style={{ fontSize:10, letterSpacing:"0.3em", textTransform:"uppercase", color:T.textMuted, marginBottom:14, fontWeight:400 }}>{children}</div>;
}

function Pill({ bg, color, children }) {
  return <span style={{ fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", padding:"2px 7px", background:bg, color }}>{children}</span>;
}

async function callProxy(prompt, maxTokens=800) {
  const res = await fetch("/api/claude", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({prompt,maxTokens}) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function briefPrompt(market) {
  const scope = market === "All" ? "Denmark, Sweden, Norway, and Finland" : market;
  return `Nordic beauty & wellbeing analyst. Today: ${TODAY()}.
Write a market intelligence brief for Nordic beauty retail in ${scope}.
Return ONLY valid JSON (no markdown):
{
  "summary": "2 sentences on what is happening in Nordic beauty retail right now",
  "trend": "Biggest trend in 5 words",
  "soWhat": "The single most important action for Matas Group this week, one sentence",
  "industryNews": [
    {"title":"Headline","summary":"One sentence","time":"Xh ago"},
    {"title":"Headline","summary":"One sentence","time":"Xh ago"},
    {"title":"Headline","summary":"One sentence","time":"Xh ago"}
  ]
}`;
}

function companyPrompt(c) {
  return `Nordic beauty retail analyst. Today: ${TODAY()}.
Brief for "${c.name}", beauty/wellbeing retailer in ${c.markets.join(", ")}.
Return ONLY valid JSON (no markdown):
{
  "headline": "Most important recent development, one sentence",
  "sentiment": "positive|neutral|negative",
  "insight": "One strategic implication for Matas Group, max 15 words",
  "soWhat": "Specific recommended action for Matas Group, one sentence",
  "timing": "immediate|this quarter|next quarter"
}`;
}

export default function Home() {
  const [market,      setMarket]      = useState("All");
  const [activeTab,   setActiveTab]   = useState("Intelligence");
  const [brief,       setBrief]       = useState(null);
  const [briefLoad,   setBriefLoad]   = useState(true);
  const [cards,       setCards]       = useState({});
  const [stocks,      setStocks]      = useState({});
  const [indicators,  setIndicators]  = useState(null);
  const [indLoad,     setIndLoad]     = useState(true);
  const [news,        setNews]        = useState({});
  const [playbooks,   setPlaybooks]   = useState({});
  const [expanded,    setExpanded]    = useState(null);
  const fetched       = useRef(new Set());
  const briefFetched  = useRef(new Set());
  const newsFetched   = useRef(new Set());
  const playbookFetched = useRef(new Set());
  const today = TODAY();

  const visible = COMPETITORS.filter(c => market === "All" || c.markets.includes(market));
  const loaded  = visible.filter(c => cards[c.name] && cards[c.name] !== "loading").length;
  const pct     = visible.length ? (loaded / visible.length) * 100 : 0;

  // Stocks
  useEffect(() => {
    fetch("/api/stocks").then(r => r.json()).then(setStocks).catch(() => {});
  }, []);

  // Indicators
  useEffect(() => {
    setIndLoad(true);
    fetch("/api/indicators").then(r => r.json()).then(d => { setIndicators(d); setIndLoad(false); }).catch(() => setIndLoad(false));
  }, []);

  // Brief
  useEffect(() => {
    if (briefFetched.current.has(market)) return;
    briefFetched.current.add(market);
    setBrief(null); setBriefLoad(true);
    callProxy(briefPrompt(market), 600).then(d => { setBrief(d); setBriefLoad(false); }).catch(() => setBriefLoad(false));
  }, [market]);

  // Company intelligence cards (staggered)
  useEffect(() => {
    const toFetch = visible.filter(c => !fetched.current.has(c.name));
    toFetch.forEach(c => { fetched.current.add(c.name); setCards(p => ({ ...p, [c.name]: "loading" })); });
    toFetch.forEach((c, i) => {
      setTimeout(() => {
        callProxy(companyPrompt(c))
          .then(d  => setCards(p => ({ ...p, [c.name]: d })))
          .catch(() => { setCards(p => ({ ...p, [c.name]: "error" })); fetched.current.delete(c.name); });
      }, i * 13000);
    });
  }, [market]);

  // Real news (fetched when playbook tab opened or card expanded)
  function ensureNews(c) {
    if (newsFetched.current.has(c.name)) return;
    newsFetched.current.add(c.name);
    setNews(p => ({ ...p, [c.name]: "loading" }));
    fetch(`/api/news?company=${encodeURIComponent(c.name)}`)
      .then(r => r.json())
      .then(d => setNews(p => ({ ...p, [c.name]: d.items || [] })))
      .catch(() => setNews(p => ({ ...p, [c.name]: [] })));
  }

  // Playbook (fetched on demand)
  function ensurePlaybook(c) {
    if (playbookFetched.current.has(c.name)) return;
    playbookFetched.current.add(c.name);
    setPlaybooks(p => ({ ...p, [c.name]: "loading" }));
    fetch("/api/playbook", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ company:c.name, markets:c.markets }) })
      .then(r => r.json())
      .then(d => setPlaybooks(p => ({ ...p, [c.name]: d })))
      .catch(() => { setPlaybooks(p => ({ ...p, [c.name]: "error" })); playbookFetched.current.delete(c.name); });
  }

  function handleExpand(c) {
    const isOpen = expanded === c.name;
    setExpanded(isOpen ? null : c.name);
    if (!isOpen) { ensureNews(c); ensurePlaybook(c); }
  }

  // Filtered indicators by market
  const indCountries = indicators?.countries?.filter(x =>
    market === "All" || x.country === market
  ) || [];

  return (
    <>
      <Head>
        <title>Nordic Beauty Intelligence — Matas Group</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>
      <style>{`
        .fade { animation: fadeUp .3s ease forwards; }
        .card { transition: box-shadow .2s, border-color .2s; }
        .card:hover { box-shadow: 0 2px 16px rgba(28,43,43,.08); }
        .mkt-btn, .tab-btn { transition: all .15s; cursor: pointer; font-family: inherit; background: transparent; border: none; }
        .mkt-btn:hover { background: #E3DDD4 !important; }
        .expand-btn { transition: background .15s; cursor: pointer; border: none; font-family: inherit; }
        .expand-btn:hover { background: #E3DDD4 !important; }
        .news-row { transition: background .15s; text-decoration: none; color: inherit; }
        .news-row:hover { background: #EDE8E0 !important; }
        a { color: inherit; }
      `}</style>

      {/* Header */}
      <div style={{ background:T.forest, color:T.cream, padding:"0 40px", display:"flex", alignItems:"stretch", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", padding:"16px 0" }}>
          <div>
            <div style={{ fontSize:9, letterSpacing:"0.45em", color:T.mauveLight, textTransform:"uppercase", marginBottom:3 }}>MATAS GROUP</div>
            <div style={{ fontSize:16, letterSpacing:"0.12em", textTransform:"uppercase", color:T.cream, fontWeight:300 }}>Nordic Beauty Intelligence</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:11, color:T.mauveLight }}>{loaded}/{visible.length} loaded</div>
            <div style={{ width:70, height:2, background:"rgba(255,255,255,0.15)", borderRadius:1, overflow:"hidden" }}>
              <div style={{ height:"100%", background:T.mauveLight, width:`${pct}%`, transition:"width .5s ease" }} />
            </div>
          </div>
          <div style={{ fontSize:11, color:T.mauveLight, borderLeft:"1px solid rgba(255,255,255,0.15)", paddingLeft:24 }}>{today}</div>
        </div>
      </div>

      {/* Market tabs */}
      <div style={{ background:T.cream, borderBottom:`1px solid ${T.border}`, padding:"0 40px", display:"flex" }}>
        {MARKETS.map(m => (
          <button key={m} className="mkt-btn" onClick={() => setMarket(m)} style={{ padding:"13px 18px", borderBottom: market===m ? `2px solid ${T.forest}` : "2px solid transparent", color: market===m ? T.forest : T.textMuted, fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", fontWeight: market===m ? 500 : 400, marginBottom:-1 }}>
            {m !== "All" ? FLAGS[m]+" " : ""}{m}
          </button>
        ))}
      </div>

      {/* View tabs */}
      <div style={{ background:T.white, borderBottom:`1px solid ${T.border}`, padding:"0 40px", display:"flex", gap:0 }}>
        {TABS.map(tab => (
          <button key={tab} className="tab-btn" onClick={() => setActiveTab(tab)} style={{ padding:"11px 20px", borderBottom: activeTab===tab ? `2px solid ${T.mauve}` : "2px solid transparent", color: activeTab===tab ? T.mauveDark : T.textMuted, fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight: activeTab===tab ? 500 : 400, marginBottom:-1 }}>
            {tab}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:1400, margin:"0 auto", padding:"28px 40px" }}>

        {/* ── INTELLIGENCE TAB ── */}
        {activeTab === "Intelligence" && (
          <>
            {/* Market Brief */}
            <div style={{ marginBottom:28 }}>
              <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:16 }}>
                <SectionLabel>48h Market Brief</SectionLabel>
                <span style={{ fontSize:11, color:T.border }}>—</span>
                <span style={{ fontSize:11, color:T.textMuted }}>{market === "All" ? "All Nordic Markets" : `${FLAGS[market]} ${market}`}</span>
              </div>
              {briefLoad ? (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}><Shimmer w="55%" h={15} /><Shimmer w="40%" h={15} /></div>
              ) : brief ? (
                <div className="fade">
                  <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:20, alignItems:"start", marginBottom:20 }}>
                    <p style={{ fontSize:15, lineHeight:1.8, color:T.textMid, maxWidth:680 }}>{brief.summary}</p>
                    {brief.trend && <div style={{ padding:"9px 16px", background:T.forest, color:T.cream, fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", whiteSpace:"nowrap", alignSelf:"center" }}>{brief.trend}</div>}
                  </div>
                  {brief.soWhat && (
                    <div style={{ padding:"14px 18px", background:"#F5F0EA", borderLeft:`3px solid ${T.mauveDark}`, marginBottom:20, fontSize:13, color:T.mauveDark, lineHeight:1.6 }}>
                      <span style={{ fontSize:9, letterSpacing:"0.25em", textTransform:"uppercase", color:T.mauveLight, display:"block", marginBottom:4 }}>So what — recommended action</span>
                      {brief.soWhat}
                    </div>
                  )}
                  {brief.industryNews?.length > 0 && (
                    <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:16 }}>
                      <SectionLabel>Industry News</SectionLabel>
                      {brief.industryNews.map((n,i) => (
                        <div key={i} style={{ display:"flex", gap:20, alignItems:"baseline", marginBottom:8 }}>
                          <span style={{ fontSize:10, color:T.textMuted, whiteSpace:"nowrap", width:55 }}>{n.time}</span>
                          <span style={{ fontSize:13, color:T.textMid, lineHeight:1.5 }}>
                            <strong style={{ color:T.forest, fontWeight:500 }}>{n.title}</strong>
                            <span style={{ color:T.textMuted }}> — {n.summary}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : <p style={{ fontSize:13, color:T.textMuted }}>Could not load brief.</p>}
            </div>

            <div style={{ borderTop:`1px solid ${T.border}`, marginBottom:28 }} />

            {/* Company cards */}
            <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:16 }}>
              <SectionLabel>Competitor Intelligence</SectionLabel>
              <span style={{ fontSize:11, color:T.border }}>—</span>
              <span style={{ fontSize:11, color:T.textMuted }}>{visible.length} companies · click card for news & playbook</span>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))", gap:2, background:T.border }}>
              {visible.map(c => {
                const d        = cards[c.name];
                const isLoaded = d && d !== "loading" && d !== "error";
                const isOpen   = expanded === c.name;
                const stock    = stocks[c.ticker];
                const ss       = isLoaded ? (SENT_STYLE[d.sentiment] || SENT_STYLE.neutral) : null;
                const compNews = news[c.name];
                const pb       = playbooks[c.name];

                return (
                  <div key={c.name} className="card" style={{ background: c.isMatas ? "#F5F0EA" : T.white, border:`1px solid ${c.isMatas ? T.mauveDark : "transparent"}` }}>
                    <div style={{ padding:"18px 20px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:14, marginBottom:10 }}>
                        <div>
                          {c.isMatas && <div style={{ fontSize:9, letterSpacing:"0.2em", color:T.mauveDark, textTransform:"uppercase", marginBottom:3 }}>Own brand</div>}
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <h3 style={{ fontSize:14, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:400, color:T.forest }}>{c.name}</h3>
                            <span style={{ fontSize:11 }}>{c.markets.map(m => FLAGS[m]).join(" ")}</span>
                          </div>
                        </div>
                        {/* Real stock */}
                        {c.ticker && (
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            {!stock ? <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"flex-end" }}><Shimmer w={50} h={17} /><Shimmer w={36} h={10} /></div>
                            : stock.error ? null : (
                              <div className="fade">
                                <div style={{ fontSize:16, fontWeight:300, color:T.forest }}>{stock.price}</div>
                                <div style={{ fontSize:10, color:T.textMuted }}>{stock.currency}</div>
                                {stock.change && <div style={{ fontSize:11, fontWeight:500, color: stock.change.startsWith("+") ? "#2D6A4F" : "#7A3A3A" }}>{stock.change}</div>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {!d || d === "loading"
                        ? <div style={{ display:"flex", flexDirection:"column", gap:5 }}><Shimmer w="88%" /><Shimmer w="62%" /></div>
                        : d === "error"
                        ? <span style={{ fontSize:12, color:T.textMuted }}>Failed to load</span>
                        : (
                          <div className="fade">
                            <p style={{ fontSize:13, color:T.textMid, lineHeight:1.6, marginBottom:10 }}>{d.headline}</p>
                            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                              {ss && <Pill bg={ss.bg} color={ss.color}>{ss.label}</Pill>}
                              {d.timing && <Pill bg="#F0EBE3" color={TIMING_COLOR[d.timing] || T.textMuted}>{d.timing}</Pill>}
                            </div>
                            {d.soWhat && (
                              <div style={{ marginTop:10, padding:"8px 12px", background:"#F5F0EA", borderLeft:`2px solid ${T.mauveLight}`, fontSize:11, color:T.mauveDark, lineHeight:1.5 }}>
                                <span style={{ fontSize:8, letterSpacing:"0.2em", textTransform:"uppercase", color:T.mauveLight, display:"block", marginBottom:2 }}>So what</span>
                                {d.soWhat}
                              </div>
                            )}
                          </div>
                        )}
                    </div>

                    {isLoaded && (
                      <button className="expand-btn" onClick={() => handleExpand(c)} style={{ width:"100%", padding:"9px 20px", background:T.creamDark, borderTop:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", color:T.textMuted, fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase" }}>
                        <span>{isOpen ? "Hide" : "News & Playbook"}</span>
                        <span style={{ fontSize:13 }}>{isOpen ? "−" : "+"}</span>
                      </button>
                    )}

                    {isOpen && (
                      <div className="fade" style={{ borderTop:`1px solid ${T.border}` }}>

                        {/* Real news */}
                        <div style={{ borderBottom:`1px solid ${T.border}` }}>
                          <div style={{ padding:"12px 20px 8px", background:T.creamDark }}>
                            <SectionLabel>Latest News</SectionLabel>
                          </div>
                          {!compNews || compNews === "loading"
                            ? <div style={{ padding:"14px 20px", display:"flex", flexDirection:"column", gap:8 }}><Shimmer w="80%" /><Shimmer w="60%" /></div>
                            : compNews.length === 0
                            ? <div style={{ padding:"14px 20px", fontSize:12, color:T.textMuted }}>No recent news found. <a href={`https://news.google.com/search?q=${encodeURIComponent(c.name+" beauty")}&hl=en`} target="_blank" rel="noopener noreferrer" style={{ color:T.mauveDark }}>Search Google News ↗</a></div>
                            : compNews.map((n, i) => (
                              <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="news-row" style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"12px 20px", borderBottom: i < compNews.length-1 ? `1px solid ${T.border}` : "none", background:"transparent" }}>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:13, color:T.forest, marginBottom:2, lineHeight:1.4 }}>{n.title}</div>
                                  {n.source && <div style={{ fontSize:10, color:T.textMuted }}>{n.source}</div>}
                                </div>
                                <div style={{ fontSize:10, color:T.textMuted, whiteSpace:"nowrap", flexShrink:0 }}>{n.timeAgo}</div>
                              </a>
                            ))
                          }
                        </div>

                        {/* Playbook */}
                        <div style={{ padding:"12px 20px 8px", background:T.creamDark }}>
                          <SectionLabel>Competitor Playbook</SectionLabel>
                        </div>
                        {!pb || pb === "loading"
                          ? <div style={{ padding:"14px 20px", display:"flex", flexDirection:"column", gap:8 }}><Shimmer w="75%" /><Shimmer w="55%" /></div>
                          : pb === "error"
                          ? <div style={{ padding:"14px 20px", fontSize:12, color:T.textMuted }}>Could not load playbook</div>
                          : (
                            <div className="fade">
                              {/* Signals */}
                              {pb.signals?.length > 0 && (
                                <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
                                  <div style={{ fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color:T.textMuted, marginBottom:10 }}>Competitive Signals</div>
                                  {pb.signals.map((s,i) => {
                                    const ss = SIGNAL_STYLE[s.type] || SIGNAL_STYLE.watch;
                                    return (
                                      <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom: i < pb.signals.length-1 ? 8 : 0 }}>
                                        <Pill bg={ss.bg} color={ss.color}>{ss.label}</Pill>
                                        <span style={{ fontSize:12, color:T.textMid, lineHeight:1.4 }}>{s.description}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Pricing + Promo in 2 cols */}
                              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderBottom:`1px solid ${T.border}` }}>
                                <div style={{ padding:"14px 20px", borderRight:`1px solid ${T.border}` }}>
                                  <div style={{ fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color:T.textMuted, marginBottom:8 }}>Pricing</div>
                                  <div style={{ display:"flex", gap:6, marginBottom:6 }}><Pill bg={T.creamDark} color={T.textMid}>{pb.pricing?.positioning}</Pill></div>
                                  <div style={{ fontSize:12, color:T.textMid, lineHeight:1.4, marginBottom:4 }}>{pb.pricing?.recentMoves}</div>
                                  <div style={{ fontSize:11, color:T.textMuted, lineHeight:1.4 }}>{pb.pricing?.vsMattas}</div>
                                </div>
                                <div style={{ padding:"14px 20px" }}>
                                  <div style={{ fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color:T.textMuted, marginBottom:8 }}>Promo Intensity</div>
                                  <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                                    <Pill bg={pb.promo?.intensity === "high" ? "#F0E8E8" : pb.promo?.intensity === "low" ? "#E8F0EC" : T.creamDark} color={pb.promo?.intensity === "high" ? "#7A3A3A" : pb.promo?.intensity === "low" ? "#2D6A4F" : T.textMid}>{pb.promo?.intensity}</Pill>
                                  </div>
                                  <div style={{ fontSize:12, color:T.textMid, lineHeight:1.4 }}>{pb.promo?.recentCampaigns}</div>
                                </div>
                              </div>

                              {/* Assortment */}
                              <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
                                <div style={{ fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color:T.textMuted, marginBottom:8 }}>Assortment</div>
                                <div style={{ fontSize:12, color:T.textMid, lineHeight:1.4, marginBottom:6 }}>{pb.assortment?.recentExpansions}</div>
                                {pb.assortment?.keyBrands?.length > 0 && (
                                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                                    {pb.assortment.keyBrands.map((b,i) => <Pill key={i} bg={T.creamDark} color={T.textMid}>{b}</Pill>)}
                                  </div>
                                )}
                              </div>

                              {/* So what */}
                              {pb.soWhat && (
                                <div style={{ padding:"14px 20px", background:"#F5F0EA" }}>
                                  <div style={{ fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color:T.mauveLight, marginBottom:6 }}>So what — recommended action</div>
                                  <div style={{ fontSize:13, color:T.mauveDark, lineHeight:1.6, marginBottom:4 }}>{pb.soWhat.action}</div>
                                  <div style={{ fontSize:11, color:T.textMuted, lineHeight:1.4, marginBottom:6 }}>{pb.soWhat.rationale}</div>
                                  {pb.soWhat.timing && <Pill bg={T.creamDark} color={TIMING_COLOR[pb.soWhat.timing] || T.textMuted}>{pb.soWhat.timing}</Pill>}
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── PLAYBOOK TAB ── */}
        {activeTab === "Playbook" && (
          <div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:20 }}>
              <SectionLabel>Competitor Playbook</SectionLabel>
              <span style={{ fontSize:11, color:T.border }}>—</span>
              <span style={{ fontSize:11, color:T.textMuted }}>Pricing · Promo · Assortment · Signals</span>
            </div>
            {visible.filter(c => !c.isMatas).map(c => {
              const pb = playbooks[c.name];
              // Trigger fetch
              if (!pb && !playbookFetched.current.has(c.name)) {
                setTimeout(() => ensurePlaybook(c), 0);
              }
              return (
                <div key={c.name} style={{ marginBottom:2, background:T.white, border:`1px solid ${T.border}` }}>
                  <div style={{ padding:"14px 20px", background:T.creamDark, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:13, letterSpacing:"0.08em", textTransform:"uppercase", color:T.forest }}>{c.name}</span>
                      <span style={{ fontSize:11 }}>{c.markets.map(m => FLAGS[m]).join(" ")}</span>
                    </div>
                    {pb && pb !== "loading" && pb !== "error" && pb.pricing?.positioning && (
                      <Pill bg={T.white} color={T.textMid}>{pb.pricing.positioning} pricing</Pill>
                    )}
                  </div>
                  {!pb || pb === "loading"
                    ? <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:8 }}><Shimmer w="70%" /><Shimmer w="50%" /></div>
                    : pb === "error"
                    ? <div style={{ padding:"14px 20px", fontSize:12, color:T.textMuted }}>Failed to load</div>
                    : (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", borderTop:`1px solid ${T.border}` }}>
                        {[
                          { label:"Pricing", content: pb.pricing?.recentMoves, sub: pb.pricing?.vsMattas },
                          { label:"Promo", content: pb.promo?.recentCampaigns, sub: `Intensity: ${pb.promo?.intensity || "—"}` },
                          { label:"Assortment", content: pb.assortment?.recentExpansions, sub: pb.assortment?.gap },
                          { label:"Media", content: pb.media?.recentActivity, sub: `Pressure: ${pb.media?.pressure || "—"}` },
                        ].map((col,i) => (
                          <div key={i} style={{ padding:"14px 18px", borderRight: i < 3 ? `1px solid ${T.border}` : "none" }}>
                            <div style={{ fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color:T.textMuted, marginBottom:8 }}>{col.label}</div>
                            <div style={{ fontSize:12, color:T.textMid, lineHeight:1.5, marginBottom:4 }}>{col.content || "—"}</div>
                            <div style={{ fontSize:11, color:T.textMuted, lineHeight:1.4 }}>{col.sub}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  {pb && pb !== "loading" && pb !== "error" && pb.soWhat && (
                    <div style={{ padding:"12px 20px", background:"#F5F0EA", borderTop:`1px solid ${T.border}`, display:"flex", gap:16, alignItems:"flex-start" }}>
                      <div style={{ fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", color:T.mauveLight, whiteSpace:"nowrap", paddingTop:1 }}>So what</div>
                      <div style={{ fontSize:12, color:T.mauveDark, lineHeight:1.5 }}>{pb.soWhat.action}</div>
                      {pb.soWhat.timing && <Pill bg={T.creamDark} color={TIMING_COLOR[pb.soWhat.timing] || T.textMuted}>{pb.soWhat.timing}</Pill>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── INDICATORS TAB ── */}
        {activeTab === "Indicators" && (
          <div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:8 }}>
              <SectionLabel>Market Indicators</SectionLabel>
              <span style={{ fontSize:11, color:T.border }}>—</span>
              <span style={{ fontSize:11, color:T.textMuted }}>OECD · Eurostat · real data</span>
            </div>
            <div style={{ fontSize:11, color:T.textMuted, marginBottom:20, lineHeight:1.6 }}>
              Consumer Confidence from OECD CLI. CPI and Retail Sales from Eurostat. Updated monthly.
            </div>

            {indLoad ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:2, background:T.border }}>
                {[1,2,3,4].map(i => <div key={i} style={{ background:T.white, padding:"20px" }}><Shimmer w="60%" h={14} style={{ marginBottom:8 }} /><Shimmer w="40%" h={22} style={{ marginBottom:6 }} /><Shimmer w="80%" h={11} /></div>)}
              </div>
            ) : indCountries.length === 0 ? (
              <p style={{ fontSize:13, color:T.textMuted }}>Could not load indicators. Data may be temporarily unavailable from OECD/Eurostat.</p>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                {indCountries.map(country => (
                  <div key={country.country} style={{ background:T.white, border:`1px solid ${T.border}` }}>
                    <div style={{ padding:"12px 20px", background:T.creamDark, borderBottom:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:12, letterSpacing:"0.1em", textTransform:"uppercase", color:T.forest }}>{FLAGS[country.country]} {country.country}</span>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:0 }}>
                      {[
                        {
                          label: "Consumer Confidence",
                          value: country.confidence?.value,
                          time: country.confidence?.time,
                          note: "OECD CLI — above 100 = above trend",
                          direction: country.confidence?.value ? (parseFloat(country.confidence.value) >= 100 ? "up" : "down") : null,
                        },
                        {
                          label: "CPI Inflation",
                          value: country.cpi?.value ? country.cpi.value + "%" : null,
                          time: country.cpi?.time,
                          note: "Eurostat HICP — annual rate",
                          direction: country.cpi?.value ? (parseFloat(country.cpi.value) > 2 ? "down" : "up") : null,
                        },
                        {
                          label: "Retail Sales Growth",
                          value: country.retailGrowth?.value ? country.retailGrowth.value + "%" : null,
                          time: country.retailGrowth?.time,
                          note: "Eurostat — year-on-year volume",
                          direction: country.retailGrowth?.value ? (parseFloat(country.retailGrowth.value) > 0 ? "up" : "down") : null,
                        },
                      ].map((ind, i) => (
                        <div key={i} style={{ padding:"16px 20px", borderRight: i < 2 ? `1px solid ${T.border}` : "none" }}>
                          <div style={{ fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:T.textMuted, marginBottom:8 }}>{ind.label}</div>
                          {ind.value ? (
                            <>
                              <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
                                <span style={{ fontSize:24, fontWeight:300, color:T.forest, letterSpacing:"-0.02em" }}>{ind.value}</span>
                                {ind.direction && (
                                  <span style={{ fontSize:13, color: ind.direction === "up" ? "#2D6A4F" : "#7A3A3A" }}>
                                    {ind.direction === "up" ? "↑" : "↓"}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize:10, color:T.textMuted, marginBottom:3 }}>{ind.note}</div>
                              {ind.time && <div style={{ fontSize:10, color:T.border }}>As of {ind.time}</div>}
                            </>
                          ) : (
                            <div style={{ fontSize:12, color:T.textMuted }}>Unavailable</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Internal data placeholder */}
            <div style={{ marginTop:28, padding:"20px", background:"#F5F0EA", border:`1px dashed ${T.mauveLight}` }}>
              <div style={{ fontSize:10, letterSpacing:"0.25em", textTransform:"uppercase", color:T.mauveLight, marginBottom:8 }}>Internal Data — Not Yet Connected</div>
              <p style={{ fontSize:13, color:T.mauveDark, lineHeight:1.6, marginBottom:10 }}>
                The following require Matas Group internal data feeds to activate: Market Share & Win/Loss vs Competitors · Promo Intensity Benchmarking · Consumer Consideration Scores · Club Matas Behavioural Signals
              </p>
              <p style={{ fontSize:11, color:T.textMuted }}>Connect via your data warehouse or BI tool by adding a new API route in <code style={{ background:T.creamDark, padding:"1px 4px" }}>pages/api/</code> that fetches from your internal source.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
