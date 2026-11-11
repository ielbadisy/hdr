// World map of dataset origins, centred on Morocco.
// Countries are shaded by the number of datasets whose origin is in that
// country (window.HDR_STATS, written by tools/build.R). Morocco is drawn
// in full, including its southern provinces, as one shape.
(function () {
  const els = document.querySelectorAll(".hdr-map");
  if (!els.length || !window.d3 || !window.topojson) return;
  const stats = window.HDR_STATS || { counts: [] };
  const key = id => String(+id);
  const byId = new Map(stats.counts.map(c => [key(c.m49), c]));
  const max = Math.max(1, ...stats.counts.map(c => c.n));

  els.forEach(el => fetch(el.dataset.world).then(r => r.json()).then(world => draw(el, world)));

  function colours(el) {
    const s = getComputedStyle(el);
    const v = (n, f) => s.getPropertyValue(n).trim() || f;
    return { empty: v("--map-empty", "#eef0f4"), lo: v("--map-lo", "#c7d2fe"),
             hi: v("--map-hi", "#312e81"), line: v("--map-line", "#ffffff"),
             focus: v("--map-focus", "#e11d48") };
  }

  function draw(el, world) {
    const geoms = world.objects.countries.geometries.filter(g => g.id !== "010");
    const ma = ["504", "732"];
    const morocco = { type: "Feature", id: "504", properties: { name: "Morocco" },
      geometry: topojson.merge(world, geoms.filter(g => ma.includes(g.id))) };
    const features = topojson.feature(world, { type: "GeometryCollection",
      geometries: geoms.filter(g => !ma.includes(g.id)) }).features.concat([morocco]);

    const w = 960;
    const projection = d3.geoNaturalEarth1().rotate([7, 0]).fitWidth(w, { type: "Sphere" });
    const path = d3.geoPath(projection);
    const [[, y0], [, y1]] = path.bounds({ type: "FeatureCollection", features });
    const svg = d3.select(el).append("svg")
      .attr("viewBox", `0 ${Math.floor(y0) - 6} ${w} ${Math.ceil(y1 - y0) + 12}`)
      .attr("role", "img")
      .attr("aria-label", "World map of dataset origins, centred on Morocco");

    svg.append("path").attr("class", "map-graticule").attr("d", path(d3.geoGraticule10()));
    const tip = d3.select(el).append("div").attr("class", "map-tip").style("opacity", 0);
    const catalogue = el.dataset.catalogue || "datasets.html";

    const shapes = svg.append("g").selectAll("path").data(features).join("path")
      .attr("class", d => "map-country" + (byId.has(key(d.id)) ? " has-data" : "") +
                          (d.id === "504" ? " is-focus" : ""))
      .attr("d", path)
      .on("mousemove", (ev, d) => {
        const c = byId.get(key(d.id));
        const n = c ? c.n : 0;
        const [mx, my] = d3.pointer(ev, el);
        tip.style("opacity", 1).style("left", mx + 12 + "px").style("top", my + 12 + "px")
          .html(`<strong>${d.properties.name}</strong><br>${n ? n + (n > 1 ? " datasets" : " dataset") : "No dataset yet"}`);
      })
      .on("mouseleave", () => tip.style("opacity", 0))
      .on("click", (ev, d) => {
        const c = byId.get(key(d.id));
        if (c) window.location.href = `${catalogue}?country=${encodeURIComponent(c.name)}`;
      });

    function paint() {
      const k = colours(el);
      const ramp = d3.scaleSqrt().domain([1, max]).range([0.3, 1]).clamp(true);
      const mix = d3.interpolateRgb(k.lo, k.hi);
      shapes.attr("fill", d => {
        const c = byId.get(key(d.id));
        return c ? mix(max === 1 ? 0.75 : ramp(c.n)) : k.empty;
      }).attr("stroke", k.line);
      const leg = el.parentElement.querySelector(".map-legend .ramp");
      if (leg) leg.style.background = `linear-gradient(90deg, ${mix(0.3)}, ${k.hi})`;
    }
    paint();
    new MutationObserver(paint).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const legMax = el.parentElement.querySelector(".map-legend .max");
    if (legMax) legMax.textContent = max;
  }
})();
