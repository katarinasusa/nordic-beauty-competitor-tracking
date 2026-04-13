const SEARCH_QUERIES = {
  "Matas":            "Matas beauty Denmark",
  "KICKS":            "KICKS beauty Scandinavia",
  "Normal":           "Normal discount stores Denmark beauty",
  "Lyko":             "Lyko beauty Sweden",
  "Sephora":          "Sephora beauty Denmark",
  "Stockmann":        "Stockmann Finland",
  "The Body Shop":    "The Body Shop beauty retail",
  "Åhléns":           "Åhléns Sweden",
  "Apotea":           "Apotea Sweden",
  "Caia":             "Caia Cosmetics Sweden",
  "Fredrik & Louisa": "Fredrik Louisa Norway beauty",
  "Vita":             "Vita apotek Norway",
  "Ruohonjuuri":      "Ruohonjuuri Finland",
  "Sokos":            "Sokos Finland beauty",
  "Emotion":          "Emotion beauty Finland",
};

// Fallback broader queries if first returns nothing
const FALLBACK_QUERIES = {
  "Matas":            "Matas Group",
  "KICKS":            "KICKS parfymeri",
  "Normal":           "Normal butik skønhed",
  "Lyko":             "Lyko.com",
  "Sephora":          "Sephora Nordic",
  "Stockmann":        "Stockmann Helsinki",
  "The Body Shop":    "Body Shop sustainability",
  "Åhléns":           "Åhléns varuhus",
  "Apotea":           "Apotea apotek",
  "Caia":             "Caia makeup",
  "Fredrik & Louisa": "Fredrik og Louisa",
  "Vita":             "Vita helse Norway",
  "Ruohonjuuri":      "Ruohonjuuri luomu",
  "Sokos":            "Sokos kosmetiikka",
  "Emotion":          "Emotion parfymeri",
};

const NOISE_FILTERS = {
  "Normal":   ["new normal","back to normal","return to normal","paranormal","subnormal","abnormal"],
  "Vita":     ["vita coco","vita liberata","dolce vita","acqua di vita"],
  "Emotion":  ["emotional","emotions","emotionally","emotional support"],
  "Caia":     ["caia archon","caia island"],
  "Sokos":    ["sokos hotel"],
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1)  return "Just now";
  if (h < 24) return `${h}h ago`;
  if (d < 7)  return `${d}d ago`;
  return date.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
}

async function queryNewsData(apiKey, q) {
  // Use /latest endpoint — correct for free tier
  // language codes: en=English, da=Danish, sv=Swedish, no=Norwegian, fi=Finnish
  const url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&q=${encodeURIComponent(q)}&language=en,da,sv,no,fi&timeframe=720`;
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`NewsData ${r.status}: ${text.slice(0, 200)}`);
  }
  const data = await r.json();
  if (data.status !== "success") {
    throw new Error(`NewsData error: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.results || [];
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { company } = req.query;
  if (!company) return res.status(400).json({ error: "Missing company", items: [] });

  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    console.error("NEWSDATA_API_KEY not set");
    return res.status(200).json({ company, items: [], error: "No API key" });
  }

  const noise = NOISE_FILTERS[company] || [];

  function filterAndMap(results) {
    return results
      .filter(a => {
        if (!a.title || !a.link) return false;
        const t = a.title.toLowerCase();
        return !noise.some(n => t.includes(n));
      })
      .map(a => ({
        title:  a.title,
        link:   a.link,
        source: a.source_name || a.source_id || "",
        date:   a.pubDate || null,
        ago:    timeAgo(a.pubDate),
      }))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 5);
  }

  try {
    // Try primary query first
    let results = await queryNewsData(apiKey, SEARCH_QUERIES[company]);
    let items = filterAndMap(results);

    // If nothing found, try fallback query
    if (items.length === 0 && FALLBACK_QUERIES[company]) {
      console.log(`No results for ${company}, trying fallback`);
      results = await queryNewsData(apiKey, FALLBACK_QUERIES[company]);
      items = filterAndMap(results);
    }

    console.log(`${company}: found ${items.length} articles`);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json({ company, items });
  } catch (err) {
    console.error(`News error for ${company}:`, err.message);
    return res.status(200).json({ company, items: [], error: err.message });
  }
}
