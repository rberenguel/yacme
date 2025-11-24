// js/modules/diagram.js

import {
  highlightNodeInEditor,
  clearHighlightInEditor,
  updateNodePositionInEditor,
  updateAllViewTransformsInEditor,
} from "./editor.js";
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
let allSlides = null; // All cumulative slides
let currentSlideIndex = null; // Current slide being viewed/edited
let presentMode = false; // Whether we're in presentation mode

svg.on("click", (event) => {
  if (event.target === svg.node()) {
    clearHighlightInEditor();
  }
});

/**
 * Receives the dynamically loaded icon map.
 * @param {Object} map - The icon name to character map.
 */
export function setIconMap(map) {
  iconMap = map;
}

/**
 * Sets the slide context for filtering the diagram.
 * @param {Array} slides - Cumulative slides array
 * @param {number} slideIndex - Current slide index (null for full graph, undefined to keep current)
 */
export function setSlideContext(slides, slideIndex) {
  allSlides = slides;
  if (slideIndex !== undefined) {
    currentSlideIndex = slideIndex;
  }
}

/**
 * Gets the current slide data.
 */
export function getCurrentSlide() {
  if (!allSlides || currentSlideIndex === null) return null;
  return allSlides[currentSlideIndex];
}

export function getCurrentSlideIndex() {
  return currentSlideIndex;
}

export function getTotalSlides() {
  return allSlides ? allSlides.length : 0;
}

/**
 * Navigates to a specific slide (used in present mode).
 */
export function goToSlide(index) {
  if (!allSlides || index < 0 || index >= allSlides.length) return;

  // Capture current viewport before switching slides
  if (presentMode && currentSlideIndex !== null) {
    captureCurrentViewport();
  }

  currentSlideIndex = index;
  updateDiagramFromSlide();
}

/**
 * Enters or exits present mode.
 */
export function setPresentMode(enabled) {
  presentMode = enabled;
  const editorPane = document.getElementById("editor-pane");
  const resizer = document.getElementById("resizer");
  const slideControls = document.getElementById("slide-controls");
  const container = document.querySelector(".container");

  if (enabled) {
    if (container) container.classList.add("present-mode");
    editorPane.style.display = "none";
    resizer.style.display = "none";
    if (slideControls) slideControls.style.display = "flex";

    // Update viewport dimensions BEFORE rendering
    setTimeout(() => {
      width = svgElement.clientWidth;
      height = svgElement.clientHeight;

      if (allSlides && allSlides.length > 0) {
        currentSlideIndex = 0;
        // Force diagram update with new dimensions
        updateDiagramFromSlide();
        // Restart simulation briefly to adjust layout
        simulation.alpha(0.3).restart();

        // Only apply default centering if the first slide doesn't have a @view directive
        const firstSlide = getCurrentSlide();
        if (!firstSlide || !firstSlide.viewTransform) {
          // Center the view so that (50%, 50%) positioning is at the center of the viewport
          // Percentage positions are converted to pixels: (50, 50) -> (0.5 * width, 0.5 * height)
          // We want that point to be displayed at the center of the viewport
          const scale = 0.8;
          const targetX = 0.5 * width; // The pixel position of a node at (50%, 50%)
          const targetY = 0.5 * height;
          const viewportCenterX = width / 2;
          const viewportCenterY = height / 2;

          // Transform to center: viewport_center = translate + (target * scale)
          // So: translate = viewport_center - (target * scale)
          const translateX = viewportCenterX - targetX * scale;
          const translateY = viewportCenterY - targetY * scale;

          svg.call(
            zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale),
          );
        }
      }
    }, 0);
  } else {
    // Write all captured viewports to editor when exiting present mode
    writeAllViewports();

    if (container) container.classList.remove("present-mode");
    editorPane.style.display = "flex";
    resizer.style.display = "block";
    if (slideControls) slideControls.style.display = "none";
    // When exiting, clear slide context to show full graph
    currentSlideIndex = null;
    // Trigger multiple resizes to ensure proper layout
    setTimeout(() => {
      const svgElement = document.querySelector(".diagram-pane");
      width = svgElement.clientWidth;
      height = svgElement.clientHeight;
      resizeDiagram();
    }, 0);
    setTimeout(() => {
      resizeDiagram();
    }, 100);
  }
}

export function isPresentMode() {
  return presentMode;
}

export function hasSlides() {
  return allSlides && allSlides.length > 0;
}

let cachedFullNodeData = null;

/**
 * Caches the full node data for use when switching slides.
 */
export function cacheFullNodeData(nodeData) {
  cachedFullNodeData = nodeData;
}

/**
 * Updates the diagram based on the current slide.
 */
function updateDiagramFromSlide() {
  if (cachedFullNodeData) {
    // Re-run updateDiagram with cached data to apply slide filtering
    updateDiagram(cachedFullNodeData);
  }
  updateSlideIndicator();

  // Apply viewport transform if specified for this slide
  const slideData = getCurrentSlide();
  if (slideData && slideData.viewTransform) {
    applyViewTransform(slideData.viewTransform);
  }
}

/**
 * Apply a viewport transform (center position and scale)
 * @param {Object} transform - {centerX, centerY, scale} where centerX/Y are percentages (0-100)
 */
function applyViewTransform(transform) {
  const { centerX, centerY, scale } = transform;

  // Convert percentage to pixel coordinates
  const targetX = (centerX / 100) * width;
  const targetY = (centerY / 100) * height;

  // Calculate viewport center
  const viewportCenterX = width / 2;
  const viewportCenterY = height / 2;

  // Calculate translate to position target at viewport center
  // viewport_center = translate + (target * scale)
  const translateX = viewportCenterX - targetX * scale;
  const translateY = viewportCenterY - targetY * scale;

  // Apply transform with animation
  svg
    .transition()
    .duration(300)
    .call(
      zoom.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(scale),
    );
}

/**
 * Updates the slide indicator and button states.
 */
function updateSlideIndicator() {
  const indicator = document.getElementById("slide-indicator");
  const prevBtn = document.getElementById("prev-slide");
  const nextBtn = document.getElementById("next-slide");

  if (!allSlides || !indicator) return;

  indicator.textContent = `Slide ${currentSlideIndex + 1} / ${allSlides.length}`;

  if (prevBtn) {
    prevBtn.disabled = currentSlideIndex <= 0;
  }

  if (nextBtn) {
    nextBtn.disabled = currentSlideIndex >= allSlides.length - 1;
  }
}

/**
 * Initializes slide navigation controls.
 */
export function initSlideControls() {
  const prevBtn = document.getElementById("prev-slide");
  const nextBtn = document.getElementById("next-slide");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentSlideIndex > 0) {
        goToSlide(currentSlideIndex - 1);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (allSlides && currentSlideIndex < allSlides.length - 1) {
        goToSlide(currentSlideIndex + 1);
      }
    });
  }
}

/**
 * Renders a label, handling multiline text and icon replacement.
 * This version robustly centers text by assuming the parent <text> element
 * is positioned by a transform on a containing <g> element.
 * @param {d3.Selection} textElement - The D3 selection of the <text> element.
 * @param {string} labelText - The text content of the label.
 */
function renderLabel(textElement, labelText, directives) {
  textElement.selectAll("*").remove();
  // This is the critical fix for the label placement regression.
  textElement.attr("text-anchor", "middle");

  let label = (labelText || "").replace(/\\n/g, "\n");
  if (directives?.url) {
    const linkIconChar = ":link:";
    label = `${linkIconChar} ${label}`;
  }
  const lines = label.split("\n");
  const lineHeight = 1.2;
  const initial_dy = -((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    const lineTspan = textElement
      .append("tspan")
      .attr("x", 0) // All lines are centered at the parent's origin
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

/**
 * Calculates the precise height needed for prose content by measuring actual rendered size.
 * @param {string} prose - The prose/markdown content
 * @param {number} width - Available width for text (default 320px for 360px node)
 * @returns {number} Actual height in pixels
 */
function estimateProseHeight(prose, width = 320) {
  if (!prose || typeof prose !== "string" || prose.trim().length === 0) {
    return 100;
  }

  // Create a temporary invisible div with the same styling as .prose-content
  const tempDiv = document.createElement("div");
  tempDiv.style.position = "absolute";
  tempDiv.style.visibility = "hidden";
  tempDiv.style.width = `${width}px`;
  tempDiv.style.fontSize = "13px";
  tempDiv.style.lineHeight = "1.5";
  tempDiv.style.padding = "10px";
  tempDiv.style.boxSizing = "border-box";
  tempDiv.innerHTML = prose;

  // Append to DOM to measure
  document.body.appendChild(tempDiv);
  const actualHeight = tempDiv.scrollHeight;
  document.body.removeChild(tempDiv);

  // Cap at 50vh
  const maxHeight = window.innerHeight * 0.5;

  return Math.min(actualHeight, maxHeight);
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
    // Get sizing parameters from directives or use defaults
    const charWidth = parseFloat(d.directives?.charWidth || "9");
    const lineHeight = parseFloat(d.directives?.lineHeight || "18");
    const baseHeight = parseFloat(d.directives?.baseHeight || "50");
    const widthPadding = parseFloat(d.directives?.widthPadding || "40");

    d.width = d.expanded ? 360 : longestLine.length * charWidth + widthPadding;

    if (d.expanded) {
      // Calculate height based on prose content for expanded nodes
      if (d.prose) {
        const proseHeight = estimateProseHeight(d.prose, 320);
        // Add space for title at top (~50px)
        d.height = proseHeight + 50;
      } else {
        // Expanded but no prose (shouldn't happen, but fallback)
        d.height = 160;
      }
    } else {
      // Non-expanded node - size based on label
      d.height = baseHeight + (lines.length - 1) * lineHeight;
    }
  });

  nodeSelection
    .select("rect")
    .style("pointer-events", "none")
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
      renderLabel(d3.select(this), d.title || d.id, d.directives);
    });

  nodeSelection.selectAll("foreignObject").remove();
  nodeSelection
    .filter((d) => d.expanded)
    .append("foreignObject")
    .attr("width", (d) => d.width - 20)
    .attr("height", (d) => {
      if (d.prose) {
        return estimateProseHeight(d.prose, 320);
      }
      return 110;
    })
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
    .selectAll("g.link-label-group")
    .attr(
      "transform",
      (d) =>
        `translate(${(d.source.x + d.target.x) / 2}, ${
          (d.source.y + d.target.y) / 2
        })`,
    );

  nodesGroup
    .selectAll("g.node")
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`);
}

function drag(simulation) {
  function dragstarted(event, d) {
    if (event.sourceEvent.button !== 0) return; // Only left click
    if (!event.active) simulation.alphaTarget(0.1).restart();
    d.fx = d.x;
    d.fy = d.y;
    d3.select(this).classed("grabbing", true);
  }
  function dragged(event, d) {
    if (event.sourceEvent.button !== 0) return; // Only left click
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (event.sourceEvent.button !== 0) return; // Only left click
    if (!event.active) simulation.alphaTarget(0);
    d3.select(this).classed("grabbing", false);

    // If in present mode, update the slide text with new position
    if (presentMode && currentSlideIndex !== null && allSlides) {
      // Convert pixel position to percentage
      const percentX = Math.round((d.fx / width) * 100);
      const percentY = Math.round((d.fy / height) * 100);

      // Find the most recent slide where this node was explicitly added
      // (not just visible from a previous slide)
      // This handles the case where a node is excluded and re-added
      let targetSlideIndex = currentSlideIndex;

      // Walk backwards from current slide to find the last explicit addition
      for (let i = currentSlideIndex; i >= 0; i--) {
        const slideData = allSlides[i];
        if (slideData.visibleNodes.includes(d.id)) {
          targetSlideIndex = i;
          // Keep searching backwards - we want the most recent explicit add
          // Check if this node was NOT visible in the previous slide
          if (i === 0 || !allSlides[i - 1].visibleNodes.includes(d.id)) {
            // This is where it was (re-)added
            break;
          }
        }
      }

      updateNodePositionInEditor(d.id, percentX, percentY, targetSlideIndex);
    }
  }
  return d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

const zoom = d3
  .zoom()
  .scaleExtent([0.001, 3])
  .on("zoom", ({ transform }) => {
    zoomGroup.attr("transform", transform);
  })
  .filter((event) => {
    // Don't zoom/pan on prose content or non-left clicks
    if (event.target.closest(".prose-content")) return false;
    if (event.type === "mousedown" && event.button !== 0) return false;
    return true;
  });
svg.call(zoom).call(zoom.scaleTo, 0.8);

// Store viewport transforms per slide during present mode
let slideViewports = new Map();

/**
 * Captures the current viewport transform for the current slide
 */
function captureCurrentViewport() {
  if (!presentMode || currentSlideIndex === null) return;

  // Get current transform
  const transform = d3.zoomTransform(svg.node());
  const scale = transform.k;
  const translateX = transform.x;
  const translateY = transform.y;

  // Calculate the center point in the coordinate space
  // viewport_center = translate + (target * scale)
  // target = (viewport_center - translate) / scale
  const viewportCenterX = width / 2;
  const viewportCenterY = height / 2;
  const targetX = (viewportCenterX - translateX) / scale;
  const targetY = (viewportCenterY - translateY) / scale;

  // Convert to percentages
  const centerX = (targetX / width) * 100;
  const centerY = (targetY / height) * 100;

  // Store in memory (don't write to editor yet)
  slideViewports.set(currentSlideIndex, { centerX, centerY, scale });
}

/**
 * Writes all captured viewport transforms to the editor
 */
function writeAllViewports() {
  if (slideViewports.size > 0) {
    updateAllViewTransformsInEditor(slideViewports);
    slideViewports.clear();
  }
}

export function updateDiagram(newData) {
  const oldNodeMap = new Map(nodes.map((d) => [d.id, d]));
  let allNodes = newData.map((d) =>
    Object.assign(oldNodeMap.get(d.id) || {}, d),
  );

  let allLinks = [];
  newData.forEach((d) => {
    if (d.parentRelations) {
      d.parentRelations.forEach((p) => {
        allLinks.push({
          source: p.id,
          target: d.id,
          verb: p.verb,
          directives: p.directives,
        });
      });
    }
  });

  // Filter by current slide if applicable
  // Use the module-level currentSlideIndex to get the slide context
  const currentSlide = getCurrentSlide();
  if (currentSlide && currentSlideIndex !== null) {
    const visibleNodeIds = new Set(currentSlide.visibleNodes);

    // Filter nodes
    nodes = allNodes.filter((n) => visibleNodeIds.has(n.id));

    // Filter links - check if edge reference matches
    links = allLinks.filter((link) => {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;

      // Check if this edge is in the visible edges list
      return currentSlide.visibleEdges.some((edgeStr) => {
        const [src, tgt] = edgeStr.split("->").map((s) => s.trim());
        const tgtId = tgt.split(/\s+/)[0]; // Extract just the ID
        return src === sourceId && tgtId === targetId;
      });
    });

    // Auto-expand nodes if marked with +
    if (currentSlide.autoExpandNodes) {
      nodes.forEach((node) => {
        if (currentSlide.autoExpandNodes.includes(node.id)) {
          node.expanded = true;
        }
      });
    }

    // Auto-collapse nodes if marked with ~
    if (currentSlide.autoCollapseNodes) {
      nodes.forEach((node) => {
        if (currentSlide.autoCollapseNodes.includes(node.id)) {
          node.expanded = false;
        }
      });
    }
  } else {
    // No slide filtering - hide slide-only content in main view
    nodes = allNodes.filter((n) => n.directives?.slideOnly !== "true");
    links = allLinks.filter((link) => link.directives?.slideOnly !== "true");
  }
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

  // Apply positions from slide if available
  const slideData = getCurrentSlide();
  const slidePositions = slideData?.nodePositions || {};

  nodes.forEach((node) => {
    // Check if this node has a position defined in the current slide
    if (slidePositions[node.id]) {
      const pos = slidePositions[node.id];
      // Convert percentage to pixel coordinates
      node.x = (pos.x / 100) * width;
      node.y = (pos.y / 100) * height;
      // Set fixed position so force simulation doesn't move it
      node.fx = node.x;
      node.fy = node.y;
    } else {
      const nodeInfo = g.node(node.id);
      if (nodeInfo) {
        if (!node.x) {
          node.x = nodeInfo.x + width / 2 - g.graph().width / 2;
          node.y = nodeInfo.y + height / 2 - g.graph().height / 2;
        }
      }
    }
  });

  const nodeSelection = nodesGroup
    .selectAll("g.node")
    .data(nodes, (d) => d.id)
    .join(
      (enter) => {
        const g = enter
          .append("g")
          .style("opacity", 0)
          .call((group) => group.transition().duration(400).style("opacity", 1))
          .on("click", function (event, d) {
            // We use a standard function to get the correct 'this' context.
            // 'this' refers to the <g> element that was clicked.

            const textElement = d3.select(this).select("text.label").node();
            if (!textElement) return;

            const textBBox = textElement.getBBox();
            const [x, y] = d3.pointer(event, this); // Get click coordinates relative to the <g>

            // Manually check if the click was inside the text's bounding box
            if (
              d.directives?.url &&
              x >= textBBox.x &&
              x <= textBBox.x + textBBox.width &&
              y >= textBBox.y &&
              y <= textBBox.y + textBBox.height
            ) {
              // If it was, and there's a URL, open it.
              event.stopPropagation();
              window.open(d.directives.url, "_blank");
            } else {
              // Otherwise, perform the standard node click action.
              event.stopPropagation();
              highlightNodeInEditor(d.id);
              if (event.defaultPrevented || !d.prose) return;
              d.expanded = !d.expanded;
              if (d.expanded) {
                d.fx = null;
                d.fy = null;
              }
              updateDiagramAppearance();
            }
          });

        // Append the children. No event handlers on them directly.
        g.append("rect").attr("rx", 6).attr("ry", 6);
        g.append("text").attr("class", "label");

        return g;
      },
      (update) => update,
      (exit) =>
        exit
          .call((group) => group.transition().duration(300).style("opacity", 0))
          .remove(),
    );

  nodeSelection
    .select("text.label")
    .style("pointer-events", "all")
    .style("cursor", (d) => (d.directives?.url ? "pointer" : "default"));

  nodeSelection.each(function (d) {
    if (d.expanded) {
      d3.select(this).on(".drag", null);
    } else {
      d3.select(this).call(drag(simulation));
    }
  });

  // Apply highlight class based on current slide
  const currentSlideData = getCurrentSlide();
  const highlightNodesData = currentSlideData?.highlightNodes || [];

  // Build a map of nodeId to highlight level
  const highlightNodeMap = new Map();
  highlightNodesData.forEach((item) => {
    const nodeId = typeof item === "string" ? item : item.nodeId;
    const level = typeof item === "string" ? 1 : item.level;
    highlightNodeMap.set(nodeId, level);
  });

  nodeSelection
    .attr("class", (d) => {
      const level = highlightNodeMap.get(d.id);
      const highlightClass = level
        ? `slide-highlight slide-highlight-${level}`
        : "";
      return `node ${d.prose ? "prose-node" : ""} ${
        d.expanded ? "expanded-node" : ""
      } ${highlightClass} ${d.directives?.nodeClass || ""}`;
    })
    .style(
      "--hover-shadow-color",
      (d) => d.directives?.hoverShadowColor || null,
    );

  // Create or update arrow markers for custom colors
  const defs = svg.select("defs");
  const uniqueArrowColors = new Set();
  links.forEach((link) => {
    if (link.directives?.arrowColor && link.directives?.arrow !== "none") {
      uniqueArrowColors.add(link.directives.arrowColor);
    }
  });

  uniqueArrowColors.forEach((color) => {
    const markerId = `arrowhead-${color.replace("#", "")}`;
    if (defs.select(`#${markerId}`).empty()) {
      defs
        .append("marker")
        .attr("id", markerId)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", "10")
        .attr("refY", "0")
        .attr("markerWidth", "6")
        .attr("markerHeight", "6")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    }
  });

  // Build map of highlighted edges with levels
  const highlightEdgesData = currentSlideData?.highlightEdges || [];
  const highlightEdgeMap = new Map();
  highlightEdgesData.forEach((item) => {
    const edgeStr = typeof item === "string" ? item : item.edge;
    const level = typeof item === "string" ? 1 : item.level;
    highlightEdgeMap.set(edgeStr, level);
  });

  linksGroup
    .selectAll("path.link")
    .data(links, (d) => `${d.source.id || d.source}-${d.target.id || d.target}`)
    .join(
      (enter) =>
        enter
          .append("path")
          .style("opacity", 0)
          .call((path) => path.transition().duration(400).style("opacity", 1)),
      (update) => update,
      (exit) =>
        exit
          .call((path) => path.transition().duration(300).style("opacity", 0))
          .remove(),
    )
    .attr("class", (d) => {
      // Check if this edge is highlighted and get level
      const sourceId = d.source.id || d.source;
      const targetId = d.target.id || d.target;
      let highlightLevel = 0;

      for (const [edgeStr, level] of highlightEdgeMap) {
        const [src, tgt] = edgeStr.split("->").map((s) => s.trim());
        const tgtId = tgt.split(/\s+/)[0];
        if (src === sourceId && tgtId === targetId) {
          highlightLevel = level;
          break;
        }
      }

      const highlightClass = highlightLevel
        ? `slide-highlight slide-highlight-${highlightLevel}`
        : "";
      return `link ${highlightClass} ${d.directives?.nodeClass || ""}`;
    })
    .attr("style", (d) => d.directives?.nodeStyle || null)
    .style(
      "--hover-shadow-color",
      (d) => d.directives?.hoverShadowColor || null,
    )
    .attr("marker-end", (d) => {
      if (d.directives?.arrow === "none") return null;
      if (d.directives?.arrowColor) {
        const colorId = d.directives.arrowColor.replace("#", "");
        return `url(#arrowhead-${colorId})`;
      }
      return "url(#arrowhead)";
    });

  const linkLabelGroups = linksGroup
    .selectAll("g.link-label-group")
    .data(links, (d) => `${d.source.id || d.source}-${d.target.id || d.target}`)
    .join(
      (enter) => {
        const g = enter
          .append("g")
          .attr("class", "link-label-group")
          .style("opacity", 0)
          .call((group) =>
            group.transition().duration(400).style("opacity", 1),
          );
        g.append("text");
        return g;
      },
      (update) => update,
      (exit) =>
        exit
          .call((group) => group.transition().duration(300).style("opacity", 0))
          .remove(),
    );

  linkLabelGroups
    .select("text")
    .attr("class", (d) => `link-label ${d.directives?.labelClass || ""}`)
    .attr("style", (d) => d.directives?.labelStyle || null)
    .style("cursor", (d) => (d.directives?.url ? "pointer" : "default"))
    .on("click", (event, d) => {
      if (d.directives?.url) {
        window.open(d.directives.url, "_blank");
      }
    })
    .each(function (d) {
      renderLabel(d3.select(this), d.verb, d.directives);
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
