const formatNumber = d3.format(",");
const formatCompact = d3.format(".2s");
const formatPercent = d3.format(".1%");
const formatBirr = (value) => `${formatCompact(value).replace("G", "B")} ETB`;

const tooltip = d3.select("body").append("div").attr("class", "tooltip");

function showTooltip(event, html) {
  tooltip
    .style("display", "block")
    .html(html);
  const tooltipNode = tooltip.node();
  const bounds = tooltipNode.getBoundingClientRect();
  const pad = 12;
  const left = Math.min(event.clientX + 14, window.innerWidth - bounds.width - pad);
  const top = Math.min(event.clientY + 14, window.innerHeight - bounds.height - pad);
  tooltip
    .style("left", `${Math.max(pad, left)}px`)
    .style("top", `${Math.max(pad, top)}px`);
}

function hideTooltip() {
  tooltip.style("display", "none");
}

function resizeSvg(container, height) {
  d3.select(container).selectAll("*").remove();
  const width = container.clientWidth || 640;
  return d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height);
}

function drawHorizontalBars(containerId, data, options) {
  const container = document.getElementById(containerId);
  const height = Math.max(230, data.length * 34 + 44);
  const svg = resizeSvg(container, height);
  const width = container.clientWidth || 640;
  const margin = { top: 12, right: 28, bottom: 24, left: options.left || 150 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleLinear()
    .domain([0, d3.max(data, (d) => d.count) || 1])
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleBand()
    .domain(data.map((d) => d.name))
    .range([0, innerHeight])
    .padding(0.22);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0))
    .call((axis) => axis.select(".domain").remove());

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(width < 520 ? 3 : 5).tickFormat(formatCompact));

  g.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", 0)
    .attr("y", (d) => y(d.name))
    .attr("width", (d) => x(d.count))
    .attr("height", y.bandwidth())
    .attr("rx", 3)
    .attr("fill", options.color)
    .on("mousemove", (event, d) => showTooltip(event, `<strong>${d.name}</strong><br>${formatNumber(d.count)} businesses`))
    .on("mouseleave", hideTooltip);

  g.selectAll(".bar-label")
    .data(data)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", (d) => x(d.count) > innerWidth - 50 ? x(d.count) - 8 : x(d.count) + 8)
    .attr("y", (d) => y(d.name) + y.bandwidth() / 2 + 4)
    .attr("text-anchor", (d) => x(d.count) > innerWidth - 50 ? "end" : "start")
    .style("fill", (d) => x(d.count) > innerWidth - 50 ? "#fffdf8" : null)
    .text((d) => formatCompact(d.count));
}

/* Categorical series palette, in the fixed order validated for colour-blind
   separation. Assigned in sequence and never cycled. */
function seriesPalette() {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((i) => getCss(`--series-${i}`));
}

/* One sector -> colour mapping shared by every chart, built once from the full
   dataset. Colour follows the entity, not its rank: filtering to a region changes
   which sectors are on screen but never repaints the ones that remain. */
let sectorColorScale = null;

function buildSectorColorScale(data) {
  const totals = new Map();
  (data.topSectors || []).forEach((s) => totals.set(s.name, s.count));
  (data.sectorCapitalComposition || []).forEach((s) => {
    if (!totals.has(s.sector)) totals.set(s.sector, 0);
  });
  (data.regionProfiles || []).forEach((r) =>
    (r.sectorMix || []).forEach((s) => {
      if (!totals.has(s.name)) totals.set(s.name, 0);
    })
  );
  const domain = Array.from(totals.keys()).sort(
    (a, b) => (totals.get(b) - totals.get(a)) || a.localeCompare(b)
  );
  sectorColorScale = d3.scaleOrdinal(domain, seriesPalette());
  return sectorColorScale;
}

function sectorColor(name) {
  return sectorColorScale ? sectorColorScale(name) : getCss("--series-1");
}

function drawDonut(containerId, data) {
  const container = document.getElementById(containerId);
  const width = container.clientWidth || 420;
  // Fill the height the flex row gives us, so the donut grows into the card
  // instead of leaving dead space beneath it. Falls back to the intrinsic size.
  const available = container.clientHeight || 0;
  const intrinsic = Math.max(380, Math.min(width * 0.92, 470));
  const height = Math.max(intrinsic, Math.min(available, 640));
  const svg = resizeSvg(container, height);
  const safePad = 10;
  const labelPad = 7;
  // The side-label gutter was reserving up to 150px each side, which squeezed the
  // radius down to its 64px floor and left the donut adrift in a large card.
  // A tighter gutter (labels already shorten themselves to fit) lets the ring use
  // the space it has.
  const maxSideLabelWidth = Math.max(52, Math.min(112, width / 2 - safePad - 40));
  const radius = Math.max(72, Math.min(width / 2 - maxSideLabelWidth - 18, height / 2 - 64));
  const color = (name) => sectorColor(name);
  const pie = d3.pie().value((d) => d.count).sort(null);
  const arc = d3.arc().innerRadius(radius * 0.58).outerRadius(radius);
  const outerArc = d3.arc().innerRadius(radius + 20).outerRadius(radius + 20);
  const centerX = width / 2;
  const centerY = height / 2;
  const g = svg.append("g").attr("transform", `translate(${centerX},${centerY})`);
  const slices = pie(data);
  const truncateLabel = (label) => {
    const maxChars = Math.max(6, Math.floor((maxSideLabelWidth - labelPad * 2) / 7));
    return label.length > maxChars ? `${label.slice(0, Math.max(3, maxChars - 3))}...` : label;
  };

  g.selectAll("path")
    .data(slices)
    .join("path")
    .attr("d", arc)
    .attr("fill", (d) => color(d.data.name))
    .on("mousemove", (event, d) => showTooltip(event, `<strong>${d.data.name}</strong><br>${formatNumber(d.data.count)} businesses`))
    .on("mouseleave", hideTooltip);

  const labels = slices
    .filter((d) => d.endAngle - d.startAngle > 0.08)
    .map((d) => {
      const mid = (d.startAngle + d.endAngle) / 2;
      const anchor = mid < Math.PI ? "start" : "end";
      const elbow = outerArc.centroid(d);
      const labelX = anchor === "start"
        ? width - safePad - maxSideLabelWidth + labelPad
        : safePad + maxSideLabelWidth - labelPad;
      const connectorX = anchor === "start" ? labelX - labelPad : labelX + labelPad;
      return {
        ...d,
        anchor,
        start: [centerX + arc.centroid(d)[0], centerY + arc.centroid(d)[1]],
        elbow: [centerX + elbow[0], centerY + elbow[1]],
        end: [connectorX, centerY + elbow[1]],
        x: labelX,
        y: centerY + elbow[1],
        label: truncateLabel(d.data.name),
      };
    });

  const spreadLabels = (items) => {
    const sorted = [...items].sort((a, b) => a.y - b.y);
    const minY = safePad + 24;
    const maxY = height - safePad - 24;
    const gap = 30;
    sorted.forEach((label, index) => {
      label.y = Math.max(minY, Math.min(maxY, label.y));
      if (index > 0 && label.y - sorted[index - 1].y < gap) {
        label.y = sorted[index - 1].y + gap;
      }
    });
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
      if (sorted[index].y > maxY) sorted[index].y = maxY;
      if (index < sorted.length - 1 && sorted[index + 1].y - sorted[index].y < gap) {
        sorted[index].y = sorted[index + 1].y - gap;
      }
    }
    sorted.forEach((label) => {
      label.y = Math.max(minY, Math.min(maxY, label.y));
      label.end[1] = label.y;
      label.elbow[1] = label.y;
    });
  };

  spreadLabels(labels.filter((label) => label.anchor === "start"));
  spreadLabels(labels.filter((label) => label.anchor === "end"));

  svg.selectAll(".leader-line")
    .data(labels)
    .join("polyline")
    .attr("class", "leader-line")
    .attr("points", (d) => [d.start, d.elbow, d.end].map((point) => point.join(",")).join(" "))
    .attr("fill", "none");

  const labelGroups = svg.selectAll(".donut-label")
    .data(labels)
    .join("g")
    .attr("class", "donut-label")
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .on("mousemove", (event, d) => showTooltip(event, `<strong>${d.data.name}</strong><br>${formatNumber(d.data.count)} businesses`))
    .on("mouseleave", hideTooltip);

  labelGroups.append("text")
    .attr("text-anchor", (d) => d.anchor)
    .attr("dy", "0.35em")
    .text((d) => d.label);

  labelGroups.each(function () {
    const text = d3.select(this).select("text");
    let label = text.text();
    while (text.node().getBBox().width > maxSideLabelWidth - labelPad * 2 && label.length > 6) {
      label = `${label.slice(0, -4)}...`;
      text.text(label);
    }
  });

  labelGroups.insert("rect", "text")
    .attr("x", function (d) {
      const textWidth = this.parentNode.querySelector("text").getBBox().width;
      return d.anchor === "start" ? -labelPad : -textWidth - labelPad;
    })
    .attr("y", -12)
    .attr("width", function () {
      return this.parentNode.querySelector("text").getBBox().width + labelPad * 2;
    })
    .attr("height", 24)
    .attr("rx", 4);
}

function drawCapitalTreemap(containerId, data, selectedRegion = "All") {
  const container = document.getElementById(containerId);
  const sourceRows = selectedRegion === "All"
    ? data.sectorCapitalComposition
    : data.regionCapitalComposition?.[selectedRegion];
  const sectors = (sourceRows || []).filter((sector) => sector.totalCapital > 0);
  const rawRows = sectors
    .flatMap((sector) => sector.businessTypes.map((item) => ({
      name: item.type,
      sector: sector.sector,
      totalCapital: item.totalCapital,
      sectorTotal: sector.totalCapital,
    })))
    .filter((item) => item.totalCapital > 0)
    .sort((a, b) => b.totalCapital - a.totalCapital);
  const maxCapital = d3.max(rawRows, (d) => d.totalCapital) || 1;
  const minCapital = d3.min(rawRows, (d) => d.totalCapital) || maxCapital;
  const capitalRange = maxCapital / Math.max(1, minCapital);
  const displayExponent = capitalRange > 1000 ? 0.36 : capitalRange > 100 ? 0.42 : 0.5;
  const minimumDisplaySize = Math.pow(maxCapital, displayExponent) * 0.025;
  const rows = rawRows.map((item) => ({
    ...item,
    displayCapital: Math.max(Math.pow(item.totalCapital, displayExponent), minimumDisplaySize),
  }));
  const height = Math.max(560, rows.length * 24 + 170);
  const svg = resizeSvg(container, height);
  const width = container.clientWidth || 760;
  const margin = { top: 8, right: 6, bottom: 30, left: 6 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  if (!rows.length) {
    svg.append("text")
      .attr("class", "empty-state")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("No capital concentration data is available for this region.");
    return;
  }

  const color = (name) => sectorColor(name);
  const totalCapital = d3.sum(rows, (d) => d.totalCapital);
  const viewLabel = selectedRegion === "All" ? "the full registry" : selectedRegion;
  const describeTreemapTile = (viewShare, sectorShare) => {
    if (viewShare >= 0.2) {
      return "This is one of the main capital concentrations in this view.";
    }
    if (sectorShare >= 0.75) {
      return "This category accounts for most of its sector's reported capital.";
    }
    if (viewShare >= 0.05 || sectorShare >= 0.25) {
      return "This is a meaningful capital pool, but it is not the main driver of the overall chart.";
    }
    return "This category is shown for completeness; it is a small share of the capital in this view.";
  };
  const fitLabel = (text, maxWidth, fontSize) => {
    const maxChars = Math.floor(maxWidth / (fontSize * 0.58));
    if (maxChars < 3) return "";
    return text.length > maxChars ? `${text.slice(0, Math.max(2, maxChars - 3))}...` : text;
  };
  const root = d3.hierarchy({
    name: "Total capital",
    children: rows,
  })
    .sum((d) => d.displayCapital || 0)
    .sort((a, b) => b.value - a.value);

  d3.treemap()
    .size([innerWidth, innerHeight])
    .tile(d3.treemapSquarify.ratio(1.25))
    .paddingOuter(5)
    .paddingInner(5)
    .round(true)(root);

  const leafData = root.leaves();
  leafData.forEach((d, index) => {
    d.clipId = `${containerId}-clip-${index}`;
  });

  const defs = svg.append("defs");
  defs.selectAll("clipPath")
    .data(leafData)
    .join("clipPath")
    .attr("id", (d) => d.clipId)
    .append("rect")
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0));

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const leaves = g.selectAll(".treemap-leaf")
    .data(leafData)
    .join("g")
    .attr("class", "treemap-leaf")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

  leaves.append("rect")
    .attr("width", (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("fill", (d) => color(d.data.sector))
    .on("mousemove", (event, d) => {
      const viewShare = d.data.totalCapital / totalCapital;
      const sectorShare = d.data.totalCapital / d.data.sectorTotal;
      const takeaway = describeTreemapTile(viewShare, sectorShare);
      showTooltip(
        event,
        `<strong>${d.data.name}</strong><br>` +
          `Grouped under: ${d.data.sector}<br>` +
          `Total reported capital: ${formatBirr(d.data.totalCapital)}<br>` +
          `Overall weight: ${formatPercent(viewShare)} of capital shown for ${viewLabel}<br>` +
          `Sector weight: ${formatPercent(sectorShare)} of capital within ${d.data.sector}<br>` +
          `Takeaway: ${takeaway}`
      );
    })
    .on("mouseleave", hideTooltip);

  leaves.each(function(d) {
    const leaf = d3.select(this);
    const blockWidth = d.x1 - d.x0;
    const blockHeight = d.y1 - d.y0;
    if (blockWidth < 70 || blockHeight < 42) return;
    const fontSize = Math.max(10, Math.min(15, blockHeight / 6.5, blockWidth / 12));
    const label = fitLabel(d.data.name, blockWidth - 16, fontSize);
    if (!label) return;
    const sectorLabel = fitLabel(d.data.sector, blockWidth - 16, Math.max(9, fontSize - 1));
    const valueLabel = formatBirr(d.data.totalCapital);
    leaf.append("text")
      .attr("class", "treemap-label")
      .attr("clip-path", `url(#${d.clipId})`)
      .style("font-size", `${fontSize}px`)
      .attr("x", 9)
      .attr("y", 19)
      .text(label)
      .append("title")
      .text(d.data.name);
    if (blockHeight > 62 && blockWidth > 90) {
      leaf.append("text")
        .attr("class", "treemap-value")
        .attr("clip-path", `url(#${d.clipId})`)
        .style("font-size", `${Math.max(8, fontSize - 1)}px`)
        .attr("x", 9)
        .attr("y", 35)
        .text(sectorLabel);
    }
    if (blockHeight > 82 && blockWidth > 112) {
      leaf.append("text")
        .attr("class", "treemap-value")
        .attr("clip-path", `url(#${d.clipId})`)
        .style("font-size", `${Math.max(8, fontSize - 1)}px`)
        .attr("x", 9)
        .attr("y", 51)
        .text(valueLabel);
    }
  });

  svg.append("text")
    .attr("class", "capital-explain")
    .attr("x", margin.left + 2)
    .attr("y", height - 8)
    .text("All categories are shown; tile sizes use a compressed display scale so small capital pools remain visible.");
}

function drawSectorShareComparison(containerId, regionA, regionB, sectors) {
  const container = document.getElementById(containerId);
  const height = 230;
  const svg = resizeSvg(container, height);
  const width = container.clientWidth || 760;
  const margin = { top: 16, right: 28, bottom: 54, left: 126 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const color = (name) => sectorColor(name);
  const rows = [regionA, regionB].map((region) => {
    const counts = new Map(region.sectorMix.map((item) => [item.name, item.count]));
    let cursor = 0;
    const segments = sectors.map((sector) => {
      const count = counts.get(sector) || 0;
      const start = cursor;
      const share = count / region.count;
      cursor += share;
      return { sector, count, share, start, end: cursor, region: region.region };
    });
    return { region: region.region, count: region.count, segments };
  });

  const x = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);
  const y = d3.scaleBand().domain(rows.map((d) => d.region)).range([0, innerHeight]).padding(0.42);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0))
    .call((axis) => axis.select(".domain").remove());

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(width < 580 ? 4 : 5).tickFormat(formatPercent));

  const rowGroups = g.selectAll(".share-row")
    .data(rows)
    .join("g")
    .attr("transform", (d) => `translate(0,${y(d.region)})`);

  rowGroups.selectAll("rect")
    .data((d) => d.segments)
    .join("rect")
    .attr("x", (d) => x(d.start))
    .attr("y", 0)
    .attr("width", (d) => Math.max(0, x(d.end) - x(d.start)))
    .attr("height", y.bandwidth())
    .attr("fill", (d) => color(d.sector))
    .on("mousemove", (event, d) => showTooltip(event, `<strong>${d.region}</strong><br>${d.sector}: ${formatPercent(d.share)}<br>${formatNumber(d.count)} businesses`))
    .on("mouseleave", hideTooltip);

  const legend = document.getElementById("sectorShareLegend");
  if (legend) {
    legend.innerHTML = sectors.map((sector) => `
      <span class="legend-item">
        <span class="legend-swatch" style="background:${color(sector)}"></span>
        <span>${sector}</span>
      </span>
    `).join("");
  }
}

function drawTypeDifference(containerId, regionA, regionB) {
  const container = document.getElementById(containerId);
  const mapA = new Map(regionA.topBusinessTypes.map((item) => [item.name, item.count]));
  const mapB = new Map(regionB.topBusinessTypes.map((item) => [item.name, item.count]));
  const names = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
  const rows = names.map((name) => {
    const shareA = (mapA.get(name) || 0) / regionA.count;
    const shareB = (mapB.get(name) || 0) / regionB.count;
    return { name, shareA, shareB, diff: shareA - shareB };
  }).sort((a, b) => Math.max(b.shareA, b.shareB) - Math.max(a.shareA, a.shareB)).slice(0, 10);

  const height = Math.max(360, rows.length * 48 + 58);
  const svg = resizeSvg(container, height);
  const width = container.clientWidth || 760;
  const margin = { top: 24, right: 72, bottom: 42, left: width < 620 ? 150 : 220 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxShare = d3.max(rows, (d) => Math.max(d.shareA, d.shareB)) || 0.01;
  const x = d3.scaleLinear().domain([0, maxShare]).nice().range([0, innerWidth]);
  const y = d3.scaleBand().domain(rows.map((d) => d.name)).range([0, innerHeight]).padding(0.24);
  const innerY = d3.scaleBand().domain([regionA.region, regionB.region]).range([0, y.bandwidth()]).padding(0.18);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0))
    .call((axis) => axis.select(".domain").remove());

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(width < 620 ? 4 : 6).tickFormat(formatPercent));

  const pairs = rows.flatMap((row) => [
    { name: row.name, region: regionA.region, share: row.shareA, count: mapA.get(row.name) || 0, color: getCss("--green") },
    { name: row.name, region: regionB.region, share: row.shareB, count: mapB.get(row.name) || 0, color: getCss("--blue") },
  ]);

  g.selectAll("rect")
    .data(pairs)
    .join("rect")
    .attr("x", 0)
    .attr("y", (d) => y(d.name) + innerY(d.region))
    .attr("width", (d) => x(d.share))
    .attr("height", innerY.bandwidth())
    .attr("rx", 3)
    .attr("fill", (d) => d.color)
    .on("mousemove", (event, d) => showTooltip(event, `<strong>${d.name}</strong><br>${d.region}: ${formatPercent(d.share)}<br>${formatNumber(d.count)} businesses`))
    .on("mouseleave", hideTooltip);

  g.selectAll(".share-value")
    .data(pairs)
    .filter((d) => x(d.share) >= 38)
    .join("text")
    .attr("class", "bar-label share-value")
    .attr("x", (d) => x(d.share) > innerWidth - 48 ? x(d.share) - 6 : x(d.share) + 6)
    .attr("y", (d) => y(d.name) + innerY(d.region) + innerY.bandwidth() / 2 + 4)
    .attr("text-anchor", (d) => x(d.share) > innerWidth - 48 ? "end" : "start")
    .style("fill", (d) => x(d.share) > innerWidth - 48 ? "#fffdf8" : null)
    .text((d) => formatPercent(d.share));

  const legend = svg.append("g").attr("class", "inline-legend").attr("transform", `translate(${margin.left},14)`);
  [
    { region: regionA.region, color: getCss("--green") },
    { region: regionB.region, color: getCss("--blue") },
  ].forEach((item, index) => {
    const group = legend.append("g").attr("transform", `translate(${index * 170},0)`);
    group.append("rect").attr("width", 10).attr("height", 10).attr("y", -9).attr("fill", item.color);
    group.append("text")
      .attr("class", "bar-label")
      .attr("x", 16)
      .attr("y", 0)
      .text(item.region);
  });

  g.append("text")
    .attr("class", "bar-label")
    .attr("x", innerWidth)
    .attr("y", innerHeight + 36)
    .attr("text-anchor", "end")
    .text("Share of each selected region's businesses");
}

function updateComparisonSummary(data, regionA, regionB) {
  const capitalA = data.capitalByRegion.find((item) => item.region === regionA.region);
  const capitalB = data.capitalByRegion.find((item) => item.region === regionB.region);
  const totalGap = Math.abs(regionA.count - regionB.count);
  const bigger = regionA.count >= regionB.count ? regionA.region : regionB.region;
  const topA = regionA.topBusinessTypes[0];
  const topB = regionB.topBusinessTypes[0];

  document.getElementById("comparisonStats").innerHTML = `
    <article><span>${regionA.region} businesses</span><strong>${formatNumber(regionA.count)}</strong></article>
    <article><span>${regionB.region} businesses</span><strong>${formatNumber(regionB.count)}</strong></article>
    <article><span>Median capital</span><strong>${formatBirr(capitalA?.median || 0)} vs ${formatBirr(capitalB?.median || 0)}</strong></article>
  `;

  document.getElementById("comparisonTakeaway").innerHTML =
    `<strong>${bigger}</strong> has ${formatNumber(totalGap)} more registered businesses. ` +
    `${regionA.region}'s leading type is <strong>${topA.name}</strong> (${formatPercent(topA.count / regionA.count)}), ` +
    `while ${regionB.region}'s leading type is <strong>${topB.name}</strong> (${formatPercent(topB.count / regionB.count)}).`;
}

function getCss(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function fillSelect(select, values, label) {
  select.innerHTML = "";
  select.append(new Option(label, "All"));
  values.forEach((value) => select.append(new Option(value, value)));
}

function chooseTypeData(data, selectedRegion, selectedSector) {
  if (selectedRegion !== "All" && selectedSector !== "All") {
    return data.regionProfiles.find((d) => d.region === selectedRegion)?.bySector?.[selectedSector]?.topBusinessTypes || [];
  }
  if (selectedRegion !== "All") {
    return data.regionProfiles.find((d) => d.region === selectedRegion)?.topBusinessTypes || [];
  }
  if (selectedSector !== "All") {
    return data.sectorProfiles.find((d) => d.sector === selectedSector)?.topBusinessTypes || [];
  }
  return data.topPrimaryTypes.slice(0, 10);
}

function getActiveView(data, selectedRegion, selectedSector) {
  const regionProfile = selectedRegion !== "All"
    ? data.regionProfiles.find((d) => d.region === selectedRegion)
    : null;
  const sectorProfile = selectedSector !== "All"
    ? data.sectorProfiles.find((d) => d.sector === selectedSector)
    : null;
  const combo = regionProfile && sectorProfile ? regionProfile.bySector?.[selectedSector] : null;
  const capital =
    regionProfile && sectorProfile
      ? data.capitalByRegionSector?.[selectedRegion]?.[selectedSector]
      : regionProfile
        ? data.capitalByRegion.find((d) => d.region === selectedRegion)
        : sectorProfile
          ? data.capitalBySector.find((d) => d.sector === selectedSector)
          : data.capitalSummary;

  const businesses = combo?.count || regionProfile?.count || sectorProfile?.count || data.summary.totalBusinesses;
  const regionsShown = sectorProfile ? sectorProfile.topRegions.length : data.summary.regions;
  const sectorsShown = regionProfile ? regionProfile.sectorMix.length : data.summary.sectors;

  return { regionProfile, sectorProfile, combo, capital, businesses, regionsShown, sectorsShown };
}

/* ---------------------------------------------------------------------------
   Legal structure: the sole-proprietor/formal split, and the shape of the
   formal remainder. Both are national constants, not filtered by the page
   controls, so they're computed once from the raw dataset rather than
   redrawn in update().
   --------------------------------------------------------------------------- */

function renderLegalStructure(data) {
  const statuses = data.legalStatuses || [];
  const total = statuses.reduce((sum, s) => sum + s.count, 0);
  const privateEntry = statuses.find((s) => s.name === "Private");
  const privateCount = privateEntry ? privateEntry.count : 0;
  const formalCount = total - privateCount;

  document.getElementById("soleProprietorShare").textContent = formatPercent(privateCount / total);
  document.getElementById("formalShare").textContent = formatPercent(formalCount / total);
  document.getElementById("soleProprietorCallout").innerHTML =
    `<strong>${formatPercent(privateCount / total)} of all registered businesses — ${formatNumber(privateCount)} of them — ` +
    `are sole proprietorships with no formal corporate structure at all.</strong>`;
  document.getElementById("legalStructureSubtitle").textContent =
    `Excludes the ${formatPercent(privateCount / total)} filed as sole proprietorships — this shows only the shape of the remaining ${formatPercent(formalCount / total)}.`;

  const rows = statuses
    .filter((s) => s.name !== "Private")
    .map((s) => ({ name: s.name, count: s.count }))
    .sort((a, b) => b.count - a.count);

  drawHorizontalBars("legalStructureChart", rows, { left: window.innerWidth < 520 ? 150 : 210, color: getCss("--clay") });
}

/* Ties the three lenses (structure, geography, capital) together with figures
   pulled straight from the underlying summaries, so this stays correct if the
   dataset is regenerated rather than drifting from hand-typed numbers. */
function renderSynthesis(data) {
  const statuses = data.legalStatuses || [];
  const total = statuses.reduce((sum, s) => sum + s.count, 0);
  const privateEntry = statuses.find((s) => s.name === "Private");
  const privateShare = privateEntry ? privateEntry.count / total : 0;

  const topRegion = (data.topRegions || [])[0];
  const topRegionShare = topRegion ? topRegion.count / data.summary.totalBusinesses : 0;

  const capitalGap = data.capitalSummary && data.capitalSummary.mean && data.capitalSummary.median
    ? data.capitalSummary.mean / data.capitalSummary.median
    : null;

  document.getElementById("synthTotal").textContent = formatNumber(data.summary.totalBusinesses);
  document.getElementById("synthPrivateShare").textContent = formatPercent(privateShare);
  if (topRegion) {
    document.getElementById("synthTopRegionLabel").textContent = `Based in ${topRegion.name} alone`;
    document.getElementById("synthTopRegionShare").textContent = formatPercent(topRegionShare);
  }
  if (capitalGap !== null) {
    document.getElementById("synthCapitalGap").textContent = `${Math.round(capitalGap)}×`;
  }
}

/* ---------------------------------------------------------------------------
   Formality: who owns these businesses, and how capital scales with legal form
   --------------------------------------------------------------------------- */

function drawFormality(containerId, rows) {
  const container = document.getElementById(containerId);
  const height = Math.max(240, rows.length * 40 + 56);
  const svg = resizeSvg(container, height);
  const width = container.clientWidth || 720;
  const margin = { top: 12, right: 64, bottom: 34, left: 132 };
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, 1]).range([0, iw]);
  const y = d3.scaleBand().domain(rows.map((d) => d.macroSector)).range([0, ih]).padding(0.34);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".0%")).tickSize(0))
    .call((s) => s.select(".domain").remove());
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0))
    .call((s) => s.select(".domain").remove());

  // Track behind each bar shows the remainder, so the reader sees a share of a
  // whole rather than a bare length.
  g.selectAll(".track").data(rows).join("rect")
    .attr("class", "track")
    .attr("x", 0).attr("y", (d) => y(d.macroSector))
    .attr("width", iw).attr("height", y.bandwidth())
    .attr("rx", 4);

  g.selectAll(".fbar").data(rows).join("rect")
    .attr("class", "fbar")
    .attr("x", 0).attr("y", (d) => y(d.macroSector))
    .attr("width", (d) => Math.max(2, x(d.soleProprietorShare)))
    .attr("height", y.bandwidth())
    .attr("rx", 4)
    .attr("fill", (d) => sectorColor(d.macroSector))
    .on("mousemove", (event, d) => {
      const list = d.statuses.slice(0, 5)
        .map((s) => `<div class="tt-row"><span>${s.name}</span><b>${formatNumber(s.count)}</b></div>`).join("");
      showTooltip(event,
        `<strong>${d.macroSector}</strong>` +
        `<div class="tt-row"><span>Businesses</span><b>${formatNumber(d.count)}</b></div>` +
        `<div class="tt-row"><span>Sole proprietor</span><b>${formatPercent(d.soleProprietorShare)}</b></div>` +
        `<hr>${list}`);
    })
    .on("mouseleave", hideTooltip);

  g.selectAll(".fval").data(rows).join("text")
    .attr("class", "bar-label fval")
    .attr("x", (d) => x(d.soleProprietorShare) + 8)
    .attr("y", (d) => y(d.macroSector) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .text((d) => formatPercent(d.soleProprietorShare));
}

function drawLegalCapital(containerId, rows) {
  const container = document.getElementById(containerId);
  const height = Math.max(230, rows.length * 44 + 60);
  const svg = resizeSvg(container, height);
  const width = container.clientWidth || 720;
  const margin = { top: 12, right: 92, bottom: 40, left: 218 };
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Log scale: the span from a partnership to a share company is ~130x, which a
  // linear axis flattens into a single spike.
  const lo = Math.max(1000, d3.min(rows, (d) => d.p25 || d.median) || 1000);
  const hi = d3.max(rows, (d) => d.p75 || d.median) || 1e6;
  const x = d3.scaleLog().domain([lo * 0.6, hi * 1.4]).range([0, iw]).clamp(true);
  const y = d3.scaleBand().domain(rows.map((d) => d.name)).range([0, ih]).padding(0.45);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(5, "~s").tickSize(0))
    .call((s) => s.select(".domain").remove());
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0))
    .call((s) => s.select(".domain").remove())
    .selectAll("text").text((t) => (t.length > 28 ? `${t.slice(0, 27)}…` : t));
  g.append("text").attr("class", "axis-note")
    .attr("x", iw).attr("y", ih + 34).attr("text-anchor", "end")
    .text("Registered capital (ETB, log scale)");

  const row = g.selectAll(".lrow").data(rows).join("g")
    .attr("class", "lrow")
    .attr("transform", (d) => `translate(0,${y(d.name) + y.bandwidth() / 2})`)
    .on("mousemove", (event, d) => showTooltip(event,
      `<strong>${d.name}</strong>` +
      `<div class="tt-row"><span>Businesses</span><b>${formatNumber(d.count)}</b></div>` +
      `<div class="tt-row"><span>Median capital</span><b>${formatNumber(d.median)} ETB</b></div>` +
      `<div class="tt-row"><span>25th–75th pct</span><b>${formatNumber(d.p25)}–${formatNumber(d.p75)}</b></div>`))
    .on("mouseleave", hideTooltip);

  row.append("line").attr("class", "iqr")
    .attr("x1", (d) => x(Math.max(lo * 0.6, d.p25 || d.median)))
    .attr("x2", (d) => x(d.p75 || d.median))
    .attr("stroke", (d, i) => getCss(`--series-${(i % 8) + 1}`));

  row.append("circle").attr("class", "median-dot")
    .attr("cx", (d) => x(d.median)).attr("r", 6)
    .attr("fill", (d, i) => getCss(`--series-${(i % 8) + 1}`));

  row.append("text").attr("class", "bar-label")
    .attr("x", (d) => x(d.p75 || d.median) + 12)
    .attr("dominant-baseline", "middle")
    .text((d) => `${formatCompact(d.median).replace("G", "B")}`);
}

/* ---------------------------------------------------------------------------
   Generic drilldown: one bar chart plus a breadcrumb, reused for geography and
   for the taxonomy. Each level supplies its own {label, rows, next} resolver.
   --------------------------------------------------------------------------- */

function drawDrilldown({ chartId, crumbId, path, levels, onNavigate }) {
  const container = document.getElementById(chartId);
  const crumbs = d3.select(`#${crumbId}`);
  const level = levels[path.length];
  const rows = level.rows(path).slice(0, 22);

  crumbs.selectAll("*").remove();
  crumbs.selectAll("button").data(levels.slice(0, path.length + 1)).join("button")
    .attr("class", (d, i) => (i === path.length ? "crumb crumb-current" : "crumb"))
    .attr("type", "button")
    .text((d, i) => (i === 0 ? d.root : path[i - 1]))
    .on("click", (event, d) => {
      const i = levels.indexOf(d);
      if (i < path.length) { hideTooltip(); onNavigate(path.slice(0, i)); }
    });

  // Floor matches .chart's min-height so the card does not leave a blank block
  // when a level has only one or two children; the bar-thickness cap below keeps
  // sparse levels from stretching into a slab.
  const height = Math.max(288, rows.length * 32 + 52);
  const svg = resizeSvg(container, height);
  const width = container.clientWidth || 760;
  const margin = { top: 10, right: 72, bottom: 30, left: 210 };
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  if (!rows.length) {
    svg.append("text").attr("class", "empty-note")
      .attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle")
      .text("No further breakdown is recorded here.");
    return;
  }

  const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.count)]).nice().range([0, iw]);
  const y = d3.scaleBand().domain(rows.map((d) => d.name)).range([0, ih]).padding(0.26);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(5, "~s").tickSize(0))
    .call((s) => s.select(".domain").remove());
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0))
    .call((s) => s.select(".domain").remove())
    .selectAll("text").text((t) => (t.length > 30 ? `${t.slice(0, 29)}…` : t));

  const canDrill = path.length < levels.length - 1;

  // Cap bar thickness. A level with one or two children (Construction has a single
  // business type) otherwise stretches its bar over the whole plot height.
  const barH = Math.min(y.bandwidth(), 34);
  const barY = (d) => y(d.name) + (y.bandwidth() - barH) / 2;

  g.selectAll(".dbar").data(rows).join("rect")
    .attr("class", canDrill ? "dbar dbar-clickable" : "dbar")
    .attr("x", 0).attr("y", barY)
    .attr("width", (d) => Math.max(2, x(d.count)))
    .attr("height", barH)
    .attr("rx", 4)
    .attr("fill", level.color)
    .on("mousemove", (event, d) => showTooltip(event, level.tooltip(d, path)))
    .on("mouseleave", hideTooltip)
    .on("click", (event, d) => { if (canDrill) { hideTooltip(); onNavigate([...path, d.name]); } });

  g.selectAll(".dval").data(rows).join("text")
    .attr("class", "bar-label")
    .attr("x", (d) => x(d.count) + 8)
    .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .text((d) => formatNumber(d.count));
}

/* Every chart states what the current filter is doing to it - including the cases
   where a filter deliberately does not apply. Silence was the real problem: five
   views used to ignore the controls with no explanation. */
function setScopeNotes(region, sector, active) {
  const inRegion = region !== "All";
  const inSector = sector !== "All";
  const put = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const both = inRegion && inSector;

  // This chart is itself the region breakdown, so a region filter would reduce it
  // to a single bar. It stays national on purpose - say so rather than look broken.
  put("regionScope", [
    inSector ? `Ranked by ${sector} registrations only.` : "Ranked across all sectors.",
    inRegion
      ? `Still showing every region, so you can see where ${region} sits against the rest.`
      : "Pick a sector above to re-rank them by that sector.",
  ].join(" "));

  put("sectorScope", both
    ? `Sector mix within ${region}. The sector filter does not apply here — it would leave a single slice.`
    : inRegion
      ? `Sector mix within ${region}.`
      : inSector
        ? "The sector filter does not apply to this chart — it would leave a single slice. Showing all sectors."
        : "Showing all sectors nationally.");

  put("typeScope", both
    ? `${sector} business types in ${region}.`
    : inRegion ? `Business types in ${region}.`
    : inSector ? `Business types within ${sector}.`
    : "Showing all business types nationally.");

  put("capitalScope", inRegion
    ? `Capital registered in ${region}.${inSector ? " Not filtered by sector — every sector is shown so the comparison holds." : ""}`
    : inSector
      ? "Not filtered by sector — every sector is shown so the comparison holds. Showing the full registry."
      : "Showing the full registry.");

  const formalityNote = inRegion
    ? `Legal structure of businesses in ${region}.`
    : "Legal structure across the whole registry.";
  const sectorCaveat = inSector
    ? " The sector filter does not apply — this chart is itself a breakdown by sector."
    : "";
  put("formalityScope", formalityNote + sectorCaveat);
  put("legalCapitalScope", (inRegion
    ? `Capital by legal form in ${region}.`
    : "Capital by legal form across the whole registry.")
    + (inSector ? " Not broken down by sector." : ""));

  // zoneScope and specialtyScope are written by the drilldowns themselves, which
  // know both the filter and how deep the reader has navigated.
}


function render(data) {
  // Build the shared sector -> colour map before any chart draws, so every chart
  // gives a sector the same colour and filtering never repaints the survivors.
  buildSectorColorScale(data);

  const regionSelect = document.getElementById("regionSelect");
  const sectorSelect = document.getElementById("sectorSelect");
  const compareRegionA = document.getElementById("compareRegionA");
  const compareRegionB = document.getElementById("compareRegionB");
  const regionNames = data.regionProfiles.map((d) => d.region);
  fillSelect(regionSelect, data.regionProfiles.map((d) => d.region), "All regions");
  fillSelect(sectorSelect, data.sectorProfiles.map((d) => d.sector), "All sectors");
  compareRegionA.innerHTML = "";
  compareRegionB.innerHTML = "";
  regionNames.forEach((value) => {
    compareRegionA.append(new Option(value, value));
    compareRegionB.append(new Option(value, value));
  });
  compareRegionA.value = "Addis Ababa";
  compareRegionB.value = "Oromia";

  function update() {
    const selectedRegion = regionSelect.value;
    const selectedSector = sectorSelect.value;
    const active = getActiveView(data, selectedRegion, selectedSector);
    const typeData = chooseTypeData(data, selectedRegion, selectedSector);
    const regionChartData = active.sectorProfile ? active.sectorProfile.topRegions : data.topRegions;
    const sectorChartData = active.regionProfile ? active.regionProfile.sectorMix : data.topSectors;
    const filterTitle =
      selectedRegion !== "All" && selectedSector !== "All"
        ? `${selectedSector} in ${selectedRegion}`
        : selectedRegion !== "All"
          ? selectedRegion
          : selectedSector !== "All"
            ? selectedSector
            : "All registered businesses";
    const scopeLabel =
      selectedRegion !== "All" && selectedSector !== "All"
        ? `${selectedSector} businesses in ${selectedRegion}`
        : selectedRegion !== "All"
          ? `businesses in ${selectedRegion}`
          : selectedSector !== "All"
            ? `${selectedSector} businesses`
            : "registered businesses";
    const filterDescription = `Showing ${formatNumber(active.businesses)} ${scopeLabel}.`;

    document.getElementById("totalBusinesses").textContent = formatNumber(active.businesses);
    document.getElementById("regionCount").textContent = formatNumber(active.regionsShown);
    document.getElementById("sectorCount").textContent = formatNumber(active.sectorsShown);
    document.getElementById("medianCapital").textContent = formatBirr(active.capital?.median || 0);
    document.getElementById("filterDescription").textContent = filterDescription;
    document.getElementById("resetFilters").hidden = selectedRegion === "All" && selectedSector === "All";
    setScopeNotes(selectedRegion, selectedSector, active);
    // Chart subject lines are static in the HTML now; the per-chart scope notes
    // carry the filter state, so nothing here rewrites the descriptions.
    drawHorizontalBars("regionChart", regionChartData.slice(0, 14), { left: window.innerWidth < 520 ? 112 : 150, color: getCss("--green") });
    drawDonut("sectorChart", sectorChartData.slice(0, 8));
    drawHorizontalBars("typeChart", typeData.slice(0, 10), { left: 190, color: getCss("--blue") });
  }

  function updateStaticCharts() {
    updateCapitalTreemap();
  }

  function updateCapitalTreemap() {
    const selectedRegion = regionSelect.value;
    drawCapitalTreemap("capitalTreemapChart", data, selectedRegion);
  }

  function updateComparison() {
    const regionA = data.regionProfiles.find((d) => d.region === compareRegionA.value) || data.regionProfiles[0];
    const regionB = data.regionProfiles.find((d) => d.region === compareRegionB.value) || data.regionProfiles[1];
    const sectors = data.topSectors.slice(0, 8).map((d) => d.name);
    updateComparisonSummary(data, regionA, regionB);
    drawSectorShareComparison("sectorShareChart", regionA, regionB, sectors);
    drawTypeDifference("typeDifferenceChart", regionA, regionB);
  }

  // Single entry point: every filter change redraws every dependent view, so no
  // chart can silently fall out of sync with the controls.
  function applyFilters() {
    update();
    updateStaticCharts();
    drawFormalityViews();
    // Selecting a region opens the geography drilldown at that region; clearing it
    // returns to the national view.
    const r = regionSelect.value;
    renderZones(r === "All" ? [] : [r]);
    renderSpec(specPath.length ? specPath : []);
  }

  update();
  updateStaticCharts();
  updateComparison();
  renderLegalStructure(data);
  renderSynthesis(data);

  regionSelect.addEventListener("change", applyFilters);
  sectorSelect.addEventListener("change", applyFilters);
  document.getElementById("resetFilters").addEventListener("click", () => {
    regionSelect.value = "All";
    sectorSelect.value = "All";
    specPath = [];
    applyFilters();
  });
  compareRegionA.addEventListener("change", updateComparison);
  compareRegionB.addEventListener("change", updateComparison);
  // Redraw on resize, but only when the WIDTH actually changes, and debounced.
  //
  // Without the width guard this loops: a redraw changes chart heights, which
  // changes page height, which makes the scrollbar appear or disappear, which
  // fires another resize, which redraws again. With every view now wired into
  // this handler that loop locked the renderer hard enough to stop it painting.
  // Vertical-only resizes never need a redraw, so comparing width breaks the cycle.
  let lastWidth = window.innerWidth;
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      update();
      updateStaticCharts();
      updateComparison();
      drawFormalityViews();
      renderLegalStructure(data);
      renderZones(zonePath);
      renderSpec(specPath);
    }, 150);
  });

  // ---- Formality: region-scoped via the global filter -----------------------
  function formalityRows() {
    const r = regionSelect.value;
    return (r !== "All" && data.legalStatusByRegion && data.legalStatusByRegion[r])
      || data.legalStatusByMacroSector || [];
  }
  function legalCapitalRows() {
    const r = regionSelect.value;
    return (r !== "All" && data.capitalByLegalFormByRegion && data.capitalByLegalFormByRegion[r])
      || data.capitalByLegalForm || [];
  }
  function drawFormalityViews() {
    drawFormality("formalityChart", formalityRows());
    drawLegalCapital("legalCapitalChart", legalCapitalRows());
  }
  drawFormalityViews();

  // ---- Geography drilldown: region -> zone -> woreda ------------------------
  const zoneData = data.zoneProfiles || {};
  let zonePath = [];
  const zoneLevels = [
    {
      root: "All regions",
      color: getCss("--series-1"),
      rows: () => (data.topRegions || []).map((r) => ({ name: r.name, count: r.count })),
      tooltip: (d) => `<strong>${d.name}</strong>` +
        `<div class="tt-row"><span>Businesses</span><b>${formatNumber(d.count)}</b></div>` +
        `<div class="tt-row"><span>Zones</span><b>${(zoneData[d.name] || []).length}</b></div>` +
        `<div class="tt-hint">Select to open its zones</div>`,
    },
    {
      root: "Zones",
      color: getCss("--series-3"),
      rows: (p) => (zoneData[p[0]] || []).map((z) => ({ name: z.zone, count: z.count, median: z.medianCapital, woredas: z.woredas })),
      tooltip: (d) => `<strong>${d.name}</strong>` +
        `<div class="tt-row"><span>Businesses</span><b>${formatNumber(d.count)}</b></div>` +
        `<div class="tt-row"><span>Median capital</span><b>${formatNumber(d.median)} ETB</b></div>` +
        `<div class="tt-row"><span>Woredas</span><b>${(d.woredas || []).length}</b></div>` +
        `<div class="tt-hint">Select to open its woredas</div>`,
    },
    {
      root: "Woredas",
      color: getCss("--series-6"),
      rows: (p) => {
        const z = (zoneData[p[0]] || []).find((item) => item.zone === p[1]);
        return (z ? z.woredas : []).map((w) => ({ name: w.name, count: w.count }));
      },
      tooltip: (d) => `<strong>${d.name}</strong>` +
        `<div class="tt-row"><span>Businesses</span><b>${formatNumber(d.count)}</b></div>`,
    },
  ];
  const renderZones = (next) => {
    zonePath = next;
    const note = document.getElementById("zoneScope");
    if (note) {
      note.textContent = zonePath.length === 0
        ? "Showing all regions. Pick a region above, or click a bar, to open its zones."
        : zonePath.length === 1
          ? `Showing the ${(zoneData[zonePath[0]] || []).length} zones within ${zonePath[0]}. Click one to see its woredas.`
          : `Showing woredas within ${zonePath[1]}, ${zonePath[0]}.`;
    }
    drawDrilldown({ chartId: "zoneChart", crumbId: "zoneCrumbs", path: zonePath, levels: zoneLevels, onNavigate: renderZones });
  };
  renderZones([]);

  // ---- Taxonomy drilldown: macro sector -> business type -> specialty -------
  const specTree = () => {
    const r = regionSelect.value;
    return (r !== "All" && data.specialtyHierarchyByRegion && data.specialtyHierarchyByRegion[r])
      || data.specialtyHierarchy || [];
  };
  let specPath = [];
  const specLevels = [
    {
      root: "All sectors",
      color: getCss("--series-2"),
      rows: () => specTree().map((m) => ({ name: m.macroSector, count: m.count })),
      tooltip: (d) => `<strong>${d.name}</strong>` +
        `<div class="tt-row"><span>Businesses</span><b>${formatNumber(d.count)}</b></div>` +
        `<div class="tt-hint">Select to open its business types</div>`,
    },
    {
      root: "Business types",
      color: getCss("--series-4"),
      rows: (p) => {
        const m = specTree().find((item) => item.macroSector === p[0]);
        return (m ? m.businessTypes : []).map((t) => ({ name: t.name, count: t.count }));
      },
      tooltip: (d) => `<strong>${d.name}</strong>` +
        `<div class="tt-row"><span>Businesses</span><b>${formatNumber(d.count)}</b></div>` +
        `<div class="tt-hint">Select to open its specialties</div>`,
    },
    {
      root: "Specialties",
      color: getCss("--series-7"),
      rows: (p) => {
        const m = specTree().find((item) => item.macroSector === p[0]);
        const t = m && m.businessTypes.find((item) => item.name === p[1]);
        return (t ? t.specialties : []).map((s) => ({ name: s.name, count: s.count }));
      },
      tooltip: (d) => `<strong>${d.name}</strong>` +
        `<div class="tt-row"><span>Businesses</span><b>${formatNumber(d.count)}</b></div>`,
    },
  ];
  const renderSpec = (next) => {
    specPath = next;
    const note = document.getElementById("specialtyScope");
    if (note) {
      const region = regionSelect.value;
      const where = region === "All" ? "nationally" : `in ${region}`;
      note.textContent = specPath.length === 0
        ? `Counts are ${where}. Click a sector to open its business types.`
        : specPath.length === 1
          ? `Business types within ${specPath[0]}, ${where}. Click one to see its specialties.`
          : `Specialties within ${specPath[1]}, ${where}.`;
    }
    drawDrilldown({ chartId: "specialtyChart", crumbId: "specialtyCrumbs", path: specPath, levels: specLevels, onNavigate: renderSpec });
  };
  renderSpec([]);

}

fetch("data/business_landscape.json")
  .then((response) => response.json())
  .then(render)
  .catch((error) => {
    document.querySelector(".shell").insertAdjacentHTML(
      "afterbegin",
      `<p class="error">Unable to load visualization data: ${error.message}</p>`
    );
  });
