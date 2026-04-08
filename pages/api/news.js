export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { company } = req.query;
  if (!company) return res.status(400).json({ error: "Missing company" });

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  // More specific search queries for ambiguous company names
  const SEARCH_OVERRIDES = {
    "Normal":           '"Normal" retailer beauty Denmark',
    "Vita":             '"Vita" beauty retailer Norway',
    "Emotion":          '"Emotion" beauty retailer Finland',
    "Sokos":            '"Sokos" department store Finland beauty',
    "Caia":             '"Caia Cosmetics" beauty Sweden',
    "Apotea":           '"Apotea" online pharmacy Sweden beauty',
    "Fredrik & Louisa": '"Fredrik og Louisa" OR "Fredrik & Louisa" beauty Norway',
    "The Body Shop":    '"The Body Shop" beauty retail',
    "Åhléns":           '"Åhléns" department store Sweden beauty',
    "Ruohonjuuri":      '"Ruohonjuuri" beauty Finland',
    "KICKS":            '"KICKS" beauty retailer Scandinavia',
    "Lyko":             '"Lyko" beauty retailer Sweden',
    "Stockmann":        '"Stockmann" department store Finland',
    "Matas":            '"Matas" beauty retailer Denmark',
    "Sephora":          '"Sephora" beauty retailer Nordic OR Denmark',
  };

  const query = SEARCH_OVERRIDES[company]
    || `"${company}" beauty retailer Nordic`;

  try {
    const encoded = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;

    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!r.ok) throw new Error(`RSS fetch failed: ${r.status}`);

    const xml = await r.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];

      const title   = stripTags(extract(block, "title"));
      const link    = extract(block, "link") || extract(block, "guid");
      const pubDate = extract(block, "pubDate");
      const source  = extract(block, "source") || extractAttr(block, "source", "url") || "";

      if (!title || !link) continue;

      const date = pubDate ? new Date(pubDate) : null;
      if (date && date.getTime() < thirtyDaysAgo) continue;

      // Filter out clearly irrelevant results for ambiguous names
      if (isIrrelevant(company, title)) continue;

      items.push({
        title,
        link,
        source: stripTags(source),
        date:   date ? date.toISOString() : null,
        ago:    date ? timeAgo(date) : "",
      });

      if (items.length >= 5) break;
    }

    return res.status(200).json({ company, items });
  } catch (err) {
    console.error("News fetch error:", err.message);
    return res.status(500).json({ error: err.message, items: [] });
  }
}

// Post-filter to catch noise that slips through
function isIrrelevant(company, title) {
  const t = title.toLowerCase();
  const c = company.toLowerCase();

  const NOISE = {
    "normal": ["the new normal", "new normal", "back to normal", "return to normal", "feels normal", "seems normal", "perfectly normal", "abnormal", "paranormal", "new normal", "subnormal"],
    "vita":   ["vita coco", "vita liberata", "acqua di vita", "vita nuova", "dolce vita"],
    "emotion":["emotional", "emotions", "emotional intelligence", "emotionally"],
    "caia":   ["caia archon"],
  };

  const noiseTerms = NOISE[c] || [];
  return noiseTerms.some(term => t.includes(term));
}

function extract(xml, tag) {
  const m =
    xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`)) ||
    xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : "";
}

function extractAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`));
  return m ? m[1] : "";
}

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1)  return "Just now";
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
