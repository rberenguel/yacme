function processModuleContent(moduleContent, iconMapData = null) {
  // 1. Remove import statements more robustly
  let processed = moduleContent.replace(/^import .* from ['"].*['"];$/gm, "");
  // 2. Remove export statements, but keep the function/variable declaration
  processed = processed.replace(/export (function|const|let|var) /g, "$1 ");
  // 3. Replace editor functions with no-ops for standalone export
  processed = processed.replace(
    /highlightNodeInEditor\(([^)]*)\)/g,
    "(() => {})($1)",
  );
  processed = processed.replace(/clearHighlightInEditor\(\)/g, "() => {}");
  // 4. If iconMapData is provided, replace the empty iconMap initialization
  if (iconMapData) {
    processed = processed.replace(
      /let iconMap = \{\};/g,
      `let iconMap = ${JSON.stringify(iconMapData)};`,
    );
  }
  return processed;
}

export function createStandaloneHTML(
  diagramData,
  d3Content,
  dagreContent,
  diagramJsContent,
  cssContent,
  quizJsContent,
  iconoirCssContent = "",
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
    </div>
    
    <script>${d3Content}</script>
    <script>${dagreContent}</script>
    
    <script>
    // Self-executing function to encapsulate the diagram logic
    (function() {
        // This is the processed content of diagram.js
        ${processedDiagramJs}

        // This is the processed content of quiz.js
        ${processedQuizJs}

        // The diagram data from the main application
        const diagramData = ${dataString};

        // The links in the exported data need to be re-hydrated to reference the actual node objects.
        const nodeMapData = new Map(diagramData.nodes.map(n => [n.id, n]));
        diagramData.links.forEach(link => {
            link.source = nodeMapData.get(link.source.id || link.source);
            link.target = nodeMapData.get(link.target.id || link.target);
        });

        // Icon map is already baked into the processed diagram.js code

        // Kick off the diagram rendering and simulation
        updateDiagram(diagramData.nodes);

        // Add keydown listener for the quiz
        let isQuizActive = false;
        window.addEventListener("keydown", (e) => {
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
        });
    })();
    </script>
</body>
</html>
  `;
}
