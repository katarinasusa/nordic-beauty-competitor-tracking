export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // OECD country codes
  const countries = { Denmark: "DNK", Sweden: "SWE", Norway: "NOR", Finland: "FIN" };

  // OECD series codes
  // CSCICP03: Consumer Confidence (amplitude adjusted, normalised)
  // CPALTT01: CPI all items, % change vs same period prior year  
  // SLRTTO01: Retail trade, value, % change vs same period prior year

  const series = {
    consumerConfidence: "CSCICP03",
    cpi:               "CPALTT01",
    retailSales:       "SLRTTO01",
  };

  async function fetchOECD(seriesCode, countryCode) {
    try {
      const url = `https://stats.oecd.org/SDMX-JSON/data/MEI/${countryCode}.${seriesCode}.IXOBSAM.M/all?startTime=2024-01&dimensionAtObservation=allDimensions&contentType=json`;
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!r.ok) throw new Error(`OECD ${r.status}`);
      const data = await r.json();

      // Extract observations
      const obs = data?.dataSets?.[0]?.observations;
      if (!obs) throw new Error("No observations");

      // Get time periods
      const times = data?.structure?.dimensions?.observation?.find(d => d.id === "TIME_PERIOD")?.values;
      if (!times) throw new Error("No time periods");

      // Find latest two non-null values
      const sorted = times
        .map((t, i) => ({ period: t.id, value: obs[`0:0:0:0:${i}`]?.[0] ?? obs[`0:0:0:${i}`]?.[0] ?? null }))
        .filter(x => x.value !== null)
        .sort((a, b) => b.period.localeCompare(a.period));

      if (sorted.length === 0) throw new Error("No data");

      const latest = sorted[0];
      const prev   = sorted[1];
      const change = prev ? (latest.value - prev.value).toFixed(2) : null;

      return {
        value:  latest.value.toFixed(1),
        period: latest.period,
        change: change ? (parseFloat(change) >= 0 ? `+${change}` : change) : null,
        direction: change ? (parseFloat(change) > 0 ? "up" : parseFloat(change) < 0 ? "down" : "flat") : "flat",
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  try {
    const results = {};

    await Promise.all(
      Object.entries(countries).map(async ([country, code]) => {
        const [cc, cpi, retail] = await Promise.all([
          fetchOECD(series.consumerConfidence, code),
          fetchOECD(series.cpi, code),
          fetchOECD(series.retailSales, code),
        ]);
        results[country] = {
          consumerConfidence: cc,
          cpi,
          retailSales: retail,
        };
      })
    );

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
