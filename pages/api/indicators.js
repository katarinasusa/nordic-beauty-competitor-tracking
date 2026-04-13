export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const COUNTRIES = {
    Denmark: { wb: "DNK", oecd: "DNK" },
    Sweden:  { wb: "SWE", oecd: "SWE" },
    Norway:  { wb: "NOR", oecd: "NOR" },
    Finland: { wb: "FIN", oecd: "FIN" },
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

  // OECD Consumer Confidence — using the stable OECD.Stat REST API
  async function fetchConsumerConfidence(oecdCode) {
    try {
      // Try new OECD SDMX API first
      const url = `https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI,4.0/${oecdCode}.M.LI.AA.AA.IX?startPeriod=2024-06&dimensionAtObservation=TIME_PERIOD&format=jsondata`;
      const r = await fetch(url, {
        headers: {
          "Accept": "application/vnd.sdmx.data+json;version=2.0.0",
          "User-Agent": "Mozilla/5.0",
        },
      });
      if (!r.ok) throw new Error(`OECD ${r.status}`);
      const json = await r.json();

      // Navigate SDMX-JSON structure
      const dataset = json?.data?.dataSets?.[0];
      const structure = json?.data?.structures?.[0];
      const timeDim = structure?.dimensions?.observation?.find(d => d.id === "TIME_PERIOD");

      if (!dataset || !timeDim) throw new Error("Bad structure");

      const entries = timeDim.values
        .map((t, i) => {
          const key = `0:0:0:0:0:0:${i}`;
          const altKey = Object.keys(dataset.observations || {}).find(k => k.endsWith(`:${i}`));
          const val = dataset.observations?.[key]?.[0] ?? dataset.observations?.[altKey]?.[0] ?? null;
          return { period: t.id, value: val };
        })
        .filter(x => x.value !== null)
        .sort((a, b) => b.period.localeCompare(a.period));

      if (!entries.length) throw new Error("No entries");

      const latest = entries[0];
      const prev   = entries[1];
      const change = prev ? (latest.value - prev.value).toFixed(2) : null;

      return {
        value:     latest.value.toFixed(1),
        period:    latest.period,
        change:    change ? (parseFloat(change) >= 0 ? `+${change}` : change) : null,
        direction: change ? (parseFloat(change) > 0 ? "up" : parseFloat(change) < 0 ? "down" : "flat") : "flat",
        source:    "OECD",
      };
    } catch {
      // Fallback: try alternate OECD endpoint format
      try {
        const url2 = `https://stats.oecd.org/sdmx-json/data/MEI_CLI/${oecdCode}.CSCICP03.IXOBSAM.M/all?startTime=2024-06&format=jsondata`;
        const r2 = await fetch(url2, { headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" } });
        if (!r2.ok) throw new Error("fallback failed");
        const json2 = await r2.json();
        const obs   = json2?.dataSets?.[0]?.series?.["0:0:0:0"]?.observations;
        const times = json2?.structure?.dimensions?.observation?.[0]?.values;
        if (!obs || !times) throw new Error("no data");
        const entries = times
          .map((t, i) => ({ period: t.id, value: obs[String(i)]?.[0] ?? null }))
          .filter(x => x.value !== null)
          .sort((a, b) => b.period.localeCompare(a.period));
        if (!entries.length) throw new Error("empty");
        const latest = entries[0];
        const prev   = entries[1];
        const change = prev ? (latest.value - prev.value).toFixed(2) : null;
        return {
          value:     latest.value.toFixed(1),
          period:    latest.period,
          change:    change ? (parseFloat(change) >= 0 ? `+${change}` : change) : null,
          direction: change ? (parseFloat(change) > 0 ? "up" : parseFloat(change) < 0 ? "down" : "flat") : "flat",
          source:    "OECD",
        };
      } catch {
        return { error: "Unavailable" };
      }
    }
  }

  try {
    const results = {};
    await Promise.all(
      Object.entries(COUNTRIES).map(async ([country, codes]) => {
        const [cc, cpi, unemployment] = await Promise.all([
          fetchConsumerConfidence(codes.oecd),
          fetchWorldBank(codes.wb, "FP.CPI.TOTL.ZG"),
          fetchWorldBank(codes.wb, "SL.UEM.TOTL.ZS"),
        ]);
        results[country] = { consumerConfidence: cc, cpi, unemployment };
      })
    );
    res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate");
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
