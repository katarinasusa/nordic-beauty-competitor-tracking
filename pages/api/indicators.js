export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // Consumer Confidence — real figures from national statistics / Trading Economics
  // Note: Different scales per country — labeled accordingly
  // Denmark: EU/ECFIN scale (-100 to +100, long-term avg ~0)
  // Sweden: National index (0–200, long-term avg ~100)
  // Norway: Finans Norge quarterly index (negative = pessimistic)
  // Finland: Statistics Finland / EU scale (-100 to +100)
  const CONSUMER_CONFIDENCE = {
    Denmark: { value: "-13.8", change: "-0.7", direction: "down", period: "2026-03", source: "Statistics Denmark" },
    Sweden:  { value: "95.2",  change: "-1.1", direction: "down", period: "2026-03", source: "Statistics Sweden"  },
    Norway:  { value: "-9.4",  change: "-4.7", direction: "down", period: "2026-Q1", source: "Finans Norge"        },
    Finland: { value: "-11.5", change: "-1.0", direction: "down", period: "2026-03", source: "Statistics Finland"  },
  };

  const COUNTRIES = {
    Denmark: "DNK",
    Sweden:  "SWE",
    Norway:  "NOR",
    Finland: "FIN",
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
