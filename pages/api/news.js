const SEARCH_QUERIES = {
  "Matas":            "Matas beauty retailer Denmark",
  "KICKS":            "KICKS beauty retailer Sweden Norway Finland",
  "Normal":           "Normal discount beauty stores Denmark Sweden",
  "Lyko":             "Lyko beauty Sweden",
  "Sephora":          "Sephora beauty store Denmark",
  "Stockmann":        "Stockmann department store Finland beauty",
  "The Body Shop":    "The Body Shop beauty retail store",
  "Åhléns":           "Åhléns department store Sweden beauty",
  "Apotea":           "Apotea online pharmacy Sweden beauty",
  "Caia":             "Caia Cosmetics Sweden makeup",
  "Fredrik & Louisa": "Fredrik Louisa beauty Norway parfyme",
  "Vita":             "Vita apotek Norway health beauty",
  "Ruohonjuuri":      "Ruohonjuuri Finland beauty organic",
  "Sokos":            "Sokos department store Finland beauty",
  "Emotion":          "Emotion beauty store Finland parfymeri",
};

const FALLBACK_QUERIES = {
  "Matas":            "Matas Group",
  "KICKS":            "KICKS parfymeri",
  "Normal":           "Normal butik skønhed",
  "Lyko":             "Lyko.com",
  "Sephora":          "Sephora LVMH",
  "Stockmann":        "Stockmann Helsinki",
  "The Body Shop":    "Body Shop cosmetics",
  "Åhléns":           "Åhléns varuhus",
  "Apotea":           "Apotea apotek",
  "Caia":             "Caia Cosmetics",
  "Fredrik & Louisa": "Fredrik og Louisa",
  "Vita":             "Vita helsekost",
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
  // Free plan only supports apikey + q — nothing else
  const url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&q=${encodeURIComponent(q)}`;
  console.log(`Fetching news for: ${q}`);
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Bad JSON: ${text.slice(0,100)}`); }
  if (data.status !== "success") throw new Error(`NewsData: ${JSON.stringify(data).slice(0,200)}`);
  console.log(`Got ${data.results?.length || 0} results for: ${q}`);
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
    console.error("NEWSDATA_API_KEY not set");
    return res.status(200).json({ company, items: [] });
  }

  const noise = NOISE_FILTERS[company] || [];

  try {
    let results = await queryNewsData(apiKey, SEARCH_QUERIES[company] || company);
    let items = filterAndMap(results, noise);

    if (items.length === 0 && FALLBACK_QUERIES[company]) {
      console.log(`${company}: trying fallback query`);
      results = await queryNewsData(apiKey, FALLBACK_QUERIES[company]);
      items = filterAndMap(results, noise);
    }

    console.log(`${company}: returning ${items.length} articles`);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json({ company, items });
  } catch (err) {
    console.error(`${company} error:`, err.message);
    return res.status(200).json({ company, items: [] });
  }
}
