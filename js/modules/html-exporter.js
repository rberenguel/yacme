function processModuleContent(moduleContent, iconMapData = null) {
  // 1. Remove import statements more robustly (including multiline imports)
  let processed = moduleContent.replace(
    /import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];/g,
    "",
  );
  // 2. Remove export statements, but keep the function/variable declaration
  processed = processed.replace(/export (function|const|let|var) /g, "$1 ");
  // 3. Replace editor functions with no-ops for standalone export
  processed = processed.replace(
    /highlightNodeInEditor\(([^)]*)\)/g,
    "(() => {})($1)",
  );
  processed = processed.replace(/clearHighlightInEditor\(\)/g, "() => {}");
  processed = processed.replace(
    /updateNodePositionInEditor\(([^)]*)\)/g,
    "(() => {})($1)",
  );
  processed = processed.replace(
    /updateAllViewTransformsInEditor\(([^)]*)\)/g,
    "(() => {})($1)",
  );
  // 4. If iconMapData is provided, replace the empty iconMap initialization
  if (iconMapData) {
    processed = processed.replace(
      /let iconMap = \{\};/g,
      `let iconMap = ${JSON.stringify(iconMapData)};`,
    );
  }
  // 5. Make setPresentMode safe for standalone (no editor elements)
  processed = processed.replace(
    /const editorPane = document\.getElementById\("editor-pane"\);/g,
    'const editorPane = document.getElementById("editor-pane") || { style: {} };',
  );
  processed = processed.replace(
    /const resizer = document\.getElementById\("resizer"\);/g,
    'const resizer = document.getElementById("resizer") || { style: {} };',
  );
  return processed;
}

export function createStandaloneHTML(
  diagramData,
  d3Content,
  dagreContent,
  markedContent,
  diagramJsContent,
  cssContent,
  quizJsContent,
  parserJsContent,
  iconoirCssContent = "",
  diagramText = "",
  ostrichsansCssContent = "",
) {
  const dataString = JSON.stringify(diagramData, null, 2);

  // Parse icon map from iconoir CSS first
  const parsedIconMap = {};
  if (iconoirCssContent) {
    const iconRegex =
      /\.iconoirfont-([a-zA-Z0-9\-]+)::before\s*{\s*content:\s*["']\\([0-9a-fA-F]+)["'];\s*}/g;
    let match;
    while ((match = iconRegex.exec(iconoirCssContent)) !== null) {
      const iconName = match[1];
      const unicodeHex = match[2];
      const character = String.fromCharCode(parseInt(unicodeHex, 16));
      parsedIconMap[iconName] = character;
    }
  }

  const processedDiagramJs = processModuleContent(
    diagramJsContent,
    parsedIconMap,
  );
  const processedQuizJs = processModuleContent(quizJsContent);
  const processedParserJs = processModuleContent(parserJsContent);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported Concept Map</title>
    <style>
        /* Iconoir icon font */
        ${iconoirCssContent}

        /* OstrichSans font for presentations */
        ${ostrichsansCssContent}

        /* Base styles for standalone export */
        body, html {
            margin: 0;
            padding: 0;
            overflow: hidden;
            width: 100%;
            height: 100%;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .diagram-pane {
            width: 100vw !important;
            height: 100vh !important;
        }
        #diagram-container {
            width: 100%;
            height: 100%;
        }
        /* Include the full application CSS */
        ${cssContent}
    </style>
</head>
<body>
    <div class="container view-only present-mode">
    <div class="diagram-pane">
        <svg id="diagram-container">
            <defs>
                <marker id="arrowhead" viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M0,-5L10,0L0,5" fill="#cb4b16"></path>
                </marker>
            </defs>
            <g id="zoom-group">
                <g id="links"></g>
                <g id="nodes"></g>
            </g>
        </svg>
        <div id="slide-controls" style="display: none;">
            <button id="prev-slide" class="slide-nav-btn">
                <span>←</span>
            </button>
            <div id="slide-indicator"></div>
            <button id="next-slide" class="slide-nav-btn">
                <span>→</span>
            </button>
        </div>
    </div>
    </div>

    <script>${d3Content}</script>
    <script>${dagreContent}</script>
    <script>${markedContent}</script>

    <script>
    // Self-executing function to encapsulate the diagram logic
    (function() {
        // This is the processed content of parser.js
        ${processedParserJs}

        // This is the processed content of diagram.js
        ${processedDiagramJs}

        // This is the processed content of quiz.js
        ${processedQuizJs}

        // The original diagram text content
        const diagramText = \`${diagramText.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`;

        // Parse the diagram text to get slides and preset if they exist
        const parsedData = parseCompactFormat(diagramText);
        let cumulativeSlides = null;
        if (parsedData.slides) {
            cumulativeSlides = computeCumulativeSlides(parsedData.slides, parsedData.nodes);
            setSlideContext(cumulativeSlides, null);
            cacheFullNodeData(parsedData.nodes);
            initSlideControls();
        }

        // Set preset context if available
        if (parsedData.preset) {
            setPresetContext(parsedData.preset);
        }

        // Use the parsed nodes from the diagram text, not the pre-processed data
        // This ensures all properties (like labelStyle, newlines in titles, etc.) are preserved
        updateDiagram(parsedData.nodes);

        // Check URL parameters for auto-starting presentation mode
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('preso') && hasSlides()) {
            // Small delay to ensure diagram is rendered before entering present mode
            setTimeout(() => {
                setPresentMode(true);
            }, 100);
        }

        // Add keydown listener for quiz and presentation mode
        let isQuizActive = false;
        window.addEventListener("keydown", (e) => {
            // Quiz mode toggle
            if ((e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "q") {
                e.preventDefault();
                if (isQuizActive) {
                    stopQuizMode();
                    isQuizActive = false;
                } else {
                    startQuizMode();
                    isQuizActive = true;
                }
            }

            // Present mode toggle (Cmd/Ctrl+Enter)
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (hasSlides()) {
                    setPresentMode(!isPresentMode());
                }
            }

            // Escape to exit present mode
            if (e.key === "Escape" && isPresentMode()) {
                e.preventDefault();
                setPresentMode(false);
            }

            // Arrow keys for slide navigation in present mode
            if (isPresentMode()) {
                if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    const currentIndex = getCurrentSlideIndex();
                    if (currentIndex !== null && currentIndex > 0) {
                        goToSlide(currentIndex - 1);
                    }
                }
                if (e.key === "ArrowRight") {
                    e.preventDefault();
                    const currentIndex = getCurrentSlideIndex();
                    const total = getTotalSlides();
                    if (currentIndex !== null && currentIndex < total - 1) {
                        goToSlide(currentIndex + 1);
                    }
                }
            }
        });
    })();
    </script>
</body>
</html>
  `;
}
