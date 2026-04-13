const SEARCH_QUERIES = {
  "Matas":            ['"Matas" skønhed OR beauty OR butik OR company', '"Matas Group" retail'],
  "KICKS":            ['"KICKS Beauty" OR "KICKS butik" Scandinavia', '"KICKS" parfymeri Sweden Norway'],
  "Normal":           ['"Normal" discount butik Denmark skønhed', '"Normal stores" beauty retail Denmark'],
  "Lyko":             ['"Lyko" beauty OR hår OR hudvård Sweden', '"Lyko.com" skönhet'],
  "Sephora":          ['"Sephora" Denmark OR Nordic beauty', '"Sephora" LVMH beauty retail'],
  "Stockmann":        ['"Stockmann" Finland kauneus OR beauty OR kosmetiikka', '"Stockmann" department store Helsinki'],
  "The Body Shop":    ['"The Body Shop" beauty OR retail OR store', '"Body Shop" sustainability beauty'],
  "Åhléns":          ['"Åhléns" skönhet OR beauty OR varuhus Sweden', '"Åhléns City" Stockholm'],
  "Apotea":           ['"Apotea" apotek OR beauty OR hudvård Sweden', '"Apotea.se" online'],
  "Caia":             ['"Caia Cosmetics" OR "Caia beauty" Sweden', '"Caia" makeup Sverige'],
  "Fredrik & Louisa": ['"Fredrik og Louisa" OR "Fredrik & Louisa" Norge', '"Fredrik Louisa" parfyme Norway'],
  "Vita":             ['"Vita" apotek OR helsekost Norway helse', '"Vita.no" OR "Vita apotek"'],
  "Ruohonjuuri":      ['"Ruohonjuuri" luomu OR kauneus Finland', '"Ruohonjuuri" beauty Helsinki'],
  "Sokos":            ['"Sokos" kosmetiikka OR kauneus Finland tavaratalo', '"S-ryhmä" Sokos beauty Finland'],
  "Emotion":          ['"Emotion" parfymeri OR kauneus Finland', '"Emotion" beauty store Finland kosmetiikka'],
};

const NOISE_FILTERS = {
  "Normal":   ["new normal","back to normal","return to normal","perfectly normal","paranormal","subnormal","abnormal"],
  "Vita":     ["vita coco","vita liberata","dolce vita","acqua di vita","vita nuova","pro vita"],
  "Emotion":  ["emotional","emotions","emotionally","emotional support","emotional intelligence"],
  "Caia":     ["caia archon","caia island","caia province"],
  "Sokos":    ["sokos hotel","sokos hotels"],
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });
  if (!url.startsWith("https://news.google.com/rss/")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
        "Accept-Language": "en-US,en;q=0.9,da;q=0.8,sv;q=0.7",
        "Referer": "https://news.google.com/",
        "Cache-Control": "no-cache",
      },
    });
    const xml = await r.text();
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
    res.setHeader("Content-Type", "application/xml");
    return res.status(200).send(xml);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
