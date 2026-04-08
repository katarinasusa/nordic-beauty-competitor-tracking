export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { company } = req.query;
  if (!company) return res.status(400).json({ error: "Missing company" });

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  try {
    const query = encodeURIComponent(`"${company}" beauty retail`);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!r.ok) throw new Error(`RSS fetch failed: ${r.status}`);

    const xml = await r.text();

    // Parse items from RSS XML
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

      items.push({
        title,
        link,
        source: stripTags(source),
        date: date ? date.toISOString() : null,
        ago: date ? timeAgo(date) : "",
      });

      if (items.length >= 5) break;
    }

    return res.status(200).json({ company, items });
  } catch (err) {
    console.error("News fetch error:", err.message);
    return res.status(500).json({ error: err.message, items: [] });
  }
}

function extract(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))||
            xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : "";
}

function extractAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`));
  return m ? m[1] : "";
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
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
