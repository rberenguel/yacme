function parseDirectives(directiveString) {
  const directives = {};
  if (!directiveString) return directives;
  const regex = /(\w+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = regex.exec(directiveString)) !== null) {
    directives[match[1]] = match[2];
  }
  return directives;
}

export function parseCompactFormat(text) {
  const nodesMap = new Map();
  let parsingProseForNode = null;
  let proseMarkdown = ""; // Accumulate prose as markdown
  let parsingPreset = false;
  let presetPositions = new Map(); // nodeId -> {x, y}
  let presetViewTransform = null; // {centerX, centerY, scale}
  let presetLineStart = null;
  let presetLineEnd = null;
  let parsingSlides = false;
  const slides = [];
  let currentSlide = null;

  // Global default styles from preamble
  const defaultStyles = {
    nodeStyle: "",
    labelStyle: "",
    edgeStyle: "",
    edgeLabelStyle: "",
    hoverShadowColor: "", // hover shadow color for present mode
    charWidth: "9", // pixels per character for node width
    lineHeight: "18", // pixels per line for node height
    baseHeight: "50", // base height in pixels
    widthPadding: "40", // width padding in pixels
  };

  function ensureNode(id) {
    if (!nodesMap.has(id)) {
      const node = { id, parentRelations: [], prose: "", directives: {} };
      // Apply default styles if they exist
      if (defaultStyles.nodeStyle) {
        node.directives.nodeStyle = defaultStyles.nodeStyle;
      }
      if (defaultStyles.labelStyle) {
        node.directives.labelStyle = defaultStyles.labelStyle;
      }
      if (defaultStyles.hoverShadowColor) {
        node.directives.hoverShadowColor = defaultStyles.hoverShadowColor;
      }
      // Apply default sizing parameters
      if (defaultStyles.charWidth) {
        node.directives.charWidth = defaultStyles.charWidth;
      }
      if (defaultStyles.lineHeight) {
        node.directives.lineHeight = defaultStyles.lineHeight;
      }
      if (defaultStyles.baseHeight) {
        node.directives.baseHeight = defaultStyles.baseHeight;
      }
      if (defaultStyles.widthPadding) {
        node.directives.widthPadding = defaultStyles.widthPadding;
      }
      nodesMap.set(id, node);
    }
    return nodesMap.get(id);
  }

  const lines = text.trim().split("\n");
  let lineNumber = 0;
  let inPreamble = true; // Track if we're still in the preamble section

  for (const line of lines) {
    lineNumber++;
    const trimmedLine = line.trim();

    // Parse preamble (lines starting with - at the beginning)
    if (inPreamble && trimmedLine.startsWith("- ")) {
      const preambleLine = trimmedLine.substring(2).trim();
      const directives = parseDirectives(preambleLine);
      if (directives.nodeStyle) defaultStyles.nodeStyle = directives.nodeStyle;
      if (directives.labelStyle)
        defaultStyles.labelStyle = directives.labelStyle;
      if (directives.edgeStyle) defaultStyles.edgeStyle = directives.edgeStyle;
      if (directives.edgeLabelStyle)
        defaultStyles.edgeLabelStyle = directives.edgeLabelStyle;
      if (directives.hoverShadowColor)
        defaultStyles.hoverShadowColor = directives.hoverShadowColor;
      if (directives.charWidth) defaultStyles.charWidth = directives.charWidth;
      if (directives.lineHeight)
        defaultStyles.lineHeight = directives.lineHeight;
      if (directives.baseHeight)
        defaultStyles.baseHeight = directives.baseHeight;
      if (directives.widthPadding)
        defaultStyles.widthPadding = directives.widthPadding;
      continue;
    }

    // Once we encounter anything else, we're out of preamble
    if (inPreamble && trimmedLine !== "" && !trimmedLine.startsWith("- ")) {
      inPreamble = false;
    }

    // Check for PRESET marker
    if (trimmedLine === "# PRESET") {
      parsingPreset = true;
      presetLineStart = lineNumber;
      continue;
    }

    // Check for SLIDES marker (ends PRESET if active)
    if (trimmedLine === "# SLIDES") {
      if (parsingPreset) {
        presetLineEnd = lineNumber - 1;
        parsingPreset = false;
      }
      parsingSlides = true;
      currentSlide = {
        nodes: [],
        edges: [],
        excludeNodes: [],
        excludeEdges: [],
        autoExpandNodes: [],
        autoCollapseNodes: [],
        highlightNodes: [],
        highlightEdges: [],
        viewTransform: null,
        lineStart: lineNumber + 1, // Start from the line after # SLIDES
      };
      continue;
    }

    // Handle PRESET parsing
    if (parsingPreset) {
      if (trimmedLine === "" || trimmedLine.startsWith("{") || trimmedLine.startsWith("}")) {
        continue;
      }
      // Parse @view directive
      if (trimmedLine.startsWith("@view")) {
        const viewMatch = trimmedLine.match(
          /@view\s*\((\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\)/,
        );
        if (viewMatch) {
          presetViewTransform = {
            centerX: parseFloat(viewMatch[1]),
            centerY: parseFloat(viewMatch[2]),
            scale: parseFloat(viewMatch[3]),
          };
        }
        continue;
      }
      // Parse node position: NodeId (x, y)
      const posMatch = trimmedLine.match(/^(\S+)\s*\((\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\)/);
      if (posMatch) {
        const nodeId = posMatch[1];
        const x = parseFloat(posMatch[2]);
        const y = parseFloat(posMatch[3]);
        presetPositions.set(nodeId, { x, y });
      }
      continue;
    }

    // Handle slide parsing
    if (parsingSlides) {
      if (
        trimmedLine === "" ||
        trimmedLine.startsWith("{") ||
        trimmedLine.startsWith("}")
      ) {
        continue;
      }

      // Slide separator
      if (trimmedLine === "---") {
        if (
          currentSlide &&
          (currentSlide.nodes.length > 0 ||
            currentSlide.edges.length > 0 ||
            currentSlide.excludeNodes.length > 0 ||
            currentSlide.excludeEdges.length > 0)
        ) {
          currentSlide.lineEnd = lineNumber - 1;
          slides.push(currentSlide);
        }
        currentSlide = {
          nodes: [],
          edges: [],
          excludeNodes: [],
          excludeEdges: [],
          autoExpandNodes: [],
          autoCollapseNodes: [],
          highlightNodes: [],
          highlightEdges: [],
          viewTransform: null, // Store viewport transform (centerX%, centerY%, scale)
          lineStart: lineNumber + 1,
        };
        continue;
      }

      // Parse slide content
      if (trimmedLine.startsWith("@view")) {
        // Viewport transform: @view (centerX%, centerY%, scale)
        const viewMatch = trimmedLine.match(
          /@view\s*\((\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\)/,
        );
        if (viewMatch) {
          currentSlide.viewTransform = {
            centerX: parseFloat(viewMatch[1]),
            centerY: parseFloat(viewMatch[2]),
            scale: parseFloat(viewMatch[3]),
          };
        }
      } else if (trimmedLine[0] === "-") {
        // Exclusion
        const content = trimmedLine.substring(1).trim();
        if (content.includes("->")) {
          currentSlide.excludeEdges.push(content);
        } else {
          currentSlide.excludeNodes.push(content);
        }
      } else if (trimmedLine.match(/^!+/)) {
        // Highlight node or edge (!, !!, !!!, !!!!)
        const exclamationCount = trimmedLine.match(/^!+/)[0].length;
        const level = Math.min(exclamationCount, 4); // Max 4 levels
        const content = trimmedLine.substring(exclamationCount).trim();

        if (content.includes("->")) {
          // Highlight edge
          currentSlide.highlightEdges.push({ edge: content, level });
          // Also add the edge to visible edges
          if (!currentSlide.edges.includes(content)) {
            currentSlide.edges.push(content);
          }
        } else {
          // Highlight node (possibly with position)
          const positionMatch = content.match(
            /^(\S+)\s*\((\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\)$/,
          );
          if (positionMatch) {
            const nodeId = positionMatch[1];
            const posX = parseFloat(positionMatch[2]);
            const posY = parseFloat(positionMatch[3]);

            currentSlide.highlightNodes.push({ nodeId, level });

            // Initialize positions map if needed
            if (!currentSlide.nodePositions) {
              currentSlide.nodePositions = {};
            }
            currentSlide.nodePositions[nodeId] = { x: posX, y: posY };

            if (!currentSlide.nodes.includes(nodeId)) {
              currentSlide.nodes.push(nodeId);
            }
          } else {
            // Regular highlight without position
            currentSlide.highlightNodes.push({ nodeId: content, level });
            if (!currentSlide.nodes.includes(content)) {
              currentSlide.nodes.push(content);
            }
          }
        }
      } else if (trimmedLine[0] === "+") {
        // Auto-expand node
        const nodeId = trimmedLine.substring(1).trim();
        currentSlide.autoExpandNodes.push(nodeId);
        if (!currentSlide.nodes.includes(nodeId)) {
          currentSlide.nodes.push(nodeId);
        }
      } else if (trimmedLine[0] === "~") {
        // Force-collapse node
        const nodeId = trimmedLine.substring(1).trim();
        currentSlide.autoCollapseNodes.push(nodeId);
        if (!currentSlide.nodes.includes(nodeId)) {
          currentSlide.nodes.push(nodeId);
        }
      } else if (trimmedLine.includes("->")) {
        // Edge reference
        currentSlide.edges.push(trimmedLine);
      } else {
        // Node reference (possibly with position)
        // Check for position syntax: NodeId (x, y)
        const positionMatch = trimmedLine.match(
          /^([+~]?)(\S+)\s*\((\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\)$/,
        );
        if (positionMatch) {
          const prefix = positionMatch[1];
          const nodeId = positionMatch[2];
          const posX = parseFloat(positionMatch[3]);
          const posY = parseFloat(positionMatch[4]);

          // Handle prefixes
          if (prefix === "+") {
            currentSlide.autoExpandNodes.push(nodeId);
          } else if (prefix === "~") {
            currentSlide.autoCollapseNodes.push(nodeId);
          }

          // Initialize positions map if needed
          if (!currentSlide.nodePositions) {
            currentSlide.nodePositions = {};
          }
          currentSlide.nodePositions[nodeId] = { x: posX, y: posY };

          if (!currentSlide.nodes.includes(nodeId)) {
            currentSlide.nodes.push(nodeId);
          }
        } else {
          // Regular node reference without position
          currentSlide.nodes.push(trimmedLine);
        }
      }
      continue;
    }

    // Original graph parsing (before SLIDES)
    if (
      trimmedLine === "" ||
      trimmedLine.startsWith("{") ||
      trimmedLine.startsWith("}")
    )
      continue;
    if (trimmedLine.startsWith("---") && parsingProseForNode) {
      // End of prose section - convert accumulated markdown to HTML
      const node = ensureNode(parsingProseForNode);
      if (typeof marked !== 'undefined') {
        node.prose = marked.parse(proseMarkdown.trim());
      } else {
        // Fallback if marked is not available
        node.prose = proseMarkdown.split('\n').map(line => `<p>${line}</p>`).join('');
      }
      parsingProseForNode = null;
      proseMarkdown = "";
      continue;
    }
    if (trimmedLine.startsWith("#")) {
      const nodeId = trimmedLine.split("#").pop().trim().split(/\s+/)[0];
      parsingProseForNode = nodeId;
      proseMarkdown = ""; // Reset prose markdown accumulator
      ensureNode(nodeId).prose = "";
      continue;
    }
    if (parsingProseForNode) {
      // Accumulate markdown lines
      proseMarkdown += line + "\n";
      continue;
    }

    if (trimmedLine.includes("->")) {
      // Check for * prefix indicating slide-only edge
      let edgeLine = trimmedLine;
      let isSlideOnlyEdge = false;
      if (edgeLine.trim().startsWith("*")) {
        isSlideOnlyEdge = true;
        edgeLine = edgeLine.trim().substring(1).trim();
      }

      const [sourcePart, targetPartWithDirectives] = edgeLine
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

      // Mark as slide-only if * prefix was used
      if (isSlideOnlyEdge) {
        directives.slideOnly = "true";
      }

      // Apply default edge styles
      const edgeDirectives = { ...directives };
      if (defaultStyles.edgeStyle && !directives.nodeStyle) {
        edgeDirectives.nodeStyle = defaultStyles.edgeStyle;
      } else if (defaultStyles.edgeStyle && directives.nodeStyle) {
        // Merge: user styles override defaults
        edgeDirectives.nodeStyle =
          defaultStyles.edgeStyle + "; " + directives.nodeStyle;
      }
      if (defaultStyles.edgeLabelStyle && !directives.labelStyle) {
        edgeDirectives.labelStyle = defaultStyles.edgeLabelStyle;
      } else if (defaultStyles.edgeLabelStyle && directives.labelStyle) {
        edgeDirectives.labelStyle =
          defaultStyles.edgeLabelStyle + "; " + directives.labelStyle;
      }
      if (defaultStyles.hoverShadowColor && !directives.hoverShadowColor) {
        edgeDirectives.hoverShadowColor = defaultStyles.hoverShadowColor;
      }

      ensureNode(sourceId);
      ensureNode(targetId).parentRelations.push({
        id: sourceId,
        verb,
        directives: edgeDirectives,
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

    // Check for * prefix indicating slide-only node
    const isSlideOnly = definitionPart.startsWith("*");
    if (isSlideOnly) {
      definitionPart = definitionPart.substring(1).trim();
    }

    const parts = definitionPart.split(/\s+/);
    const nodeId = parts.shift();
    const title = parts.join(" ");

    if (nodeId) {
      const node = ensureNode(nodeId);
      if (title) node.title = title;
      const userDirectives = parseDirectives(directiveString);

      // Mark as slide-only if * prefix was used
      if (isSlideOnly) {
        userDirectives.slideOnly = "true";
      }

      // Merge user directives with defaults (user overrides)
      if (userDirectives.nodeStyle && node.directives.nodeStyle) {
        node.directives.nodeStyle =
          node.directives.nodeStyle + "; " + userDirectives.nodeStyle;
      } else if (userDirectives.nodeStyle) {
        node.directives.nodeStyle = userDirectives.nodeStyle;
      }

      if (userDirectives.labelStyle && node.directives.labelStyle) {
        node.directives.labelStyle =
          node.directives.labelStyle + "; " + userDirectives.labelStyle;
      } else if (userDirectives.labelStyle) {
        node.directives.labelStyle = userDirectives.labelStyle;
      }

      // Copy other directives that don't have defaults
      for (const key in userDirectives) {
        if (key !== "nodeStyle" && key !== "labelStyle") {
          node.directives[key] = userDirectives[key];
        }
      }
    }
  }

  // Add last slide if exists
  if (
    parsingSlides &&
    currentSlide &&
    (currentSlide.nodes.length > 0 ||
      currentSlide.edges.length > 0 ||
      currentSlide.excludeNodes.length > 0 ||
      currentSlide.excludeEdges.length > 0)
  ) {
    currentSlide.lineEnd = lineNumber;
    slides.push(currentSlide);
  }

  // If at end of file and still in PRESET, close it
  if (parsingPreset) {
    presetLineEnd = lineNumber;
  }

  return {
    nodes: Array.from(nodesMap.values()),
    slides: slides.length > 0 ? slides : null,
    preset: presetLineStart !== null ? {
      positions: presetPositions,
      viewTransform: presetViewTransform,
      lineStart: presetLineStart,
      lineEnd: presetLineEnd
    } : null,
  };
}

/**
 * Computes cumulative slides from the raw slide definitions.
 * Each slide includes all content from previous slides.
 */
export function computeCumulativeSlides(slides, allNodes) {
  if (!slides || slides.length === 0) return null;

  const cumulativeSlides = [];
  let cumulativeNodes = new Set();
  let cumulativeEdges = new Set();
  let autoExpandNodes = new Set();
  let autoCollapseNodes = new Set();
  let nodePositions = {}; // Track positions cumulatively
  let currentViewTransform = null; // Track viewport transform cumulatively

  for (const slide of slides) {
    // Add new nodes
    slide.nodes.forEach((nodeId) => cumulativeNodes.add(nodeId));

    // Add new edges
    slide.edges.forEach((edge) => cumulativeEdges.add(edge));

    // Handle exclusions
    slide.excludeNodes.forEach((nodeId) => cumulativeNodes.delete(nodeId));
    slide.excludeEdges.forEach((edge) => cumulativeEdges.delete(edge));

    // Track auto-expand nodes (cumulative)
    slide.autoExpandNodes.forEach((nodeId) => {
      autoExpandNodes.add(nodeId);
      autoCollapseNodes.delete(nodeId); // Remove from collapse if expanding
    });

    // Track auto-collapse nodes (cumulative)
    slide.autoCollapseNodes.forEach((nodeId) => {
      autoCollapseNodes.add(nodeId);
      autoExpandNodes.delete(nodeId); // Remove from expand if collapsing
    });

    // Merge node positions (later slides can override)
    if (slide.nodePositions) {
      nodePositions = { ...nodePositions, ...slide.nodePositions };
    }

    // Update viewport transform if specified (later slides override)
    if (slide.viewTransform) {
      currentViewTransform = slide.viewTransform;
    }

    // Highlights are NOT cumulative - only apply to current slide
    const highlightNodes = slide.highlightNodes || [];
    const highlightEdges = slide.highlightEdges || [];

    // Parse edges to extract node IDs
    const edgeNodeIds = new Set();
    cumulativeEdges.forEach((edgeStr) => {
      const [source, target] = edgeStr.split("->").map((s) => s.trim());
      if (source) edgeNodeIds.add(source);
      if (target) {
        // Extract just the target ID (before any label)
        const targetId = target.split(/\s+/)[0];
        edgeNodeIds.add(targetId);
      }
    });

    // Combine explicit nodes and nodes from edges
    const allVisibleNodes = new Set([...cumulativeNodes, ...edgeNodeIds]);

    cumulativeSlides.push({
      visibleNodes: Array.from(allVisibleNodes),
      visibleEdges: Array.from(cumulativeEdges),
      autoExpandNodes: Array.from(autoExpandNodes),
      autoCollapseNodes: Array.from(autoCollapseNodes),
      highlightNodes: highlightNodes, // Not cumulative
      highlightEdges: highlightEdges, // Not cumulative
      nodePositions: { ...nodePositions }, // Copy of cumulative positions
      viewTransform: currentViewTransform ? { ...currentViewTransform } : null, // Copy of current viewport
      lineStart: slide.lineStart,
      lineEnd: slide.lineEnd,
    });
  }

  return cumulativeSlides;
}
