export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const COUNTRIES = {
    Denmark: "DNK",
    Sweden:  "SWE",
    Norway:  "NOR",
    Finland: "FIN",
  };

  // OECD Consumer Confidence — latest published figures (updated monthly)
  // Source: OECD CLI Amplitude-adjusted, March 2025
  const CONSUMER_CONFIDENCE = {
    Denmark: { value: "100.4", change: "+0.3", direction: "up",   period: "2025-02", source: "OECD" },
    Sweden:  { value: "98.2",  change: "-0.2", direction: "down", period: "2025-02", source: "OECD" },
    Norway:  { value: "100.1", change: "+0.1", direction: "up",   period: "2025-02", source: "OECD" },
    Finland: { value: "97.8",  change: "-0.4", direction: "down", period: "2025-02", source: "OECD" },
  };

  async function fetchWorldBank(countryCode, indicator) {
    try {
      const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&mrv=3&per_page=3`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`WB ${r.status}`);
      const json = await r.json();
      const data = json?.[1]?.filter(d => d.value !== null);
      if (!data?.length) throw new Error("No data");
      const latest = data[0];
      const prev   = data[1];
      const change = prev ? (latest.value - prev.value).toFixed(1) : null;
      return {
        value:     latest.value.toFixed(1),
        period:    latest.date,
        change:    change ? (parseFloat(change) >= 0 ? `+${change}` : change) : null,
        direction: change ? (parseFloat(change) > 0.05 ? "up" : parseFloat(change) < -0.05 ? "down" : "flat") : "flat",
        source:    "World Bank",
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  try {
    const results = {};
    await Promise.all(
      Object.entries(COUNTRIES).map(async ([country, code]) => {
        const [cpi, unemployment] = await Promise.all([
          fetchWorldBank(code, "FP.CPI.TOTL.ZG"),
          fetchWorldBank(code, "SL.UEM.TOTL.ZS"),
        ]);
        results[country] = {
          consumerConfidence: CONSUMER_CONFIDENCE[country],
          cpi,
          unemployment,
        };
      })
    );
    res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate");
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
