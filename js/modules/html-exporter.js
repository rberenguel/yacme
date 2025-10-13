function processModuleContent(moduleContent) {
  // 1. Remove import statements
  let processed = moduleContent.replace(/^import .* from '.*';$/gm, "");
  // 2. Remove export statements, but keep the function/variable declaration
  processed = processed.replace(/export (function|const|let|var) /g, "$1 ");
  return processed;
}

export function createStandaloneHTML(
  diagramData,
  d3Content,
  dagreContent,
  diagramJsContent,
  cssContent,
) {
  const dataString = JSON.stringify(diagramData, null, 2);
  const processedDiagramJs = processModuleContent(diagramJsContent);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported Concept Map</title>
    <style>
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

        // The diagram data from the main application
        const diagramData = ${dataString};

        // The links in the exported data need to be re-hydrated to reference the actual node objects.
        const nodeMap = new Map(diagramData.nodes.map(n => [n.id, n]));
        diagramData.links.forEach(link => {
            link.source = nodeMap.get(link.source.id || link.source);
            link.target = nodeMap.get(link.target.id || link.target);
        });
        
        // Kick off the diagram rendering and simulation
        updateDiagram(diagramData.nodes);
    })();
    </script>
</body>
</html>
  `;
}
