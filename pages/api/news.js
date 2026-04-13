const SEARCH_QUERIES = {
  "Matas":            "Matas beauty Denmark",
  "KICKS":            "KICKS beauty retailer Scandinavia",
  "Normal":           "Normal discount stores Denmark beauty",
  "Lyko":             "Lyko beauty Sweden",
  "Sephora":          "Sephora beauty Denmark Nordic",
  "Stockmann":        "Stockmann Finland department store",
  "The Body Shop":    "The Body Shop beauty retail",
  "Åhléns":           "Åhléns Sweden beauty",
  "Apotea":           "Apotea Sweden pharmacy beauty",
  "Caia":             "Caia Cosmetics Sweden",
  "Fredrik & Louisa": "Fredrik Louisa Norway beauty",
  "Vita":             "Vita apotek Norway",
  "Ruohonjuuri":      "Ruohonjuuri Finland beauty",
  "Sokos":            "Sokos Finland beauty",
  "Emotion":          "Emotion beauty Finland parfymeri",
};

const NOISE_FILTERS = {
  "Normal":   ["new normal","back to normal","return to normal","paranormal","subnormal","abnormal"],
  "Vita":     ["vita coco","vita liberata","dolce vita","acqua di vita","bona vita"],
  "Emotion":  ["emotional","emotions","emotionally","emotional support"],
  "Caia":     ["caia archon","caia island"],
  "Sokos":    ["sokos hotel"],
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { company } = req.query;
  if (!company) return res.status(400).json({ error: "Missing company" });

  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key configured", items: [] });

  const query = SEARCH_QUERIES[company] || `${company} beauty retail`;
  const noise = NOISE_FILTERS[company] || [];

  try {
    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(query)}&language=en,da,sv,no,fi&category=business,top&timeframe=720`;

    const r = await fetch(url);
    if (!r.ok) {
      const err = await r.text();
      console.error("NewsData error:", err);
      return res.status(200).json({ company, items: [] });
    }

    const data = await r.json();
    if (data.status !== "success") {
      console.error("NewsData bad status:", data);
      return res.status(200).json({ company, items: [] });
    }

    const items = (data.results || [])
      .filter(a => {
        if (!a.title || !a.link) return false;
        const t = a.title.toLowerCase();
        if (noise.some(n => t.includes(n))) return false;
        return true;
      })
      .slice(0, 5)
      .map(a => ({
        title:  a.title,
        link:   a.link,
        source: a.source_id || a.source_name || "",
        date:   a.pubDate || null,
        ago:    a.pubDate ? timeAgo(new Date(a.pubDate)) : "",
      }))
      // Sort newest first
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json({ company, items });
  } catch (err) {
    console.error("News fetch error:", err.message);
    return res.status(200).json({ company, items: [] });
  }
}
