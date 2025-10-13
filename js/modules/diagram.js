// js/modules/diagram.js

const svg = d3.select("#diagram-container");
const svgElement = document.querySelector(".diagram-pane");
let width = svgElement.clientWidth;
let height = svgElement.clientHeight;
const zoomGroup = svg.select("#zoom-group");
const linksGroup = zoomGroup.select("#links");
const nodesGroup = zoomGroup.select("#nodes");
let nodes = [];
let links = [];
let iconMap = {}; // This will hold the map loaded by main.js

/**
 * Receives the dynamically loaded icon map.
 * @param {Object} map - The icon name to character map.
 */
export function setIconMap(map) {
  iconMap = map;
}

/**
 * Renders a label, handling multiline text and icon replacement.
 * This version robustly centers text and solves the placement regression.
 * @param {d3.Selection} textElement - The D3 selection of the <text> element.
 * @param {string} labelText - The text content of the label.
 */
function renderLabel(textElement, labelText, edge = false) {
  textElement.selectAll("*").remove();
  // This is the critical fix for the label placement regression.
  textElement.attr("text-anchor", "middle");

  const label = (labelText || "").replace(/\\n/g, "\n");
  const lines = label.split("\n");
  const lineHeight = 1.2;
  const initial_dy = -((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    const lineTspan = textElement
      .append("tspan")
      .attr("x", edge ? undefined : 0)
      .attr("dy", i === 0 ? `${initial_dy}em` : `${lineHeight}em`);

    const iconRegex = /:([a-zA-Z0-9\-]+):/g;
    let lastIndex = 0;
    let match;

    while ((match = iconRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        lineTspan.append(() =>
          document.createTextNode(line.substring(lastIndex, match.index)),
        );
      }
      const iconName = match[1];
      const iconChar = iconMap[iconName];
      if (iconChar) {
        lineTspan
          .append("tspan")
          .style("font-family", "iconoir") // Apply the icon font directly
          .attr("class", "iconoired")
          .text(iconChar);
      } else {
        // Fallback for unknown icons
        lineTspan.append(() => document.createTextNode(match[0]));
      }
      lastIndex = iconRegex.lastIndex;
    }
    if (lastIndex < line.length) {
      lineTspan.append(() =>
        document.createTextNode(line.substring(lastIndex)),
      );
    }
  });
}

export function getDiagramData() {
  return JSON.parse(JSON.stringify({ nodes, links }));
}

export function resizeDiagram() {
  width = svgElement.clientWidth;
  height = svgElement.clientHeight;
  simulation.force("center", d3.forceCenter(width / 2, height / 2));
  simulation.alpha(0.1).restart();
}

const simulation = d3
  .forceSimulation()
  .force(
    "link",
    d3
      .forceLink()
      .id((d) => d.id)
      .distance(200)
      .strength(0.5),
  )
  .force("charge", d3.forceManyBody().strength(-1000))
  .force("collide", d3.forceCollide())
  .force("center", d3.forceCenter(width / 2, height / 2))
  .velocityDecay(0.5)
  .alphaDecay(0.05)
  .on("tick", ticked);

function updateDiagramAppearance() {
  const nodeSelection = nodesGroup.selectAll("g.node");
  nodeSelection.each(function (d) {
    const label = (d.title || d.id).replace(/\\n/g, "\n");
    const lines = label.split("\n");
    const longestLine = lines.reduce(
      (a, b) => (a.length > b.length ? a : b),
      "",
    );
    d.width = d.expanded ? 360 : longestLine.length * 9 + 40;
    d.height = d.expanded ? 160 : 50 + (lines.length - 1) * 18;
  });

  nodeSelection
    .select("rect")
    .transition()
    .duration(400)
    .attr("width", (d) => d.width)
    .attr("height", (d) => d.height)
    .attr("x", (d) => -d.width / 2)
    .attr("y", (d) => -d.height / 2)
    .attr("style", (d) => d.directives?.nodeStyle || null);

  nodeSelection
    .select("text.label")
    .attr("class", (d) => `label ${d.directives?.labelClass || ""}`)
    .attr("style", (d) => d.directives?.labelStyle || null)
    .attr("y", (d) => (d.expanded ? -d.height / 2 + 20 : 0))
    .each(function (d) {
      renderLabel(d3.select(this), d.title || d.id);
    });

  nodeSelection.selectAll("foreignObject").remove();
  nodeSelection
    .filter((d) => d.expanded)
    .append("foreignObject")
    .attr("width", (d) => d.width - 20)
    .attr("height", (d) => d.height - 50)
    .attr("x", (d) => -d.width / 2 + 10)
    .attr("y", (d) => -d.height / 2 + 40)
    .style("opacity", 0)
    .call((fo) => fo.transition().duration(400).style("opacity", 1))
    .append("xhtml:div")
    .attr("class", "prose-content")
    .html((d) => d.prose);
}

function getBorderPoint(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) return { x: 0, y: 0 };
  const sx = sourceNode.x,
    sy = sourceNode.y,
    tx = targetNode.x,
    ty = targetNode.y;
  const dx = tx - sx,
    dy = ty - sy;
  if (dx === 0 && dy === 0) return { x: sx, y: sy };
  const w = targetNode.width / 2,
    h = targetNode.height / 2;
  const tan_phi = h / w,
    tan_theta = Math.abs(dy / dx);
  if (tan_theta < tan_phi) {
    const sign = dx > 0 ? 1 : -1;
    return { x: tx - sign * w, y: ty - (sign * w * dy) / dx };
  } else {
    const sign = dy > 0 ? 1 : -1;
    return { x: tx - (sign * h * dx) / dy, y: ty - sign * h };
  }
}

function ticked() {
  linksGroup.selectAll("path.link").attr("d", (d) => {
    const sourcePoint = getBorderPoint(d.target, d.source);
    const targetPoint = getBorderPoint(d.source, d.target);
    return `M ${sourcePoint.x},${sourcePoint.y} L ${targetPoint.x},${targetPoint.y}`;
  });

  // The text-anchor attribute set in renderLabel now correctly centers
  // the text on these coordinates.
  linksGroup
    .selectAll("text.link-label")
    .attr("x", (d) => (d.source.x + d.target.x) / 2)
    .attr("y", (d) => (d.source.y + d.target.y) / 2);

  nodesGroup
    .selectAll("g.node")
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`);
}

function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.1).restart();
    d.fx = d.x;
    d.fy = d.y;
    d3.select(this).classed("grabbing", true);
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d3.select(this).classed("grabbing", false);
  }
  return d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

const zoom = d3
  .zoom()
  .scaleExtent([0.2, 3])
  .on("zoom", ({ transform }) => zoomGroup.attr("transform", transform))
  .filter((event) => !event.target.closest(".prose-content"));
svg.call(zoom).call(zoom.scaleTo, 0.8);

export function updateDiagram(newData) {
  const oldNodeMap = new Map(nodes.map((d) => [d.id, d]));
  nodes = newData.map((d) => Object.assign(oldNodeMap.get(d.id) || {}, d));

  links = [];
  newData.forEach((d) => {
    if (d.parentRelations) {
      d.parentRelations.forEach((p) => {
        links.push({
          source: p.id,
          target: d.id,
          verb: p.verb,
          directives: p.directives,
        });
      });
    }
  });
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((node) =>
    g.setNode(node.id, { label: node.id, width: 150, height: 50 }),
  );
  links.forEach((link) =>
    g.setEdge(link.source.id || link.source, link.target.id || link.target),
  );
  dagre.layout(g);

  nodes.forEach((node) => {
    const nodeInfo = g.node(node.id);
    if (nodeInfo) {
      if (!node.x) {
        node.x = nodeInfo.x + width / 2 - g.graph().width / 2;
        node.y = nodeInfo.y + height / 2 - g.graph().height / 2;
      }
    }
  });

  const nodeSelection = nodesGroup
    .selectAll("g.node")
    .data(nodes, (d) => d.id)
    .join((enter) => {
      const g = enter.append("g").on("click", (event, d) => {
        if (event.defaultPrevented || !d.prose) return;
        d.expanded = !d.expanded;
        if (d.expanded) {
          d.fx = null;
          d.fy = null;
        }
        updateDiagramAppearance();
      });
      g.append("rect").attr("rx", 6).attr("ry", 6);
      g.append("text").attr("class", "label");
      return g;
    });

  nodeSelection.each(function (d) {
    if (d.expanded) {
      d3.select(this).on(".drag", null);
    } else {
      d3.select(this).call(drag(simulation));
    }
  });

  nodeSelection.attr(
    "class",
    (d) =>
      `node ${d.prose ? "prose-node" : ""} ${
        d.expanded ? "expanded-node" : ""
      } ${d.directives?.nodeClass || ""}`,
  );

  linksGroup
    .selectAll("path.link")
    .data(links, (d) => `${d.source.id || d.source}-${d.target.id || d.target}`)
    .join("path")
    .attr("class", (d) => `link ${d.directives?.nodeClass || ""}`)
    .attr("style", (d) => d.directives?.nodeStyle || null)
    .attr("marker-end", "url(#arrowhead)");

  linksGroup
    .selectAll("text.link-label")
    .data(links, (d) => `${d.source.id || d.source}-${d.target.id || d.target}`)
    .join("text")
    .attr("class", (d) => `link-label ${d.directives?.labelClass || ""}`)
    .attr("style", (d) => d.directives?.labelStyle || null)
    .each(function (d) {
      renderLabel(d3.select(this), d.verb, /*edge=*/ true);
    });

  updateDiagramAppearance();

  const oldNodeCount = simulation.nodes().length;

  simulation.nodes(nodes);
  simulation.force("link").links(links);
  simulation.force("collide").radius((d) => d.width / 2 + 20);

  if (
    nodes.length !== oldNodeCount ||
    links.length !== simulation.force("link").links().length
  ) {
    simulation.alpha(0.8).restart();
  } else {
    ticked();
  }
}
