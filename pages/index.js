import { useState, useEffect, useRef } from "react";
import Head from "next/head";

const COMPETITORS = [
  { name: "Matas",            markets: ["Denmark"],                   ticker: "MATAS.CO",  isMatas: true },
  { name: "KICKS",            markets: ["Sweden","Norway","Finland"],  ticker: null,        isMatas: true },
  { name: "Normal",           markets: ["Denmark","Sweden","Norway"],  ticker: null },
  { name: "Lyko",             markets: ["Sweden","Norway","Finland"],  ticker: "LYKO-A.ST" },
  { name: "Sephora",          markets: ["Denmark"],                   ticker: "MC.PA" },
  { name: "Stockmann",        markets: ["Finland"],                   ticker: "STOCKA.HE" },
  { name: "The Body Shop",    markets: ["Denmark","Finland"],         ticker: null },
  { name: "Åhléns",           markets: ["Sweden"],                    ticker: null },
  { name: "Apotea",           markets: ["Sweden"],                    ticker: null },
  { name: "Caia",             markets: ["Sweden"],                    ticker: null },
  { name: "Fredrik & Louisa", markets: ["Norway"],                    ticker: null },
  { name: "Vita",             markets: ["Norway"],                    ticker: null },
  { name: "Ruohonjuuri",      markets: ["Finland"],                   ticker: null },
  { name: "Sokos",            markets: ["Finland"],                   ticker: null },
  { name: "Emotion",          markets: ["Finland"],                   ticker: null },
];

const MARKETS    = ["All","Denmark","Sweden","Norway","Finland"];
const FLAGS      = { Denmark:"🇩🇰", Sweden:"🇸🇪", Norway:"🇳🇴", Finland:"🇫🇮" };
const SENT_CLR   = { positive:"#4ade80", neutral:"#fbbf24", negative:"#f87171" };
const CAT_ICONS  = { earnings:"📊", expansion:"🗺️", product:"✨", partnership:"🤝", sustainability:"🌿", leadership:"👤", market:"📈", digital:"💻" };

const TODAY = () => new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});

async function callProxy(prompt, maxTokens = 600) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function companyPrompt(c) {
  const curr = c.ticker?.endsWith("CO") ? "DKK" : c.ticker?.endsWith("ST") ? "SEK" : "EUR";
  const hint = {
    "MATAS.CO":"~90-110 DKK","LYKO-A.ST":"~55-75 SEK",
    "STOCKA.HE":"~1.5-2.5 EUR","MC.PA":"~600-700 EUR",
  }[c.ticker] || "";
  return `You are a Nordic retail analyst. Today: ${TODAY()}.
Search the web for the LATEST news about "${c.name}" - a beauty/wellbeing retailer active in ${c.markets.join(", ")}.
${c.ticker ? `Stock ticker: ${c.ticker} ${hint}.` : "Privately held."}
Return ONLY valid JSON (no markdown, no backticks):
{
  "headline": "Most newsworthy development in last 48h, one punchy sentence",
  "sentiment": "positive|neutral|negative",
  "news": [
    {"title":"Specific headline","summary":"One sentence with specifics","time":"Xh ago","category":"earnings|expansion|product|partnership|sustainability|leadership|market|digital"},
    {"title":"Specific headline","summary":"One sentence with specifics","time":"Xh ago","category":"earnings|expansion|product|partnership|sustainability|leadership|market|digital"}
  ],
  "stock": ${c.ticker ? `{"price":"realistic current price","change":"+X.X% or -X.X%","currency":"${curr}"}` : "null"},
  "insight": "One sharp strategic implication for Matas Group, max 15 words"
}`;
}

function briefPrompt(market) {
  const scope = market === "All" ? "Denmark, Sweden, Norway, and Finland" : market;
  return `Nordic beauty & wellbeing analyst. Today: ${TODAY()}.
Search the web for the latest Nordic beauty retail news in ${scope}.
Return ONLY valid JSON (no markdown, no backticks):
{
  "summary": "2 sentences: what is happening in Nordic beauty retail right now",
  "trend": "Biggest trend in 5 words",
  "industryNews": [
    {"title":"Specific industry headline","summary":"One sentence","time":"Xh ago"},
    {"title":"Specific industry headline","summary":"One sentence","time":"Xh ago"},
    {"title":"Specific industry headline","summary":"One sentence","time":"Xh ago"}
  ]
}`;
}

function Shimmer({ w, h = 13, radius = 4, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "linear-gradient(90deg,#1a1814 25%,#252118 50%,#1a1814 75%)",
      backgroundSize: "400px 100%",
      animation: "shimmer 1.5s infinite linear",
      ...style,
    }} />
  );
}

export default function Home() {
  const [market,    setMarket]    = useState("All");
  const [brief,     setBrief]     = useState(null);
  const [briefLoad, setBriefLoad] = useState(true);
  const [cards,     setCards]     = useState({});
  const [expanded,  setExpanded]  = useState(null);
  const fetched      = useRef(new Set());
  const briefFetched = useRef(new Set());

  const today = TODAY();

  const visible = COMPETITORS.filter(c => market === "All" || c.markets.includes(market));
  const loaded  = visible.filter(c => cards[c.name] && cards[c.name] !== "loading").length;

  useEffect(() => {
    if (briefFetched.current.has(market)) return;
    briefFetched.current.add(market);
    setBrief(null); setBriefLoad(true);
    callProxy(briefPrompt(market), 500)
      .then(d => { setBrief(d); setBriefLoad(false); })
      .catch(() => setBriefLoad(false));
  }, [market]);

  useEffect(() => {
    visible.forEach(c => {
      if (fetched.current.has(c.name)) return;
      fetched.current.add(c.name);
      setCards(p => ({ ...p, [c.name]: "loading" }));
      callProxy(companyPrompt(c))
        .then(d  => setCards(p => ({ ...p, [c.name]: d })))
        .catch(() => {
          setCards(p => ({ ...p, [c.name]: "error" }));
          fetched.current.delete(c.name);
        });
    });
  }, [market]);

  const pct = visible.length ? (loaded / visible.length) * 100 : 0;

  return (
    <>
      <Head>
        <title>Nordic Beauty Intelligence - Matas Group</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>

      <style>{`
        .fade  { animation: fadeUp .3s ease forwards; }
        .card  { border-radius:10px; overflow:hidden; transition:border-color .15s; }
        .card:hover { border-color: rgba(201,160,80,.32) !important; }
        .mkt   { padding:6px 15px; border-radius:20px; cursor:pointer; font-family:sans-serif; font-size:12px; border:1px solid; transition:all .15s; background:transparent; }
        .mkt:hover { background:rgba(255,255,255,.06); color:#c4bfb0 !important; }
      `}</style>

      <div style={{
        position:"sticky", top:0, zIndex:50,
        background:"#0b0b0f", borderBottom:"1px solid #191714",
        padding:"16px 28px", display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:11 }}>
          <div style={{
            width:30, height:30, borderRadius:"50%",
            background:"linear-gradient(135deg,#c9a050,#7a4a18)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:12, color:"#0b0b0f",
          }}>✦</div>
          <div>
            <div style={{ fontSize:"9.5px", letterSpacing:"0.32em", color:"#5a5040", textTransform:"uppercase", fontFamily:"sans-serif" }}>MATAS GROUP</div>
            <div style={{ fontSize:16, color:"#f0ead8", letterSpacing:"0.04em" }}>Nordic Beauty Intelligence</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:11, fontFamily:"sans-serif", color:"#3a3228" }}>{loaded}/{visible.length} companies</span>
          <div style={{ width:90, height:2, background:"#1c1a16", borderRadius:2, overflow:"hidden" }}>
            <div style={{ height:"100%", background:"linear-gradient(90deg,#c9a050,#e8c878)", width:`${pct}%`, transition:"width .5s ease", borderRadius:2 }} />
          </div>
          <span style={{ fontSize:10, color:"#3a3228", fontFamily:"sans-serif" }}>{today}</span>
        </div>
      </div>

      <div style={{ padding:"12px 28px", borderBottom:"1px solid #191714", display:"flex", gap:6, flexWrap:"wrap" }}>
        {MARKETS.map(m => (
          <button key={m} className="mkt" onClick={() => setMarket(m)} style={{
            borderColor: market===m ? "rgba(201,160,80,.45)" : "#201d17",
            background:  market===m ? "rgba(201,160,80,.13)" : "transparent",
            color:       market===m ? "#c9a050" : "#3a3228",
          }}>
            {m !== "All" ? FLAGS[m]+" " : ""}{m}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:1380, margin:"0 auto", padding:"22px 28px" }}>

        <div style={{
          padding:"18px 22px", borderRadius:10, marginBottom:22,
          background:"rgba(201,160,80,.06)", border:"1px solid rgba(201,160,80,.14)",
        }}>
          <div style={{ fontSize:"9.5px", letterSpacing:"0.28em", color:"#5a5040", textTransform:"uppercase", fontFamily:"sans-serif", marginBottom:10 }}>
            48h Market Brief · {market === "All" ? "All Nordic Markets" : `${FLAGS[market]} ${market}`}
          </div>
          {briefLoad ? (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <Shimmer w="65%" h={14} /><Shimmer w="48%" h={14} /><Shimmer w={120} h={24} radius={12} />
            </div>
          ) : brief ? (
            <div className="fade">
              <p style={{ fontSize:14, lineHeight:1.75, color:"#d4cfc6", marginBottom:12, fontFamily:"sans-serif" }}>{brief.summary}</p>
              {brief.trend && (
                <span style={{
                  display:"inline-block", padding:"4px 13px", borderRadius:20,
                  background:"rgba(201,160,80,.1)", border:"1px solid rgba(201,160,80,.22)",
                  color:"#c9a050", fontFamily:"sans-serif", fontSize:11, letterSpacing:"0.06em",
                }}>🔥 {brief.trend}</span>
              )}
              {brief.industryNews?.length > 0 && (
                <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:5 }}>
                  {brief.industryNews.map((n,i) => (
                    <div key={i} style={{ display:"flex", gap:12, alignItems:"baseline" }}>
                      <span style={{ fontSize:10, color:"#2e2b24", fontFamily:"sans-serif", whiteSpace:"nowrap", flexShrink:0 }}>{n.time}</span>
                      <span style={{ fontSize:12.5, color:"#6a6050", fontFamily:"sans-serif", lineHeight:1.5 }}>
                        <strong style={{ color:"#8a7f6e", fontWeight:"normal" }}>{n.title}</strong> — {n.summary}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize:13, color:"#3a3228", fontFamily:"sans-serif" }}>Could not load brief.</p>
          )}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:12 }}>
          {visible.map(c => {
            const d      = cards[c.name];
            const isLoaded = d && d !== "loading" && d !== "error";
            const isOpen = expanded === c.name;

            return (
              <div key={c.name} className="card" style={{
                background:   c.isMatas ? "rgba(201,160,80,.05)" : "#0f0f14",
                border:`1px solid ${c.isMatas ? "rgba(201,160,80,.18)" : "#191714"}`,
              }}>
                <div
                  onClick={() => isLoaded && setExpanded(isOpen ? null : c.name)}
                  style={{ padding:"15px 18px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:14, cursor: isLoaded ? "pointer" : "default" }}
                >
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14, color: c.isMatas ? "#c9a050" : "#d4cfc6", fontWeight: c.isMatas ? 600 : 400 }}>
                        {c.isMatas && "★ "}{c.name}
                      </span>
                      {isLoaded && (
                        <span style={{ width:6, height:6, borderRadius:"50%", flexShrink:0, background: SENT_CLR[d.sentiment] || "#fbbf24" }} />
                      )}
                      <span style={{ fontSize:11 }}>{c.markets.map(m => FLAGS[m]).join(" ")}</span>
                    </div>
                    {!d || d === "loading" ? (
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        <Shimmer w="85%" /><Shimmer w="60%" />
                      </div>
                    ) : d === "error" ? (
                      <span style={{ fontSize:12, color:"#4a3028", fontFamily:"sans-serif" }}>Failed to load — try refreshing</span>
                    ) : (
                      <div className="fade" style={{ fontSize:12.5, color:"#6a6050", fontFamily:"sans-serif", lineHeight:1.5 }}>
                        {d.headline}
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink:0, textAlign:"right", minWidth:70 }}>
                    {c.ticker && (!d || d === "loading") && (
                      <div style={{ display:"flex", flexDirection:"column", gap:5, alignItems:"flex-end" }}>
                        <Shimmer w={65} h={16} /><Shimmer w={45} h={11} />
                      </div>
                    )}
                    {isLoaded && d.stock && (
                      <div className="fade">
                        <div style={{ fontSize:15, color:"#e2ddd5", fontFamily:"sans-serif", fontVariantNumeric:"tabular-nums" }}>{d.stock.price}</div>
                        <div style={{ fontSize:11, color:"#3a3228", fontFamily:"sans-serif" }}>{d.stock.currency}</div>
                        <div style={{ fontSize:12, fontFamily:"sans-serif", color: d.stock.change?.startsWith("+") ? "#4ade80" : "#f87171" }}>
                          {d.stock.change}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {isOpen && isLoaded && (
                  <div className="fade" style={{ borderTop:"1px solid #191714", padding:"14px 18px" }}>
                    {d.insight && (
                      <div style={{
                        padding:"9px 13px", marginBottom:12, borderRadius:7,
                        background:"rgba(201,160,80,.07)", borderLeft:"3px solid rgba(201,160,80,.35)",
                        fontSize:12, color:"#8a7f6e", fontFamily:"sans-serif", lineHeight:1.55,
                      }}>📌 {d.insight}</div>
                    )}
                    {d.news?.map((n,i) => (
                      <div key={i} style={{
                        display:"flex", gap:10, alignItems:"flex-start",
                        paddingBottom:10, marginBottom:10,
                        borderBottom: i < d.news.length-1 ? "1px solid #16140f" : "none",
                      }}>
                        <span style={{ fontSize:13, flexShrink:0 }}>{CAT_ICONS[n.category] || "📰"}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, color:"#c4bfb0", marginBottom:2, lineHeight:1.4 }}>{n.title}</div>
                          <div style={{ fontSize:11.5, color:"#3e3a30", fontFamily:"sans-serif", lineHeight:1.5 }}>{n.summary}</div>
                        </div>
                        <div style={{ fontSize:10.5, color:"#2a2820", fontFamily:"sans-serif", whiteSpace:"nowrap", flexShrink:0 }}>{n.time}</div>
                      </div>
                    ))}
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
