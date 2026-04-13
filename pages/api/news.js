// Simple CORS proxy - just passes Google News RSS through
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing q" });

  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    const r = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    const xml = await r.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(xml);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
