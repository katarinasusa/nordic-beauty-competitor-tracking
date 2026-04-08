function googleNewsRSS(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title   = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || "";
    const link    = (item.match(/<link>(.*?)<\/link>/) || [])[1] || "";
    const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
    const source  = (item.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || "";
    if (title && link) {
      items.push({ title: title.trim(), link: link.trim(), pubDate, source: source.trim() });
    }
  }
  return items;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(hours / 24);
    if (hours < 1)  return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 30)  return `${days}d ago`;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch { return ""; }
}

function isWithinDays(dateStr, days) {
  try {
    const d = new Date(dateStr);
    return (Date.now() - d.getTime()) < days * 86400000;
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const { company } = req.query;
  if (!company) return res.status(400).json({ error: "company required" });

  const queries = [
    `"${company}" beauty retail`,
    `"${company}" Nordic`,
  ];

  try {
    const results = await Promise.allSettled(
      queries.map(q =>
        fetch(googleNewsRSS(q), { headers: { "User-Agent": "Mozilla/5.0" } })
          .then(r => r.text())
          .then(parseRSS)
      )
    );

    // Merge, deduplicate by title, filter last 30 days, sort latest first
    const seen = new Set();
    const items = [];
    results.forEach(r => {
      if (r.status !== "fulfilled") return;
      r.value.forEach(item => {
        const key = item.title.slice(0, 60);
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
          ...item,
          timeAgo: timeAgo(item.pubDate),
          recent: isWithinDays(item.pubDate, 30),
          timestamp: new Date(item.pubDate).getTime() || 0,
        });
      });
    });

    items.sort((a, b) => b.timestamp - a.timestamp);
    const filtered = items.filter(i => i.recent).slice(0, 6);
    // If nothing in last 30 days, return latest 4 regardless
    const final = filtered.length > 0 ? filtered : items.slice(0, 4);

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
    return res.status(200).json({ company, items: final });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
