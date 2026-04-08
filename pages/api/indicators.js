export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const COUNTRIES = {
    Denmark: { wb: "DNK", oecd: "DNK" },
    Sweden:  { wb: "SWE", oecd: "SWE" },
    Norway:  { wb: "NOR", oecd: "NOR" },
    Finland: { wb: "FIN", oecd: "FIN" },
  };

  // World Bank indicator codes
  const WB_CPI         = "FP.CPI.TOTL.ZG";  // CPI inflation, annual %
  const WB_RETAIL      = "NE.CON.PRVT.KD.ZG"; // Household consumption growth %
  const WB_UNEMPLOY    = "SL.UEM.TOTL.ZS";  // Unemployment %

  async function fetchWorldBank(countryCode, indicator) {
    try {
      const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&mrv=2&per_page=2`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`WB ${r.status}`);
      const json = await r.json();
      const data = json?.[1];
      if (!data?.length) throw new Error("No data");

      // Find latest non-null entry
      const latest = data.find(d => d.value !== null);
      const prev   = data.find(d => d.value !== null && d.date !== latest?.date);
      if (!latest) throw new Error("No value");

      const change = prev ? (latest.value - prev.value).toFixed(1) : null;
      return {
        value:     latest.value.toFixed(1),
        period:    latest.date,
        change:    change ? (parseFloat(change) >= 0 ? `+${change}` : `${change}`) : null,
        direction: change ? (parseFloat(change) > 0.05 ? "up" : parseFloat(change) < -0.05 ? "down" : "flat") : "flat",
        source:    "World Bank",
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async function fetchOECDConsumerConfidence(oecdCode) {
    try {
      // OECD new SDMX REST API — Consumer Confidence Index
      const url = `https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI,4.0/${oecdCode}.M.LI.AA.AA.IX?startPeriod=2024-01&dimensionAtObservation=TIME_PERIOD`;
      const r = await fetch(url, {
        headers: { "Accept": "application/vnd.sdmx.data+json;version=2" },
      });
      if (!r.ok) throw new Error(`OECD CLI ${r.status}`);
      const json = await r.json();

      const obs = json?.data?.dataSets?.[0]?.observations;
      const times = json?.data?.structures?.[0]?.dimensions?.observation?.[0]?.values;

      if (!obs || !times) throw new Error("No OECD data");

      const entries = times
        .map((t, i) => ({ period: t.id, value: obs[String(i)]?.[0] ?? null }))
        .filter(x => x.value !== null)
        .sort((a, b) => b.period.localeCompare(a.period));

      if (!entries.length) throw new Error("Empty");

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
    } catch (err) {
      return { error: err.message };
    }
  }

  try {
    const results = {};

    await Promise.all(
      Object.entries(COUNTRIES).map(async ([country, codes]) => {
        const [cc, cpi, unemployment] = await Promise.all([
          fetchOECDConsumerConfidence(codes.oecd),
          fetchWorldBank(codes.wb, WB_CPI),
          fetchWorldBank(codes.wb, WB_UNEMPLOY),
        ]);
        results[country] = { consumerConfidence: cc, cpi, unemployment };
      })
    );

    // Cache for 24h — indicators don't change by the hour
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate");
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
