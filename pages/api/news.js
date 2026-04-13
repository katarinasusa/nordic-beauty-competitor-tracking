const SEARCH_QUERIES = {
  "Matas":            "Matas beauty Denmark",
  "KICKS":            "KICKS beauty Scandinavia",
  "Normal":           "Normal discount stores Denmark beauty",
  "Lyko":             "Lyko beauty Sweden",
  "Sephora":          "Sephora beauty Denmark",
  "Stockmann":        "Stockmann Finland",
  "The Body Shop":    "The Body Shop beauty retail",
  "Åhléns":           "Åhléns Sweden",
  "Apotea":           "Apotea Sweden pharmacy",
  "Caia":             "Caia Cosmetics Sweden",
  "Fredrik & Louisa": "Fredrik Louisa Norway beauty",
  "Vita":             "Vita apotek Norway",
  "Ruohonjuuri":      "Ruohonjuuri Finland",
  "Sokos":            "Sokos Finland beauty",
  "Emotion":          "Emotion beauty Finland",
};

const FALLBACK_QUERIES = {
  "Matas":            "Matas Group retail",
  "KICKS":            "KICKS parfymeri Sverige",
  "Normal":           "Normal butik skønhed Danmark",
  "Lyko":             "Lyko.com hår hudvård",
  "Sephora":          "Sephora LVMH beauty",
  "Stockmann":        "Stockmann Helsinki tavaratalo",
  "The Body Shop":    "Body Shop cosmetics store",
  "Åhléns":           "Åhléns varuhus Stockholm",
  "Apotea":           "Apotea.se online apotek",
  "Caia":             "Caia makeup influencer",
  "Fredrik & Louisa": "Fredrik og Louisa parfyme",
  "Vita":             "Vita helsekost apotek",
  "Ruohonjuuri":      "Ruohonjuuri luomu Helsinki",
  "Sokos":            "Sokos kosmetiikka Finland",
  "Emotion":          "Emotion parfymeri kosmetiikka",
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
  // No timeframe — free plan max is 48h and articles are 12h delayed anyway
  // country codes: dk=Denmark, se=Sweden, no=Norway, fi=Finland
  const url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&q=${encodeURIComponent(q)}&language=en,da,sv,no,fi&country=dk,se,no,fi`;
  
  console.log(`Fetching: ${url.replace(apiKey, "HIDDEN")}`);
  
  const r = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
  });
  
  const text = await r.text();
  console.log(`Response status: ${r.status}, body preview: ${text.slice(0, 300)}`);
  
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
  
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON: ${text.slice(0, 200)}`);
  }
  
  if (data.status !== "success") {
    throw new Error(`API error: ${JSON.stringify(data).slice(0, 300)}`);
  }
  
  return data.results || [];
}

function filterAndMap(results, noise) {
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

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { company } = req.query;
  if (!company) return res.status(400).json({ error: "Missing company", items: [] });

  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    console.error("NEWSDATA_API_KEY not set in environment variables");
    return res.status(200).json({ company, items: [] });
  }

  const noise = NOISE_FILTERS[company] || [];

  try {
    // Primary query
    let results = await queryNewsData(apiKey, SEARCH_QUERIES[company] || company);
    let items = filterAndMap(results, noise);

    // Fallback if empty
    if (items.length === 0 && FALLBACK_QUERIES[company]) {
      console.log(`${company}: primary empty, trying fallback`);
      results = await queryNewsData(apiKey, FALLBACK_QUERIES[company]);
      items = filterAndMap(results, noise);
    }

    console.log(`${company}: returning ${items.length} items`);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json({ company, items });

  } catch (err) {
    console.error(`${company} news error:`, err.message);
    return res.status(200).json({ company, items: [] });
  }
}
