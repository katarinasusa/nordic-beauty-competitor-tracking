export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const tickers = ["MATAS.CO", "LYKO-A.ST", "STOCKA.HE", "MC.PA"];

  try {
    const results = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2d`;
        const r = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) throw new Error("No meta");
        const price = meta.regularMarketPrice;
        const prev  = meta.chartPreviousClose || meta.previousClose;
        const change = prev ? (((price - prev) / prev) * 100).toFixed(2) : null;
        const currency = meta.currency;
        return {
          ticker,
          price: price?.toFixed(2),
          change: change ? (change > 0 ? `+${change}%` : `${change}%`) : null,
          currency,
        };
      })
    );

    const out = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled") out[tickers[i]] = r.value;
      else out[tickers[i]] = { ticker: tickers[i], error: true };
    });

    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
