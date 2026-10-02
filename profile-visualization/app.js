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
  // A focus event has no pointer coordinates, so anchor to the focused element
  // instead. Without this a keyboard user gets the tooltip pinned at 0,0.
  let ax = event.clientX;
  let ay = event.clientY;
  if (ax == null || ay == null || (ax === 0 && ay === 0)) {
    const t = event.target && event.target.getBoundingClientRect
      ? event.target.getBoundingClientRect()
      : null;
    ax = t ? t.left + t.width / 2 : window.innerWidth / 2;
    ay = t ? t.bottom : window.innerHeight / 2;
  }
  const left = Math.min(ax + 14, window.innerWidth - bounds.width - pad);
  const top = Math.min(ay + 14, window.innerHeight - bounds.height - pad);
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

/* ---- Annotation layer ------------------------------------------------------
   Datawrapper's three devices, in the three forms this data has a use for: a
   shaded band behind the marks, a short note on the plot with a leader to the
   mark it is about, and a highlighted mark carrying its own label.

   Two rules the notes here follow. A note states the finding - it never
   restates an axis the reader can already see. And the text is COMPUTED from
   the rows being drawn, so a note cannot drift out of date when the region
   filter changes the chart underneath it.

   Responsiveness follows Datawrapper too: below the breakpoint the notes come
   off the plot, where there is no room for them, and sit under the chart as a
   list. The list is in the DOM at every width - a chart div is role="img", so
   its SVG text is presentational to a screen reader, and this list is how an
   annotation reaches anyone not looking at the picture. It is clipped rather
   than removed when the notes are drawn on the plot.
*/
/* Trim axis tick labels to the gutter they are given. A fixed character count
   cannot know the gutter, the font or the width of the actual words, so this
   measures each label and shortens it until it fits. The full text goes into a
   <title>, and the tooltip and the table carry it in full regardless. */
function trimAxisLabels(axis, room) {
  axis.selectAll("text").each(function (name) {
    const node = this;
    if (room <= 0 || node.getComputedTextLength() <= room) return;
    d3.select(node).append("title").text(name);
    let text = String(name);
    while (text.length > 4 && node.getComputedTextLength() > room) {
      text = text.slice(0, -1);
      node.firstChild.nodeValue = `${text.trimEnd()}\u2026`;
    }
  });
}

function annotationLayer(svg, chartId, opts) {
  const o = opts || {};
  const narrow = !!o.narrow;
  const collected = [];
  const g = svg.append("g").attr("class", "ann-layer");

  // SVG has no text wrapping, so measure word by word and break into tspans.
  function wrap(sel, str, maxWidth) {
    const words = String(str).split(/\s+/);
    const x = sel.attr("x");
    let line = [];
    let tspan = sel.append("tspan").attr("x", x).attr("dy", 0);
    words.forEach((w) => {
      line.push(w);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
        line.pop();
        tspan.text(line.join(" "));
        line = [w];
        tspan = sel.append("tspan").attr("x", x).attr("dy", "1.3em").text(w);
      }
    });
  }

  const api = {
    // A shaded interval behind the marks: "these rows are the story".
    band(spec) {
      if (spec.label) collected.push(spec.label);
      if (narrow) return api;
      g.append("rect").attr("class", "ann-band")
        .attr("x", spec.x).attr("y", spec.y)
        .attr("width", Math.max(0, spec.width)).attr("height", Math.max(0, spec.height))
        .attr("rx", 4);
      if (spec.label) {
        g.append("text").attr("class", "ann-band-label")
          .attr("x", spec.x + 8).attr("y", spec.y + 14).text(spec.label);
      }
      return api;
    },
    // A note on the plot, optionally with a leader line to the mark it is about.
    note(spec) {
      collected.push(spec.text);
      if (narrow) return api;
      // Clamp the note inside the plot. A caller places it relative to the mark
      // it describes and cannot know how wide the wrapped text ends up, so the
      // layer is what keeps it from running off the edge.
      const limit = o.plotWidth || 0;
      const box = spec.maxWidth || 200;
      if (limit && (spec.anchor || "start") === "start" && spec.x + box > limit) {
        spec.x = Math.max(0, limit - box);
      }
      if (spec.to) {
        g.append("line").attr("class", "ann-lead")
          .attr("x1", spec.x + (spec.leadFrom || 0)).attr("y1", spec.y - 4)
          .attr("x2", spec.to.x).attr("y2", spec.to.y);
        g.append("circle").attr("class", "ann-dot")
          .attr("cx", spec.to.x).attr("cy", spec.to.y).attr("r", 3);
      }
      const t = g.append("text").attr("class", "ann-note")
        .attr("x", spec.x).attr("y", spec.y)
        .attr("text-anchor", spec.anchor || "start");
      wrap(t, spec.text, spec.maxWidth || 200);
      return api;
    },
    // Done drawing: publish whatever was collected under the chart.
    done() {
      attachChartNotes(chartId, collected, narrow);
      return api;
    },
  };
  return api;
}

function attachChartNotes(chartId, notes, show) {
  const chart = document.getElementById(chartId);
  if (!chart) return;
  const id = `${chartId}-notes`;
  let box = document.getElementById(id);
  if (!notes || !notes.length) {
    if (box) box.remove();
    return;
  }
  if (!box) {
    box = document.createElement("ul");
    box.id = id;
    chart.insertAdjacentElement("afterend", box);
  }
  // The class decides visibility, not a media query: these charts size to their
  // panel, so a half-width panel is narrow while the viewport is not.
  box.className = show ? "chart-notes is-shown" : "chart-notes";
  box.innerHTML = "";
  notes.forEach((n) => {
    const li = document.createElement("li");
    li.textContent = n;
    box.appendChild(li);
  });
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
    .call((axis) => axis.select(".domain").remove())
    .call((axis) => trimAxisLabels(axis, margin.left - 12));

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

  // The caller writes the note, because only it knows what these rows mean. It
  // gets the scales back so a band or a leader can land on the right mark.
  const ann = annotationLayer(g, containerId, { narrow: width < 620, plotWidth: innerWidth });
  if (options.annotate) {
    options.annotate(ann, { x, y, innerWidth, innerHeight, width, narrow: width < 620, data });
  }
  ann.done();
}

/* How many of the leading rows it takes to pass a share of the total, and what
   that share actually is. Every "the top few hold most of it" note on this page
   is computed with this rather than written out, so none of them can go stale
   when a filter changes the rows underneath. */
function leadingShare(rows, target) {
  const total = d3.sum(rows, (d) => d.count);
  if (!total) return null;
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run += sorted[i].count;
    if (run / total >= target) {
      return { n: i + 1, share: run / total, names: sorted.slice(0, i + 1).map((d) => d.name), rows: sorted.slice(0, i + 1) };
    }
  }
  return { n: sorted.length, share: 1, names: sorted.map((d) => d.name), rows: sorted };
}

/* "A, B and C" - a list a reader can say out loud. */
function listPhrase(names) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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
  // .unknown() matters more than it looks. By default an ordinal scale APPENDS an
  // unrecognised name to its domain and hands it range[i % 8], so a chart passing
  // names from a different vocabulary silently gets colours that have already been
  // used - which is exactly what happened: the formality chart passes macro-sector
  // names ("Retail", "Extractive") into a scale whose domain is sector names
  // ("Trade", "Mining and quarrying"), and two bars came out the same red. A
  // named fallback makes that visible instead of plausible.
  sectorColorScale = d3.scaleOrdinal(domain, seriesPalette()).unknown(getCss("--muted"));
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
  // A donut has no spare plot area, so its note always goes to the list below.
  const ann = annotationLayer(svg, containerId, { narrow: true });
  if (data.length > 1) {
    const sorted = [...data].sort((a, b) => b.count - a.count);
    const total = d3.sum(sorted, (d) => d.count) || 1;
    const lead = leadingShare(sorted, 0.5);
    if (lead) {
      ann.note({ text: `${listPhrase(lead.names)} ${lead.n > 1 ? "are" : "is"} ${formatPercent(lead.share)} of everything in view — ${lead.n} of ${sorted.length} sectors.` });
    }
    const smallest = sorted[sorted.length - 1];
    ann.note({ text: `The smallest, ${smallest.name}, is ${formatPercent(smallest.count / total)}.` });
  }
  ann.done();
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
    // Below 11px a label is decoration, not information. Rather than shrink the
    // text to fit the tile, the tile has to be big enough for readable text or
    // it carries none - the tooltip and the table still name every one.
    const MIN_FONT = 11;
    if (blockWidth < 88 || blockHeight < 46) return;
    const fontSize = Math.max(MIN_FONT, Math.min(15, blockHeight / 6.5, blockWidth / 12));
    const label = fitLabel(d.data.name, blockWidth - 16, fontSize);
    if (!label) return;
    const subFont = Math.max(MIN_FONT, fontSize - 1);
    const sectorLabel = fitLabel(d.data.sector, blockWidth - 16, subFont);
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
    if (blockHeight > 66 && blockWidth > 100 && sectorLabel) {
      leaf.append("text")
        .attr("class", "treemap-value")
        .attr("clip-path", `url(#${d.clipId})`)
        .style("font-size", `${subFont}px`)
        .attr("x", 9)
        .attr("y", 36)
        .text(sectorLabel);
    }
    if (blockHeight > 88 && blockWidth > 118) {
      leaf.append("text")
        .attr("class", "treemap-value")
        .attr("clip-path", `url(#${d.clipId})`)
        .style("font-size", `${subFont}px`)
        .attr("x", 9)
        .attr("y", 54)
        .text(valueLabel);
    }
  });

  // One long line does not fit a phone, and the notes list below already says
  // the same thing, so it is drawn only where there is room for it.
  if (width >= 620) {
    svg.append("text")
      .attr("class", "capital-explain")
      .attr("x", margin.left + 2)
      .attr("y", height - 8)
      .text("All categories are shown; tile sizes use a compressed display scale so small capital pools remain visible.");
  }

  // A mosaic has no empty space for a note, so this one goes to the list below.
  // The figures are the true capital shares, not the compressed tile areas.
  const ann = annotationLayer(svg, containerId, { narrow: true });
  if (leafData.length > 1) {
    const byCapital = [...leafData].sort((a, b) => b.data.totalCapital - a.data.totalCapital);
    const top = byCapital[0];
    const topThree = byCapital.slice(0, 3);
    const threeShare = d3.sum(topThree, (d) => d.data.totalCapital) / totalCapital;
    ann.note({ text: `${top.data.name} is the largest single pool: ${formatPercent(top.data.totalCapital / totalCapital)} of the capital in view.` });
    ann.note({ text: `The three largest together are ${formatPercent(threeShare)} of it, out of ${leafData.length} categories.` });
    ann.note({ text: "Tiles are drawn on a compressed scale so the small pools stay visible, so judge the shares from these figures rather than from tile area." });
  }
  ann.done();
}

function drawSectorShareComparison(containerId, regionA, regionB, sectors) {
  const container = document.getElementById(containerId);
  const height = 230;
  const svg = resizeSvg(container, height);
  const width = container.clientWidth || 760;
  const narrow = width < 620;
  const margin = { top: 16, right: narrow ? 26 : 28, bottom: 54, left: narrow ? Math.min(96, Math.round(width * 0.3)) : 126 };
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
    .call((axis) => axis.select(".domain").remove())
    .call((axis) => trimAxisLabels(axis, margin.left - 12));

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    // "100.0%" at the right end hangs over the edge of a phone card; the decimal
    // is not telling the reader anything on an axis that only ever runs 0 to 100.
    .call(d3.axisBottom(x).ticks(narrow ? 3 : 5).tickFormat(narrow ? d3.format(".0%") : formatPercent));

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
  // The comparison's point is the sector where the two mixes part company.
  const ann = annotationLayer(svg, containerId, { narrow: true });
  if (rows.length === 2) {
    const a = new Map(rows[0].segments.map((d) => [d.sector, d.share]));
    const b2 = new Map(rows[1].segments.map((d) => [d.sector, d.share]));
    const gaps = sectors.map((name) => ({ name, gap: (a.get(name) || 0) - (b2.get(name) || 0) }))
      .sort((p1, p2) => Math.abs(p2.gap) - Math.abs(p1.gap));
    const top = gaps[0];
    if (top && Math.abs(top.gap) > 0.005) {
      const ahead = top.gap > 0 ? rows[0] : rows[1];
      const behind = top.gap > 0 ? rows[1] : rows[0];
      ann.note({ text: `${top.name} is where the two part company: `
        + `${formatPercent(Math.max(a.get(top.name) || 0, b2.get(top.name) || 0))} of ${ahead.region} `
        + `against ${formatPercent(Math.min(a.get(top.name) || 0, b2.get(top.name) || 0))} of ${behind.region}.` });
    }
  }
  ann.done();

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
  // Same lesson as the drilldown: a gutter wide enough for a business type name
  // leaves no plot on a phone. The names get trimmed to whatever fits instead.
  const narrow = width < 620;
  const margin = {
    top: narrow ? 44 : 24,
    right: narrow ? 46 : 72,
    bottom: 42,
    left: narrow ? Math.min(118, Math.round(width * 0.38)) : 220,
  };
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
    .call((axis) => axis.select(".domain").remove())
    .call((axis) => trimAxisLabels(axis, margin.left - 12));

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(narrow ? 3 : 6).tickFormat(formatPercent));

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

  // Two fixed 170px legend columns ran off the right of a phone card, so they
  // stack there instead of sitting side by side.
  const legend = svg.append("g").attr("class", "inline-legend")
    .attr("transform", `translate(${narrow ? 4 : margin.left},14)`);
  [
    { region: regionA.region, color: getCss("--green") },
    { region: regionB.region, color: getCss("--blue") },
  ].forEach((item, index) => {
    const group = legend.append("g")
      .attr("transform", narrow ? `translate(0,${index * 17})` : `translate(${index * 170},0)`);
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
    .text(narrow ? "Share of each region" : "Share of each selected region's businesses");

  // The point of a comparison is where the two differ most, so find that row
  // and say which way it runs. Recomputed on every change of either region.
  const ann = annotationLayer(g, containerId, { narrow: width < 620, plotWidth: innerWidth });
  const widest = [...rows].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
  if (widest && Math.abs(widest.diff) > 0.005) {
    const ahead = widest.diff > 0 ? regionA : regionB;
    const behind = widest.diff > 0 ? regionB : regionA;
    const hiShare = Math.max(widest.shareA, widest.shareB);
    const rowY = y(widest.name);
    ann.band({ x: -8, y: rowY - 4, width: innerWidth + 16, height: y.bandwidth() + 8 });
    ann.note({
      x: Math.min(x(hiShare) + 18, innerWidth - 8),
      y: rowY + y.bandwidth() + 30,
      maxWidth: Math.max(170, innerWidth * 0.46),
      text: `${widest.name} is the widest gap: ${formatPercent(hiShare)} of ${ahead.region}`
        + ` against ${formatPercent(Math.min(widest.shareA, widest.shareB))} of ${behind.region}.`,
      to: { x: x(hiShare) * 0.55, y: rowY + y.bandwidth() / 2 },
    });
  }
  ann.done();
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
    // Same plain-English names the ownership chart uses, so a reader meeting
    // "One-person limited company" there does not meet "One Man Private Limited
    // Company" here.
    .map((s) => ({ name: ownerLabel(s.name), count: s.count }))
    .sort((a, b) => b.count - a.count);

  drawHorizontalBars("legalStructureChart", rows, {
    left: window.innerWidth < 520 ? 150 : 210,
    color: getCss("--clay"),
    // With sole proprietors taken out, how much of what remains is one form.
    annotate: (ann, sc) => {
      if (rows.length < 3) return;
      const lead = leadingShare(rows, 0.5);
      if (!lead || lead.n > 2) return;
      const first = lead.rows[0];
      ann.note({
        x: Math.min(sc.x(first.count) + 16, sc.innerWidth - 10),
        y: sc.y(first.name) + sc.y.bandwidth() + 28,
        maxWidth: Math.max(160, sc.innerWidth * 0.46),
        text: `Once sole proprietors are set aside, ${listPhrase(lead.names)} `
          + `${lead.n > 1 ? "are" : "is"} still ${formatPercent(lead.share)} of what is left.`,
        to: { x: sc.x(first.count) * 0.6, y: sc.y(first.name) + sc.y.bandwidth() / 2 },
      });
    },
  });
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
  // The annotation needs a row of its own under the axis; without it the note
  // landed on the 40% and 60% tick labels.
  const annRoom = (container.clientWidth || 720) < 620 ? 0 : 46;
  const height = Math.max(240, rows.length * 40 + 56) + annRoom;
  const svg = resizeSvg(container, height);
  const width = container.clientWidth || 720;
  const narrow = width < 620;
  const margin = { top: 12, right: narrow ? 52 : 64, bottom: 34 + annRoom, left: narrow ? Math.min(104, Math.round(width * 0.33)) : 132 };
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, 1]).range([0, iw]);
  const y = d3.scaleBand().domain(rows.map((d) => d.macroSector)).range([0, ih]).padding(0.34);

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).ticks(narrow ? 3 : 5).tickFormat(d3.format(".0%")).tickSize(0))
    .call((s) => s.select(".domain").remove());
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0))
    .call((s) => s.select(".domain").remove())
    .call((s) => trimAxisLabels(s, margin.left - 12));

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
    // One colour for every bar. This chart measures a single quantity - the share
    // of a sector owned by one person - and the sector's name is already on the
    // axis beside its bar, so colour was carrying no information. Seven hues also
    // put the chart over the limit where a reader with colour-blindness can tell
    // the categories apart (see docs/palette_validation.md): below about four
    // categories colour can carry identity, above it the labels have to.
    .attr("fill", getCss("--green"))
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

  // The spread is the finding, so name both ends of it and point at the low one.
  const ann = annotationLayer(g, containerId, { narrow: width < 620, plotWidth: iw });
  if (rows.length > 2) {
    const byShare = [...rows].sort((a, b) => b.soleProprietorShare - a.soleProprietorShare);
    const hi = byShare[0], lo = byShare[byShare.length - 1];
    ann.note({
      x: Math.min(x(lo.soleProprietorShare) + 40, iw - 10),
      y: ih + 46,
      maxWidth: Math.max(160, iw * 0.46),
      text: `Sole ownership runs from ${formatPercent(hi.soleProprietorShare)} of ${hi.macroSector} `
        + `down to ${formatPercent(lo.soleProprietorShare)} of ${lo.macroSector}.`,
      to: { x: x(lo.soleProprietorShare) + 4, y: y(lo.macroSector) + y.bandwidth() / 2 },
    });
  }
  ann.done();
}

/* Ownership and money, side by side.
   Replaces an earlier log-scale dot plot. That chart asked the reader to decode a
   logarithmic axis, a median dot, a percentile range and six pieces of legal
   jargon before it said anything. Two linear bars say it directly - and linear is
   what makes the point land, because the commonest form's money bar is almost
   invisible next to its count bar. */

const OWNER_LABEL = {
  "Private": "One owner",
  "Partnership": "Partnership",
  "Private Limited Company": "Private limited company",
  "Cooperatives Association": "Cooperative",
  "Share Company": "Share company",
  "One Man Private Limited Company": "One-person limited company",
  "Public Enterprise": "State enterprise",
  "Non Public Enterprise": "Non-state enterprise",
  "Trade Sectoral Association": "Trade association",
  "Commercial Representative": "Commercial representative",
  // Two forms the registry left in Amharic. Escaped rather than pasted so the
  // keys cannot be mangled by an editor or an encoding change, and checked
  // codepoint by codepoint against the names in business_landscape.json.
  // "non-governmental charitable organisation"
  "\u1218\u1295\u130D\u1235\u1273\u12CA \u12EB\u120D\u1206\u1290 \u12E8\u1260\u130E \u12A0\u12F5\u122B\u130E\u1275 \u12F5\u122D\u1305\u1275": "Non-governmental charity",
  // "foreign companies that won an international tender"
  "\u12A2\u1295\u1270\u122D\u1293\u123D\u1293\u120D \u1328\u1228\u1273 \u12EB\u1238\u1290\u1349 \u12E8\u12CD\u132A \u1203\u1308\u122D \u12F5\u122D\u1305\u1276\u127D": "Foreign firm, international tender",
};
const ownerLabel = (n) => OWNER_LABEL[n] || n;

function drawLegalCapital(containerId, rows, scopeNoun) {
  const container = document.getElementById(containerId);
  // Keep the forms that cover virtually the whole register. The long tail is a
  // couple of hundred businesses whose capital runs to millions and would set a
  // scale that flattens everything else; the caveat and the table carry them.
  const MAIN = [
    "Private", "Partnership", "Private Limited Company",
    "Cooperatives Association", "Share Company", "One Man Private Limited Company",
  ];
  const data = MAIN.map((n) => rows.find((r) => r.name === n)).filter(Boolean);
  if (!data.length) return;

  // Shares are of everything in view, including the forms the chart omits, so
  // the percentages still add up to the register the reader is looking at.
  const shownTotal = d3.sum(rows, (d) => d.count) || 1;
  const of = scopeNoun || "the businesses shown";
  const width = container.clientWidth || 760;
  const narrow = width < 620;
  const maxCount = d3.max(data, (d) => d.count);
  const maxCap = d3.max(data, (d) => d.median);
  const bh = 16;

  const rowH = narrow ? 132 : 54;
  const height = data.length * rowH + (narrow ? 44 : 84);
  const svg = resizeSvg(container, height);

  // Measure the labels rather than guessing a gutter: "One-person limited
  // company" overran a fixed 190px and lost its first letter, and the set of
  // forms changes when the region filter narrows the register.
  const probe = svg.append("g").attr("opacity", 0);
  const widest = d3.max(data, (d) => {
    const t = probe.append("text").attr("class", "own-label").text(ownerLabel(d.name));
    const w = t.node().getComputedTextLength();
    t.remove();
    return w;
  }) || 0;
  probe.remove();

  // Below ~620px two columns leave no room for either, so the row stacks: the
  // owner's name on its own line, then each bar full width under its own words.
  const labelW = narrow ? 0 : Math.min(width * 0.3, Math.max(140, widest + 18));
  const gap = narrow ? 0 : 34;
  const colW = narrow
    ? Math.max(60, width - 8)
    : Math.max(70, (width - labelW - gap - 16) / 2);
  const xCount = labelW;
  const xCap = narrow ? labelW : labelW + colW + gap;

  const wCount = (v) => (v / maxCount) * colW;
  const wCap = (v) => (v / maxCap) * colW;

  if (!narrow) {
    svg.append("text").attr("class", "own-head").attr("x", xCount).attr("y", 16)
      .text("How many businesses");
    svg.append("text").attr("class", "own-head").attr("x", xCap).attr("y", 16)
      .text("Money a typical one registers");
  }

  const g = svg.append("g").attr("transform", `translate(0,${narrow ? 8 : 30})`);

  // Where each piece sits inside a row, so the two layouts share one draw pass.
  // Stacked, the caption goes ABOVE its bar: below it, each caption sat nearer
  // the next bar than its own and read as a label for the wrong one.
  const yCountBar = (y) => y + (narrow ? 42 : 6);
  const yCapBar = (y) => y + (narrow ? 88 : 6);
  const caption = (yBar) => (narrow ? yBar - 6 : yBar + bh + 22);

  data.forEach((d, i) => {
    const y = i * rowH;
    const share = formatPercent(d.count / shownTotal);

    g.append("text").attr("class", "own-label")
      .attr("x", narrow ? 0 : labelW - 14)
      .attr("y", narrow ? y + 14 : y + bh + 2)
      .attr("text-anchor", narrow ? "start" : "end")
      .text(ownerLabel(d.name));

    // how many
    g.append("rect").attr("class", "track")
      .attr("x", xCount).attr("y", yCountBar(y)).attr("width", colW).attr("height", bh).attr("rx", 3);
    g.append("rect")
      .attr("x", xCount).attr("y", yCountBar(y))
      .attr("width", Math.max(1.5, wCount(d.count))).attr("height", bh).attr("rx", 3)
      .attr("fill", getCss("--series-3"));
    g.append("text").attr("class", "own-value")
      .attr("x", xCount).attr("y", caption(yCountBar(y)))
      .text(narrow
        ? `${formatNumber(d.count)} businesses (${share})`
        : `${formatNumber(d.count)}  (${share})`);

    // how much
    g.append("rect").attr("class", "track")
      .attr("x", xCap).attr("y", yCapBar(y)).attr("width", colW).attr("height", bh).attr("rx", 3);
    g.append("rect")
      .attr("x", xCap).attr("y", yCapBar(y))
      .attr("width", Math.max(1.5, wCap(d.median))).attr("height", bh).attr("rx", 3)
      .attr("fill", getCss("--series-2"));
    g.append("text").attr("class", "own-value")
      .attr("x", xCap).attr("y", caption(yCapBar(y)))
      .text(narrow
        ? `${formatNumber(d.median)} birr for a typical one`
        : `${formatNumber(d.median)} birr`);

    // One focusable, described row rather than four separate tab stops.
    g.append("rect")
      .attr("x", 0).attr("y", y).attr("width", width).attr("height", rowH - 6)
      .attr("fill", "transparent")
      .attr("tabindex", 0)
      .attr("role", "img")
      .attr("aria-label",
        `${ownerLabel(d.name)}: ${formatNumber(d.count)} businesses, ` +
        `${share} of ${of}. ` +
        `A typical one registers ${formatNumber(d.median)} birr.`)
      .on("mousemove focus", (event) => showTooltip(event,
        `<strong>${ownerLabel(d.name)}</strong>` +
        `<div class="tt-row"><span>Businesses</span><b>${formatNumber(d.count)}</b></div>` +
        `<div class="tt-row"><span>Share</span><b>${share}</b></div>` +
        `<div class="tt-row"><span>Typical capital</span><b>${formatNumber(d.median)} birr</b></div>` +
        `<div class="tt-row"><span>Middle half range</span><b>${formatNumber(d.p25)}&ndash;${formatNumber(d.p75)}</b></div>`))
      .on("mouseleave blur", hideTooltip);
  });

  // Each column is scaled to its own longest bar, so say so: a reader comparing
  // a count bar against the money bar beside it would be comparing nothing.
  // One note, and it is the ratio the two columns exist to show.
  const ann = annotationLayer(svg, containerId, { narrow: true });
  const commonest = [...data].sort((a, b) => b.count - a.count)[0];
  const richest = [...data].sort((a, b) => b.median - a.median)[0];
  if (commonest && richest && commonest !== richest && commonest.median) {
    ann.note({ text: `A typical ${ownerLabel(richest.name).toLowerCase()} registers `
      + `${Math.round(richest.median / commonest.median)}x what a typical `
      + `${ownerLabel(commonest.name).toLowerCase()} does, and there are `
      + `${Math.round(commonest.count / richest.count)} times as many of the latter.` });
  }
  ann.done();

  if (narrow) {
    svg.append("text").attr("class", "own-foot")
      .attr("x", 0).attr("y", height - 14)
      .text(`Full bars: ${formatNumber(maxCount)} businesses, ${formatNumber(maxCap)} birr`);
  } else {
    svg.append("text").attr("class", "own-foot")
      .attr("x", xCount).attr("y", height - 14)
      .text(`Full width = ${formatNumber(maxCount)} businesses`);
    svg.append("text").attr("class", "own-foot")
      .attr("x", xCap).attr("y", height - 14)
      .text(`Full width = ${formatNumber(maxCap)} birr`);
  }
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
  // A fixed 210px gutter left 46px of plot on a 328px card, and five tick labels
  // stacked on top of each other underneath it. Both scale with the card now.
  const narrow = width < 620;
  const margin = {
    top: 10,
    right: narrow ? 46 : 72,
    bottom: 30,
    left: narrow ? Math.min(124, Math.round(width * 0.4)) : 210,
  };
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
    .call(d3.axisBottom(x).ticks(narrow ? 3 : 5, "~s").tickSize(0))
    .call((s) => s.select(".domain").remove());
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0))
    .call((s) => s.select(".domain").remove())
    .call((s) => trimAxisLabels(s, margin.left - 12));

  // A note that follows the reader down the hierarchy: at every level it says how
  // top-heavy that level is, which is the thing the drilldown is for.
  const dAnn = annotationLayer(g, chartId, { narrow: true });
  if (rows.length > 2) {
    const lead = leadingShare(rows, 0.5);
    const where = path.length ? path[path.length - 1] : "the whole register";
    if (lead) {
      dAnn.note({ text: `Inside ${where}, ${listPhrase(lead.names)} `
        + `${lead.n > 1 ? "account" : "accounts"} for ${formatPercent(lead.share)} of the `
        + `${rows.length} shown at this level.` });
    }
  }
  dAnn.done();

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
    // Reachable and operable without a mouse. The drilldowns are the most
    // capable thing on the page and were previously click-only.
    .attr("tabindex", 0)
    .attr("role", canDrill ? "button" : "img")
    .attr("aria-label", (d) => canDrill
      ? `${d.name}, ${formatNumber(d.count)} businesses. Activate to open.`
      : `${d.name}, ${formatNumber(d.count)} businesses.`)
    .on("mousemove focus", (event, d) => showTooltip(event, level.tooltip(d, path)))
    .on("mouseleave blur", hideTooltip)
    .on("click", (event, d) => { if (canDrill) { hideTooltip(); onNavigate([...path, d.name]); } })
    .on("keydown", (event, d) => {
      if (!canDrill) return;
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        hideTooltip();
        onNavigate([...path, d.name]);
      }
    });

  g.selectAll(".dval").data(rows).join("text")
    .attr("class", "bar-label")
    .attr("x", (d) => x(d.count) + 8)
    .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
    .attr("dominant-baseline", "middle")
    .text((d) => formatNumber(d.count));

  attachDataTable(chartId,
    path.length ? `${levels[path.length].root} within ${path[path.length - 1]}` : levels[0].root,
    [levels[path.length].root.replace(/s$/, ""), "Businesses"],
    rows.map((d) => [d.name, formatNumber(d.count)]));
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
    ? `Businesses registered in ${region}.`
    : "Every business in the register.")
    + (inSector ? " This chart is not split by sector, so the sector filter does not apply." : ""));

  put("capitalShareScope", "Computed across the whole register — neither filter narrows this comparison, so the two shares stay on the same base.");

  // zoneScope and specialtyScope are written by the drilldowns themselves, which
  // know both the filter and how deep the reader has navigated.
}


/* ---------------------------------------------------------------------------
   Businesses against capital. Two readings of the same eight figures: a radar
   for overall shape, and a dumbbell that can actually be read off.
   --------------------------------------------------------------------------- */

const SHORT_SECTOR = {
  "Logistics, transport and communication": "Logistics",
  "Mining and quarrying": "Mining",
  "Tourism and Arts": "Tourism",
};
const shortSector = (s) => SHORT_SECTOR[s] || s;

function drawSectorRadar(containerId, rows) {
  const container = document.getElementById(containerId);
  const width = container.clientWidth || 420;
  // The old sizing capped the drawing square at 420px and reserved a flat 62px
  // for labels, so a wider panel bought nothing but white space. The square now
  // follows the container, and the label gutter is measured from the longest
  // label actually being drawn rather than guessed at.
  const narrow = width < 620;
  // A label gutter is a straight subtraction from the radius, so on a phone the
  // full sector names left a circle 43% of the box. The gutter gets a budget as
  // a fraction of the card, and the labels are trimmed to it - measured, because
  // "Manufacturing" and "Trade" are nothing like the same width.
  const probe = d3.select(container).append("svg")
    .attr("width", 0).attr("height", 0).style("position", "absolute");
  const measure = (text) => {
    const t = probe.append("text").attr("class", "radar-axis-label")
      .style("font-size", narrow ? "10.5px" : null).text(text);
    const w = t.node().getComputedTextLength();
    t.remove();
    return w;
  };
  const budget = Math.min(d3.max(rows, (d) => measure(shortSector(d.sector))) || 60, width * (narrow ? 0.2 : 0.26));
  // Trim once here so the drawing pass below can use the result directly.
  const axisLabel = (sector) => {
    let text = shortSector(sector);
    if (measure(text) <= budget) return text;
    while (text.length > 3 && measure(`${text.trimEnd()}\u2026`) > budget) text = text.slice(0, -1);
    return `${text.trimEnd()}\u2026`;
  };
  const axisLabels = new Map(rows.map((d) => [d.sector, axisLabel(d.sector)]));
  probe.remove();
  const labelRoom = budget + 16;

  // Size the radius first, then the box around it. Deriving the radius from a
  // height picked in advance is what left a 165px circle floating in a 372px
  // box on a phone: the labels bound the radius horizontally long before the
  // height does, and the leftover height was simply empty.
  const CHROME = 116;              // top and bottom spoke labels, plus the footnote
  const MAX_BOX = 620;
  const r = Math.max(70, Math.min(width / 2 - labelRoom, (MAX_BOX - CHROME) / 2));
  const height = Math.min(MAX_BOX, 2 * r + CHROME);
  const svg = resizeSvg(container, height);
  const cx = width / 2;
  const cy = height / 2 + 4;
  const labelFont = narrow ? "10.5px" : null;
  const n = rows.length;

  // Radial scale is on share; the largest value present sets the outer ring so
  // the shape uses the space without ever exceeding it.
  const maxShare = Math.max(
    d3.max(rows, (d) => d.capitalShare) || 0,
    d3.max(rows, (d) => d.countShare) || 0
  );
  const rings = [0.25, 0.5, 0.75, 1];
  const rad = (share) => (share / maxShare) * r;
  const angle = (i) => (i / n) * 2 * Math.PI - Math.PI / 2;
  const pt = (share, i) => [cx + rad(share) * Math.cos(angle(i)), cy + rad(share) * Math.sin(angle(i))];
  const ringPath = (f) =>
    rows.map((_, i) => {
      const [x, y] = [cx + r * f * Math.cos(angle(i)), cy + r * f * Math.sin(angle(i))];
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join("") + "Z";

  rings.forEach((f) => svg.append("path").attr("class", "radar-grid").attr("d", ringPath(f)));

  rows.forEach((d, i) => {
    const [x, y] = [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
    svg.append("line").attr("class", "radar-spoke").attr("x1", cx).attr("y1", cy).attr("x2", x).attr("y2", y);
    const lx = cx + (r + (narrow ? 14 : 22)) * Math.cos(angle(i));
    const ly = cy + (r + (narrow ? 14 : 22)) * Math.sin(angle(i));
    const anchor = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
    const shown = axisLabels.get(d.sector) || shortSector(d.sector);
    const label = svg.append("text")
      .attr("class", "radar-axis-label")
      .style("font-size", labelFont)
      .attr("x", lx).attr("y", ly + 4)
      .attr("text-anchor", anchor)
      .text(shown);
    // Trimmed labels keep the full sector name for hover and assistive tech.
    if (shown !== d.sector) label.append("title").text(d.sector);
  });

  const poly = (key) => rows.map((d, i) => {
    const [x, y] = pt(d[key], i);
    return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join("") + "Z";

  svg.append("path").attr("d", poly("countShare"))
    .attr("fill", getCss("--series-3")).attr("fill-opacity", 0.16)
    .attr("stroke", getCss("--series-3")).attr("stroke-width", 2);
  svg.append("path").attr("d", poly("capitalShare"))
    .attr("fill", getCss("--series-2")).attr("fill-opacity", 0.16)
    .attr("stroke", getCss("--series-2")).attr("stroke-width", 2);

  rows.forEach((d, i) => {
    [["countShare", "--series-3"], ["capitalShare", "--series-2"]].forEach(([k, c]) => {
      const [x, y] = pt(d[k], i);
      svg.append("circle").attr("cx", x).attr("cy", y).attr("r", 3.5)
        .attr("fill", getCss(c))
        .attr("tabindex", 0)
        .attr("role", "img")
        .attr("aria-label", `${d.sector}: ${k === "countShare" ? "share of businesses" : "share of capital"} ${formatPercent(d[k])}`)
        .on("mousemove focus", (event) => showTooltip(event, radarTip(d)))
        .on("mouseleave blur", hideTooltip);
    });
  });

  svg.append("text").attr("class", "axis-title")
    .attr("x", cx).attr("y", height - 4).attr("text-anchor", "middle")
    .text(`outer ring = ${formatPercent(maxShare)}`);

  // A radar cannot be read off precisely, so the note carries the one number
  // worth taking away: the sector furthest from its own share of businesses.
  // Forced to the list under the chart - this panel is never wide enough to
  // place a note on the plot without landing it on a spoke.
  const ann = annotationLayer(svg, containerId, { narrow: true });
  const spread = [...rows].filter((d) => d.ratio).sort((a, b) => b.ratio - a.ratio);
  if (spread.length > 1) {
    const over = spread[0], under = spread[spread.length - 1];
    ann.note({ text: `${over.sector} holds ${over.ratio.toFixed(1)}x as much of the capital as it does of the businesses — the widest gap of the eight.` });
    ann.note({ text: `${under.sector} is the other end: ${under.ratio.toFixed(2)}x, so it carries less capital than its count of businesses suggests.` });
  }
  ann.done();
}

function radarTip(d) {
  return `<strong>${d.sector}</strong>` +
    `<div class="tt-row"><span>Businesses</span><b>${formatNumber(d.count)} (${formatPercent(d.countShare)})</b></div>` +
    `<div class="tt-row"><span>Capital</span><b>${formatPercent(d.capitalShare)}</b></div>` +
    `<div class="tt-row"><span>Capital vs count</span><b>${d.ratio.toFixed(2)}×</b></div>`;
}

/* ---------------------------------------------------------------------------
   Data tables. Every chart gets its figures as real text, for anyone who cannot
   read the picture - screen reader, low vision, printed page - and as the relief
   the colour-contrast rules require. Collapsed by default so the page still
   reads as a visualization.
   --------------------------------------------------------------------------- */

function attachDataTable(chartId, caption, columns, rows) {
  const chart = document.getElementById(chartId);
  if (!chart || !rows || !rows.length) return;

  const id = `${chartId}-table`;
  let box = document.getElementById(id);
  if (!box) {
    box = document.createElement("details");
    box.id = id;
    box.className = "data-table";
    // Sit after any explanatory note, not between the chart and its explanation,
    // so the note can refer to the figures as being below it.
    const parent = chart.parentElement;
    const note = parent ? parent.querySelector(":scope > .caveat") : null;
    const notes = document.getElementById(`${chartId}-notes`);
    (note || notes || chart).insertAdjacentElement("afterend", box);
  }
  box.innerHTML = "";

  const summary = document.createElement("summary");
  summary.textContent = `Show the figures (${rows.length} rows)`;
  box.appendChild(summary);

  const scroller = document.createElement("div");
  scroller.className = "tbl-scroll";
  const table = document.createElement("table");

  const cap = document.createElement("caption");
  cap.textContent = caption;
  table.appendChild(cap);

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  columns.forEach((c, i) => {
    const th = document.createElement("th");
    th.textContent = c;
    th.scope = "col";
    if (i) th.className = "numeric";
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    r.forEach((cell, i) => {
      const td = document.createElement(i ? "td" : "th");
      if (!i) td.scope = "row";
      else td.className = "numeric";
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroller.appendChild(table);
  box.appendChild(scroller);
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
    // A suppressed cell has a count but no median: too few businesses to publish
    // a capital figure without disclosing an individual one. Say so rather than
    // rendering a misleading zero.
    const medianEl = document.getElementById("medianCapital");
    if (active.capital?.suppressed || active.capital?.median == null) {
      medianEl.textContent = "Withheld";
      medianEl.title = "Too few businesses in this selection to publish a capital figure without identifying one of them.";
    } else {
      medianEl.textContent = formatBirr(active.capital.median);
      medianEl.removeAttribute("title");
    }
    document.getElementById("filterDescription").textContent = filterDescription;
    document.getElementById("resetFilters").hidden = selectedRegion === "All" && selectedSector === "All";
    setScopeNotes(selectedRegion, selectedSector, active);
    // Chart subject lines are static in the HTML now; the per-chart scope notes
    // carry the filter state, so nothing here rewrites the descriptions.
    const regionRows = regionChartData.slice(0, 14);
    const sectorRows = sectorChartData.slice(0, 8);
    const typeRows = typeData.slice(0, 10);
    drawHorizontalBars("regionChart", regionRows, {
      left: window.innerWidth < 520 ? 112 : 150,
      color: getCss("--green"),
      // How few regions it takes to get past half the register, banded and named.
      annotate: (ann, s) => {
        const lead = leadingShare(regionRows, 0.5);
        if (!lead || lead.n > 4 || regionRows.length < 3) return;
        const top = lead.rows[0], bottom = lead.rows[lead.n - 1];
        const y0 = s.y(top.name || top.region) - 3;
        const y1 = s.y(bottom.name || bottom.region) + s.y.bandwidth() + 3;
        ann.band({ x: -8, y: y0, width: s.innerWidth + 16, height: y1 - y0 });
        ann.note({
          x: s.innerWidth * 0.42,
          y: y1 + 34,
          maxWidth: Math.max(150, s.innerWidth * 0.52),
          text: `${listPhrase(lead.names)} hold ${formatPercent(lead.share)} of everything registered.`,
          to: { x: s.x(bottom.count) * 0.55, y: y1 - 4 },
        });
      },
    });
    drawDonut("sectorChart", sectorRows);
    drawHorizontalBars("typeChart", typeRows, {
      left: 190,
      color: getCss("--blue"),
      // The register's long tail: how far the commonest type sits above the next.
      annotate: (ann, s) => {
        if (typeRows.length < 3) return;
        const sorted = [...typeRows].sort((a, b) => b.count - a.count);
        const first = sorted[0], second = sorted[1];
        if (!second || !second.count) return;
        const times = first.count / second.count;
        if (times < 1.25) return;
        ann.note({
          x: Math.min(s.x(first.count) + 14, s.innerWidth - 10),
          y: s.y(first.name) + s.y.bandwidth() + 26,
          maxWidth: Math.max(140, s.innerWidth * 0.5),
          text: `${first.name} alone is ${times.toFixed(1)}x the next type on the list.`,
          to: { x: s.x(first.count) * 0.6, y: s.y(first.name) + s.y.bandwidth() / 2 },
        });
      },
    });

    attachDataTable("regionChart", "Registered businesses by region",
      ["Region", "Businesses"], regionRows.map((d) => [d.name || d.region, formatNumber(d.count)]));
    attachDataTable("sectorChart", "Registered businesses by sector",
      ["Sector", "Businesses"], sectorRows.map((d) => [d.name, formatNumber(d.count)]));
    attachDataTable("typeChart", "Most common business types",
      ["Business type", "Businesses"], typeRows.map((d) => [d.name, formatNumber(d.count)]));
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
      drawCapitalShareViews();
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
    const f = formalityRows();
    const l = legalCapitalRows();
    drawFormality("formalityChart", f);
    // Under a region filter the percentages are of that region, not the country,
    // so the spoken description has to say which.
    const lScope = regionSelect.value !== "All"
      ? `businesses registered in ${regionSelect.value}`
      : "the whole register";
    drawLegalCapital("legalCapitalChart", l, lScope);
    attachDataTable("formalityChart", "Legal structure by sector",
      ["Sector", "Businesses", "Sole proprietor"],
      f.map((d) => [d.macroSector, formatNumber(d.count), formatPercent(d.soleProprietorShare)]));
    // Every form, including the handful the chart leaves out, and the lower and
    // upper quarters alongside the typical figure the bars show.
    attachDataTable("legalCapitalChart", "Every kind of owner, and the money they register",
      ["Kind of owner", "Businesses", "Lower quarter below", "Typical", "Upper quarter above"],
      l.map((d) => [ownerLabel(d.name), formatNumber(d.count),
        formatNumber(d.p25), formatNumber(d.median), formatNumber(d.p75)]));
  }
  drawFormalityViews();

  // Businesses against capital. National only: the aggregate is computed across
  // the whole register, so the region filter does not narrow it.
  const capitalShareRows = data.sectorCapitalShare || [];
  function drawCapitalShareViews() {
    drawSectorRadar("sectorRadarChart", capitalShareRows);
    // The radar cannot be read off precisely by design, so the table is not
    // optional here - it is where the actual shares live.
    attachDataTable("sectorRadarChart", "Share of businesses against share of capital, by sector",
      ["Sector", "Businesses", "Share of businesses", "Share of capital", "Capital vs count"],
      [...capitalShareRows].sort((a, b) => b.ratio - a.ratio).map((d) => [
        d.sector, formatNumber(d.count), formatPercent(d.countShare),
        formatPercent(d.capitalShare), `${d.ratio.toFixed(2)}x`,
      ]));
  }
  drawCapitalShareViews();

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
