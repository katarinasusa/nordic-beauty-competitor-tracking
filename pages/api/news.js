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

const QUERIES = {
  "Matas": "Matas beauty Denmark", "KICKS": "KICKS beauty Scandinavia",
  "Normal": "Normal discount beauty Denmark", "Lyko": "Lyko beauty Sweden",
  "Sephora": "Sephora beauty Denmark", "Stockmann": "Stockmann Finland beauty",
  "The Body Shop": "The Body Shop beauty retail", "Åhléns": "Åhléns Sweden beauty",
  "Apotea": "Apotea Sweden pharmacy", "Caia": "Caia Cosmetics Sweden",
  "Fredrik & Louisa": "Fredrik Louisa Norway beauty", "Vita": "Vita apotek Norway",
  "Ruohonjuuri": "Ruohonjuuri Finland beauty", "Sokos": "Sokos Finland beauty",
  "Emotion": "Emotion beauty Finland",
};

const NOISE = {
  "Normal": ["new normal","back to normal","paranormal","abnormal"],
  "Vita": ["vita coco","dolce vita"], "Emotion": ["emotional","emotions"],
  "Caia": ["caia archon"], "Sokos": ["sokos hotel"],
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const { company } = req.query;
  const apiKey = process.env.NEWSDATA_API_KEY;

  if (!apiKey) return res.status(200).json({ company, items: [], error: "No API key" });
  if (!company) return res.status(400).json({ items: [] });

  const q = QUERIES[company] || company;
  // ONLY apikey and q — nothing else on free plan
  const url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&q=${encodeURIComponent(q)}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    console.log(`${company}: status=${data.status} results=${data.results?.length}`);
    if (data.status !== "success") throw new Error(JSON.stringify(data).slice(0, 200));

    const noise = NOISE[company] || [];
    const items = (data.results || [])
      .filter(a => a.title && a.link && !noise.some(n => a.title.toLowerCase().includes(n)))
      .map(a => ({ title: a.title, link: a.link, source: a.source_name || "", date: a.pubDate, ago: timeAgo(a.pubDate) }))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 5);

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json({ company, items });
  } catch (err) {
    console.error(`${company} error: ${err.message}`);
    return res.status(200).json({ company, items: [] });
  }
}
