async function fetchOECDConfidence() {
  // OECD CLI (Composite Leading Indicator) - Consumer Confidence
  // Countries: DNK=Denmark, SWE=Sweden, NOR=Norway, FIN=Finland
  const countries = { DNK: "Denmark", SWE: "Sweden", NOR: "Norway", FIN: "Finland" };
  const url = `https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI,4.0/DNK+SWE+NOR+FIN.M.LI.AA.AA.IX?startPeriod=2024-06&format=jsondata&dimensionAtObservation=AllDimensions`;
  const r = await fetch(url, {
    headers: { "Accept": "application/vnd.sdmx.data+json;version=2.0" },
  });
  if (!r.ok) throw new Error(`OECD ${r.status}`);
  const d = await r.json();

  const dims = d.data.structure.dimensions.observation;
  const countryDim = dims.find(x => x.id === "REF_AREA");
  const timeDim = dims.find(x => x.id === "TIME_PERIOD");
  const obs = d.data.dataSets[0].observations;

  const results = {};
  Object.entries(obs).forEach(([key, val]) => {
    const idxs = key.split(":");
    const countryCode = countryDim.values[parseInt(idxs[countryDim.keyPosition])].id;
    const timeVal = timeDim.values[parseInt(idxs[timeDim.keyPosition])].id;
    if (!results[countryCode] || timeVal > results[countryCode].time) {
      results[countryCode] = { value: val[0], time: timeVal };
    }
  });

  return Object.entries(results).map(([code, v]) => ({
    country: countries[code] || code,
    value: v.value?.toFixed(1),
    time: v.time,
  }));
}

async function fetchEurostatCPI() {
  // Eurostat HICP - annual rate of change, all items
  const geos = ["DK", "SE", "NO", "FI"];
  const countryNames = { DK: "Denmark", SE: "Sweden", NO: "Norway", FI: "Finland" };
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_manr?geo=${geos.join("&geo=")}&coicop=CP00&sinceTimePeriod=2024-M06&format=JSON&lang=EN`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Eurostat ${r.status}`);
  const d = await r.json();

  const geoIndex = d.dimension.geo.category.index;
  const timeIndex = d.dimension.time.category.index;
  const values = d.value;
  const timeKeys = Object.keys(timeIndex).sort().reverse();
  const results = {};

  geos.forEach(geo => {
    const gi = geoIndex[geo];
    if (gi === undefined) return;
    for (const t of timeKeys) {
      const ti = timeIndex[t];
      const idx = gi * Object.keys(timeIndex).length + ti;
      if (values[idx] !== undefined && values[idx] !== null) {
        results[geo] = { value: values[idx].toFixed(1), time: t };
        break;
      }
    }
  });

  return Object.entries(results).map(([code, v]) => ({
    country: countryNames[code] || code,
    cpi: v.value,
    time: v.time,
  }));
}

async function fetchEurostatRetail() {
  // Eurostat retail trade volume index - monthly
  const geos = ["DK", "SE", "NO", "FI"];
  const countryNames = { DK: "Denmark", SE: "Sweden", NO: "Norway", FI: "Finland" };
  // sts_trtu_m - retail trade, total, growth rate
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sts_trtu_m?geo=${geos.join("&geo=")}&indic_bt=TOVV&nace_r2=G47&s_adj=NSA&unit=PCH_SM&sinceTimePeriod=2024-M06&format=JSON&lang=EN`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Eurostat retail ${r.status}`);
  const d = await r.json();

  const geoIndex = d.dimension.geo.category.index;
  const timeIndex = d.dimension.time.category.index;
  const values = d.value;
  const timeKeys = Object.keys(timeIndex).sort().reverse();
  const results = {};

  geos.forEach(geo => {
    const gi = geoIndex[geo];
    if (gi === undefined) return;
    for (const t of timeKeys) {
      const ti = timeIndex[t];
      const idx = gi * Object.keys(timeIndex).length + ti;
      if (values[idx] !== undefined && values[idx] !== null) {
        results[geo] = { value: values[idx].toFixed(1), time: t };
        break;
      }
    }
  });

  return Object.entries(results).map(([code, v]) => ({
    country: countryNames[code] || code,
    retailGrowth: v.value,
    time: v.time,
  }));
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const [confidenceRes, cpiRes, retailRes] = await Promise.allSettled([
    fetchOECDConfidence(),
    fetchEurostatCPI(),
    fetchEurostatRetail(),
  ]);

  const confidence = confidenceRes.status === "fulfilled" ? confidenceRes.value : [];
  const cpi        = cpiRes.status === "fulfilled" ? cpiRes.value : [];
  const retail     = retailRes.status === "fulfilled" ? retailRes.value : [];

  // Merge by country
  const countries = ["Denmark", "Sweden", "Norway", "Finland"];
  const merged = countries.map(country => {
    const c = confidence.find(x => x.country === country);
    const p = cpi.find(x => x.country === country);
    const r = retail.find(x => x.country === country);
    return {
      country,
      confidence: c ? { value: c.value, time: c.time } : null,
      cpi: p ? { value: p.cpi, time: p.time } : null,
      retailGrowth: r ? { value: r.retailGrowth, time: r.time } : null,
    };
  });

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  return res.status(200).json({ countries: merged, fetchedAt: new Date().toISOString() });
}
