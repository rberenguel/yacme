import {
  EditorState,
  EditorView,
  keymap,
  defaultKeymap,
  history,
  historyKeymap,
  markdown,
  oneDark,
  languages,
  markdownLanguage,
  GFM,
} from "CodeMirrorBundle";

const compactDiagramData = `
Welcome Welcome to the Live Editor!

# Welcome

Try Cmd/Ctrl+S to Save and Cmd/Ctrl+O to Open

---

A node 1 ;  nodeStyle="stroke: red;" labelStyle="stroke: orange;"
B node 2

A -> B relates to ; labelStyle="fill: green;"
`;

function parseDirectives(directiveString) {
  const directives = {};
  console.log(directiveString);
  if (!directiveString) return directives;
  const regex = /(\w+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = regex.exec(directiveString)) !== null) {
    directives[match[1]] = match[2];
  }
  console.log(directives);
  return directives;
}

function parseCompactFormat(text) {
  const nodesMap = new Map();
  let parsingProseForNode = null;

  function ensureNode(id) {
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { id, parentRelations: [], prose: "", directives: {} });
    }
    return nodesMap.get(id);
  }

  const lines = text.trim().split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (
      trimmedLine === "" ||
      trimmedLine.startsWith("{") ||
      trimmedLine.startsWith("}")
    )
      continue;
    if (trimmedLine.startsWith("---") && parsingProseForNode) {
      parsingProseForNode = null;
      continue;
    }
    if (trimmedLine.startsWith("#")) {
      const nodeId = trimmedLine.split("#").pop().trim().split(/\s+/)[0];
      parsingProseForNode = nodeId;
      ensureNode(nodeId).prose = "";
      continue;
    }
    if (parsingProseForNode) {
      ensureNode(parsingProseForNode).prose += `<p>${trimmedLine}</p>`;
      continue;
    }

    if (trimmedLine.includes("->")) {
      const [sourcePart, targetPartWithDirectives] = trimmedLine
        .split("->")
        .map((s) => s.trim());

      const firstSemicolonIndex = targetPartWithDirectives.indexOf(";");
      let targetPart, directiveString;

      if (firstSemicolonIndex !== -1) {
        targetPart = targetPartWithDirectives
          .substring(0, firstSemicolonIndex)
          .trim();
        directiveString = targetPartWithDirectives
          .substring(firstSemicolonIndex + 1)
          .trim();
      } else {
        targetPart = targetPartWithDirectives;
        directiveString = "";
      }

      const sourceId = sourcePart;
      const targetWords = targetPart.split(/\s+/);
      const targetId = targetWords.shift();
      const verb = targetWords.join(" ");
      const directives = parseDirectives(directiveString);

      ensureNode(sourceId);
      ensureNode(targetId).parentRelations.push({
        id: sourceId,
        verb,
        directives,
      });
      continue;
    }

    const firstSemicolonIndex = trimmedLine.indexOf(";");
    let definitionPart, directiveString;

    if (firstSemicolonIndex !== -1) {
      definitionPart = trimmedLine.substring(0, firstSemicolonIndex).trim();
      directiveString = trimmedLine.substring(firstSemicolonIndex + 1).trim();
    } else {
      definitionPart = trimmedLine;
      directiveString = "";
    }

    const parts = definitionPart.split(/\s+/);
    const nodeId = parts.shift();
    const title = parts.join(" ");

    if (nodeId) {
      const node = ensureNode(nodeId);
      if (title) node.title = title;
      node.directives = parseDirectives(directiveString);
    }
  }
  return Array.from(nodesMap.values());
}

const svg = d3.select("#diagram-container");
const svgElement = document.querySelector(".diagram-pane");
const width = svgElement.clientWidth;
const height = svgElement.clientHeight;
const zoomGroup = svg.select("#zoom-group");
const linksGroup = zoomGroup.select("#links");
const nodesGroup = zoomGroup.select("#nodes");
let nodes = [];
let links = [];
let editorView;

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
  .velocityDecay(0.5) // Settle faster
  .alphaDecay(0.05) // Cool faster
  .on("tick", ticked);

function updateDiagram(newData) {
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
      `node ${d.prose ? "prose-node" : ""} ${d.expanded ? "expanded-node" : ""} ${d.directives?.nodeClass || ""}`,
  );

  linksGroup
    .selectAll("path.link")
    .data(links, (d) => `${d.source.id}-${d.target.id}`)
    .join("path")
    .attr("class", (d) => `link ${d.directives?.nodeClass || ""}`)
    .attr("style", (d) => d.directives?.nodeStyle || null)
    .attr("marker-end", "url(#arrowhead)");

  linksGroup
    .selectAll("text.link-label")
    .data(links, (d) => `${d.source.id}-${d.target.id}`)
    .join("text")
    .attr("class", (d) => `link-label ${d.directives?.labelClass || ""}`)
    .attr("style", (d) => d.directives?.labelStyle || null)
    .text((d) => d.verb);

  updateDiagramAppearance();

  const oldNodeCount = simulation.nodes().length;

  simulation.nodes(nodes);
  simulation.force("link").links(links);
  simulation.force("collide").radius((d) => d.width / 2 + 20);

  // Only "reheat" the simulation if nodes or links were added/removed.
  if (
    nodes.length !== oldNodeCount ||
    links.length !== simulation.force("link").links().length
  ) {
    simulation.alpha(0.8).restart();
  } else {
    ticked(); // Manually redraw elements if simulation is not restarted
  }
}

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
      const text = d3.select(this);
      text.selectAll("tspan").remove();
      const label = (d.title || d.id).replace(/\\n/g, "\n");
      const lines = label.split("\n");
      const lineHeight = 1.2;
      const initial_dy = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, i) => {
        text
          .append("tspan")
          .attr("x", 0)
          .attr("dy", i === 0 ? `${initial_dy}em` : `${lineHeight}em`)
          .text(line);
      });
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
    if (!event.active) simulation.alphaTarget(0.3).restart();
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

const editorPane = document.getElementById("editor-pane");
editorView = new EditorView({
  state: EditorState.create({
    doc: compactDiagramData.trim(),
    extensions: [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: [GFM],
      }),
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          try {
            const newData = parseCompactFormat(update.state.doc.toString());
            updateDiagram(newData);
          } catch (e) {
            console.error("Error parsing diagram text:", e);
          }
        }
      }),
    ],
  }),
  parent: editorPane,
});

async function saveFile(content) {
  if (navigator.share) {
    try {
      const file = new File([content], "diagram.txt", { type: "text/plain" });
      await navigator.share({ files: [file] });
    } catch (err) {
      if (err.name !== "AbortError") console.error("Share API failed:", err);
    }
  } else {
    const a = document.createElement("a");
    a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(content);
    a.download = "diagram.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
function openFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt,.md,text/plain";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) =>
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: re.target.result,
        },
      });
    reader.readAsText(file);
  };
  input.click();
}
window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "s") {
    e.preventDefault();
    saveFile(editorView.state.doc.toString());
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "o") {
    e.preventDefault();
    openFile();
  }
});

updateDiagram(parseCompactFormat(compactDiagramData));
