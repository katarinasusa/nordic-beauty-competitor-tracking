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

const SEARCH_QUERIES = {
  "Matas":            '"Matas" butik OR webshop OR skønhed OR beauty Denmark',
  "KICKS":            '"KICKS" beauty retailer Scandinavia OR Sweden OR Norway OR Finland',
  "Normal":           '"Normal" discount retailer Denmark OR Sweden OR Norway skønhed',
  "Lyko":             '"Lyko" beauty Sweden hair',
  "Sephora":          '"Sephora" beauty Denmark OR Nordic',
  "Stockmann":        '"Stockmann" department store Finland beauty',
  "The Body Shop":    '"The Body Shop" beauty retail store',
  "Åhléns":           '"Åhléns" varuhus Sweden beauty',
  "Apotea":           '"Apotea" apotek online Sweden',
  "Caia":             '"Caia Cosmetics" OR "Caia beauty" Sweden',
  "Fredrik & Louisa": '"Fredrik og Louisa" OR "Fredrik & Louisa" Norge beauty',
  "Vita":             '"Vita" apotek OR helsekost Norway',
  "Ruohonjuuri":      '"Ruohonjuuri" Finland luomu beauty',
  "Sokos":            '"Sokos" tavaratalo Finland beauty kosmetiikka',
  "Emotion":          '"Emotion" parfymeri Finland beauty',
};

const NOISE_FILTERS = {
  "Normal":   ["new normal","back to normal","return to normal","perfectly normal","paranormal","subnormal","abnormal","feels normal"],
  "Vita":     ["vita coco","vita liberata","dolce vita","acqua di vita","vita nuova"],
  "Emotion":  ["emotional","emotions","emotionally","emotional support"],
  "Caia":     ["caia archon","caia island"],
  "Sokos":    ["sokos hotel"],
};

const MARKETS = ["All","Denmark","Sweden","Norway","Finland"];
const FLAGS   = { Denmark:"🇩🇰", Sweden:"🇸🇪", Norway:"🇳🇴", Finland:"🇫🇮" };

const SENT_STYLE = {
  positive: { bg: "#E8F0EC", color: "#2D6A4F", label: "Positive" },
  neutral:  { bg: "#F0EBE3", color: "#7A6A5A", label: "Neutral"  },
  negative: { bg: "#F0E8E8", color: "#7A3A3A", label: "Negative" },
};

const TODAY = () => new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});

const T = {
  cream:     "#EDE8E0",
  creamDark: "#E3DDD4",
  forest:    "#1C2B2B",
  mauve:     "#9E7B7B",
  mauveDark: "#7A5A5A",
  mauveLight:"#C9AEAE",
  border:    "#D5CEC6",
  text:      "#1C2B2B",
  textMid:   "#4A5A5A",
  textMuted: "#8A9090",
  white:     "#FAFAF8",
};

// ── Helpers ───────────────────────────────────────────────────────────

function extract(xml, tag) {
  const m =
    xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`)) ||
    xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : "";
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}

function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1)  return "Just now";
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return date.toLocaleDateString("en-GB", { day:"numeric", month:"short" });
}

function parseRSS(xml, company) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const noise = (NOISE_FILTERS[company] || []);
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block   = match[1];
    const title   = stripTags(extract(block, "title"));
    const link    = extract(block, "link") || extract(block, "guid");
    const pubDate = extract(block, "pubDate");
    const source  = stripTags(extract(block, "source"));
    if (!title || !link) continue;
    const date = pubDate ? new Date(pubDate) : null;
    if (date && date.getTime() < thirtyDaysAgo) continue;
    const tl = title.toLowerCase();
    if (noise.some(n => tl.includes(n))) continue;
    items.push({ title, link, source, date: date?.toISOString() || null, ago: date ? timeAgo(date) : "" });
    if (items.length >= 5) break;
  }
  return items;
}

async function fetchNewsClient(company) {
  const query = SEARCH_QUERIES[company] || `"${company}" beauty retail Nordic`;
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const proxyUrl = `/api/news?url=${encodeURIComponent(rssUrl)}`;
  const r = await fetch(proxyUrl);
  if (!r.ok) return [];
  const xml = await r.text();
  return parseRSS(xml, company);
}

async function callProxy(prompt, maxTokens = 800) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function insightPrompt(c, newsItems) {
  const headlines = newsItems.map(n => `- ${n.title}`).join("\n");
  return `You are a Nordic beauty retail strategist at Matas Group. Today: ${TODAY()}.
Based on these recent news headlines about "${c.name}" (active in ${c.markets.join(", ")}):
${headlines || "No recent news found."}
Return ONLY valid JSON (no markdown):
{
  "sentiment": "positive|neutral|negative",
  "insight": "One sharp strategic implication for Matas Group, max 20 words"
}`;
}

function briefPrompt(market) {
  const scope = market === "All" ? "Denmark, Sweden, Norway, and Finland" : market;
  return `Nordic beauty & wellbeing analyst. Today: ${TODAY()}.
Write a market intelligence brief for the Nordic beauty retail sector in ${scope}.
Return ONLY valid JSON (no markdown):
{
  "summary": "2 sentences on what is happening in Nordic beauty retail right now",
  "trend": "Biggest trend in 5 words",
  "industryNews": [
    {"title":"Headline","summary":"One sentence","time":"Xh ago"},
    {"title":"Headline","summary":"One sentence","time":"Xh ago"},
    {"title":"Headline","summary":"One sentence","time":"Xh ago"}
  ]
}`;
}

function Shimmer({ w, h = 13, radius = 3, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: `linear-gradient(90deg, #E3DDD4 25%, #D5CEC6 50%, #E3DDD4 75%)`,
      backgroundSize: "600px 100%",
      animation: "shimmer 1.6s infinite linear",
      ...style,
    }} />
  );
}

function IndicatorBlock({ label, data, unit = "" }) {
  if (!data) return (
    <div style={{ background: T.white, padding: "16px 18px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textMuted, marginBottom: 8 }}>{label}</div>
      <Shimmer w={60} h={22} />
    </div>
  );
  if (data.error) return (
    <div style={{ background: T.white, padding: "16px 18px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textMuted, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 11, color: T.textMuted, fontStyle: "italic" }}>Unavailable</div>
    </div>
  );
  return (
    <div style={{ background: T.white, padding: "16px 18px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textMuted, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 300, color: T.forest, letterSpacing: "-0.02em" }}>
          {data.value}{unit}
        </span>
        {data.change && (
          <span style={{
            fontSize: 11, fontWeight: 500,
            color: data.direction === "up" ? "#2D6A4F" : data.direction === "down" ? "#7A3A3A" : T.textMuted,
          }}>
            {data.direction === "up" ? "↑" : data.direction === "down" ? "↓" : "→"} {data.change}
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: T.textMuted }}>{data.period} · {data.source}</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
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

  const visible = COMPETITORS.filter(c => market === "All" || c.markets.includes(market));
  const loaded  = visible.filter(c => cards[c.name] && cards[c.name] !== "loading").length;
  const pct     = visible.length ? (loaded / visible.length) * 100 : 0;

  useEffect(() => {
    fetch("/api/stocks").then(r => r.json()).then(setStocks).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/indicators").then(r => r.json()).then(setIndicators).catch(() => {});
  }, []);

  useEffect(() => {
    if (briefFetched.current.has(market)) return;
    briefFetched.current.add(market);
    setBrief(null); setBriefLoad(true);
    callProxy(briefPrompt(market), 600)
      .then(d  => { setBrief(d); setBriefLoad(false); })
      .catch(() => setBriefLoad(false));
  }, [market]);

  useEffect(() => {
    const toFetch = visible.filter(c => !fetched.current.has(c.name));
    toFetch.forEach(c => {
      fetched.current.add(c.name);
      setCards(p => ({ ...p, [c.name]: "loading" }));
    });
    toFetch.forEach((c, i) => {
      setTimeout(async () => {
        try {
          const items = await fetchNewsClient(c.name);
          let sentiment = "neutral", insight = "";
          try {
            const ai = await callProxy(insightPrompt(c, items), 200);
            sentiment = ai.sentiment || "neutral";
            insight   = ai.insight   || "";
          } catch (_) {}
          setCards(p => ({ ...p, [c.name]: { items, sentiment, insight } }));
        } catch {
          setCards(p => ({ ...p, [c.name]: "error" }));
          fetched.current.delete(c.name);
        }
      }, i * 4000);
    });
  }, [market]);

  const indicatorMarkets = market === "All"
    ? ["Denmark","Sweden","Norway","Finland"]
    : [market];

  return (
    <>
      <Head>
        <title>Nordic Beauty Intelligence — Matas Group</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>

      <style>{`
        .fade { animation: fadeUp .3s ease forwards; }
        .card {
          transition: box-shadow .2s, border-color .2s;
          display: grid;
          grid-template-rows: 1fr auto auto;
        }
        .card:hover { box-shadow: 0 2px 16px rgba(28,43,43,.08); border-color: #7A5A5A !important; }
        .mkt-btn { transition: all .15s; cursor: pointer; font-family: inherit; }
        .mkt-btn:hover { background: #E3DDD4 !important; }
        .expand-btn { transition: background .15s; cursor: pointer; border: none; font-family: inherit; }
        .expand-btn:hover { background: #E3DDD4 !important; }
        .news-row { transition: background .15s; display: flex; text-decoration: none; }
        .news-row:hover { background: #EDE8E0 !important; }
      `}</style>

      {/* Header */}
      <div style={{
        background: T.forest, color: T.cream, padding: "0 40px",
        display: "flex", alignItems: "stretch", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "18px 0" }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.45em", color: T.mauveLight, textTransform: "uppercase", marginBottom: 4 }}>MATAS GROUP</div>
            <div style={{ fontSize: 17, letterSpacing: "0.12em", textTransform: "uppercase", color: T.cream, fontWeight: 300 }}>Nordic Beauty Intelligence</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 11, color: T.mauveLight }}>{loaded}/{visible.length} loaded</div>
            <div style={{ width: 80, height: 2, background: "rgba(255,255,255,0.15)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{ height: "100%", background: T.mauveLight, width: `${pct}%`, transition: "width .5s ease" }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: T.mauveLight, borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: 24 }}>{today}</div>
        </div>
      </div>

      {/* Market tabs */}
      <div style={{ background: T.cream, borderBottom: `1px solid ${T.border}`, padding: "0 40px", display: "flex" }}>
        {MARKETS.map(m => (
          <button key={m} className="mkt-btn" onClick={() => setMarket(m)} style={{
            padding: "14px 20px", background: "transparent", border: "none",
            borderBottom: market === m ? `2px solid ${T.forest}` : "2px solid transparent",
            color: market === m ? T.forest : T.textMuted,
            fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase",
            fontWeight: market === m ? 500 : 400, marginBottom: -1,
          }}>
            {m !== "All" ? FLAGS[m]+" " : ""}{m}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 40px" }}>

        {/* Market Brief */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
            <h2 style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: T.textMuted, fontWeight: 400 }}>48h Market Brief</h2>
            <span style={{ color: T.border }}>—</span>
            <span style={{ fontSize: 11, color: T.textMuted }}>
              {market === "All" ? "All Nordic Markets" : `${FLAGS[market]} ${market}`}
            </span>
          </div>

          {briefLoad ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Shimmer w="55%" h={16} /><Shimmer w="40%" h={16} />
            </div>
          ) : brief ? (
            <div className="fade">
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "start", marginBottom: 28 }}>
                <p style={{ fontSize: 15, lineHeight: 1.8, color: T.textMid, maxWidth: 700 }}>{brief.summary}</p>
                {brief.trend && (
                  <div style={{ padding: "10px 18px", background: T.forest, color: T.cream, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {brief.trend}
                  </div>
                )}
              </div>

              {/* Indicators */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: T.textMuted, marginBottom: 14 }}>
                  Market Indicators — OECD & World Bank Official Data
                </div>
                {indicatorMarkets.map(mkt => (
                  <div key={mkt} style={{ marginBottom: indicatorMarkets.length > 1 ? 20 : 0 }}>
                    {indicatorMarkets.length > 1 && (
                      <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
                        {FLAGS[mkt]} {mkt}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: T.border, border: `1px solid ${T.border}` }}>
                      <IndicatorBlock label="Consumer Confidence" data={indicators?.[mkt]?.consumerConfidence} />
                      <IndicatorBlock label="CPI Inflation"       data={indicators?.[mkt]?.cpi}               unit="%" />
                      <IndicatorBlock label="Unemployment"        data={indicators?.[mkt]?.unemployment}      unit="%" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Industry context */}
              {brief.industryNews?.length > 0 && (
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: T.textMuted, marginBottom: 14 }}>Industry Context</div>
                  {brief.industryNews.map((n, i) => (
                    <div key={i} style={{ display: "flex", gap: 20, alignItems: "baseline", marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap", width: 60 }}>{n.time}</span>
                      <span style={{ fontSize: 13, color: T.textMid, lineHeight: 1.5 }}>
                        <strong style={{ color: T.forest, fontWeight: 500 }}>{n.title}</strong>
                        <span style={{ color: T.textMuted }}> — {n.summary}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: T.textMuted }}>Could not load brief.</p>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, marginBottom: 32 }} />

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
          <h2 style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: T.textMuted, fontWeight: 400 }}>Competitor Intelligence</h2>
          <span style={{ color: T.border }}>—</span>
          <span style={{ fontSize: 11, color: T.textMuted }}>{visible.length} companies tracked</span>
        </div>

        {/* Company grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 2, background: T.border }}>
          {visible.map(c => {
            const d         = cards[c.name];
            const isLoaded  = d && d !== "loading" && d !== "error";
            const isOpen    = expanded === c.name;
            const stock     = stocks[c.ticker];
            const sentStyle = isLoaded ? (SENT_STYLE[d.sentiment] || SENT_STYLE.neutral) : null;
            const hasNews   = isLoaded && d.items?.length > 0;

            return (
              <div key={c.name} className="card" style={{
                background: c.isMatas ? "#F5F0EA" : T.white,
                border: `1px solid ${c.isMatas ? T.mauveDark : "transparent"}`,
              }}>
                {/* Body */}
                <div style={{ padding: "20px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 12 }}>
                    <div>
                      {c.isMatas && (
                        <div style={{ fontSize: 9, letterSpacing: "0.2em", color: T.mauveDark, textTransform: "uppercase", marginBottom: 4 }}>Own brand</div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h3 style={{ fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 400, color: T.forest }}>{c.name}</h3>
                        <span style={{ fontSize: 12 }}>{c.markets.map(m => FLAGS[m]).join(" ")}</span>
                      </div>
                    </div>
                    {c.ticker && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {!stock ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                            <Shimmer w={55} h={18} /><Shimmer w={38} h={11} />
                          </div>
                        ) : stock.error ? null : (
                          <div className="fade">
                            <div style={{ fontSize: 17, fontWeight: 300, color: T.forest }}>{stock.price}</div>
                            <div style={{ fontSize: 10, color: T.textMuted }}>{stock.currency}</div>
                            {stock.change && (
                              <div style={{ fontSize: 11, fontWeight: 500, color: stock.change.startsWith("+") ? "#2D6A4F" : "#7A3A3A" }}>{stock.change}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!d || d === "loading" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Shimmer w="90%" h={13} /><Shimmer w="65%" h={13} />
                    </div>
                  ) : d === "error" ? (
                    <span style={{ fontSize: 12, color: T.textMuted }}>Failed to load — refresh to retry</span>
                  ) : (
                    <div className="fade">
                      {hasNews ? (
                        <p style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6, marginBottom: 12 }}>
                          {d.items[0].title}
                          <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 8 }}>{d.items[0].ago}</span>
                        </p>
                      ) : (
                        <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>No recent news found</p>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {sentStyle && (
                          <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", background: sentStyle.bg, color: sentStyle.color }}>
                            {sentStyle.label}
                          </span>
                        )}
                        {hasNews && (
                          <span style={{ fontSize: 10, color: T.textMuted }}>
                            {d.items.length} article{d.items.length !== 1 ? "s" : ""} · last 30 days
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pinned footer */}
                <div style={{ marginTop: "auto" }}>
                  {isLoaded && (
                    <button className="expand-btn" onClick={() => setExpanded(isOpen ? null : c.name)} style={{
                      width: "100%", padding: "10px 22px",
                      background: T.creamDark, borderTop: `1px solid ${T.border}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      color: T.textMuted, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase",
                    }}>
                      <span>{isOpen ? "Hide detail" : "Show detail"}</span>
                      <span style={{ fontSize: 14 }}>{isOpen ? "−" : "+"}</span>
                    </button>
                  )}
                </div>

                {/* Expanded */}
                {isOpen && isLoaded && (
                  <div className="fade" style={{ borderTop: `1px solid ${T.border}`, background: T.white }}>
                    {d.insight && (
                      <div style={{
                        padding: "14px 22px", background: "#F5F0EA",
                        borderBottom: `1px solid ${T.border}`,
                        fontSize: 12, color: T.mauveDark, lineHeight: 1.6,
                      }}>
                        <span style={{ fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", color: T.mauveLight, display: "block", marginBottom: 4 }}>
                          Strategic note — AI analysis of recent headlines
                        </span>
                        {d.insight}
                      </div>
                    )}
                    {hasNews ? d.items.map((n, i) => (
                      <a key={i} href={n.link} target="_blank" rel="noopener noreferrer"
                        className="news-row"
                        style={{
                          gap: 14, alignItems: "flex-start",
                          padding: "14px 22px", color: "inherit",
                          borderBottom: i < d.items.length - 1 ? `1px solid ${T.border}` : "none",
                          background: "transparent",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: T.forest, marginBottom: 3, lineHeight: 1.4 }}>{n.title}</div>
                          {n.source && <div style={{ fontSize: 10, color: T.textMuted }}>{n.source}</div>}
                        </div>
                        <div style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap", flexShrink: 0, marginLeft: 14 }}>{n.ago}</div>
                      </a>
                    )) : (
                      <div style={{ padding: "16px 22px" }}>
                        <a href={`https://news.google.com/search?q=${encodeURIComponent(c.name + " beauty")}&hl=en`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12, color: T.mauveDark }}>
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
