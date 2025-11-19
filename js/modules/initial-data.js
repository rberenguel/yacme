export const compactDiagramData = `
- nodeStyle="fill: #1a1a2e; stroke: #2aa198;"
- labelStyle="fill: #93a1a1; font-family: OstrichSans; font-size: 30px;"
- edgeStyle="stroke: #cb4b16; stroke-width: 2;"
- edgeLabelStyle="font-family: OstrichSans; font-size: 20px;"
- charWidth="13"
- lineHeight="28"
- baseHeight="80"

Welcome :home: Welcome to YACME!

# Welcome

YACME is a live-editing concept map and diagramming tool.

**Try these shortcuts:**
- Cmd/Ctrl+S to Save
- Cmd/Ctrl+O to Open
- Cmd/Ctrl+Enter to start Present Mode!

Edit this text and watch the diagram update in real-time.

---

A :book: Concepts
B :network: Relationships
C :play: Presentations ; url="https://github.com/rberenguel/yacme"

A -> B connects to ; nodeStyle="stroke: #2aa198; stroke-width: 3;" arrowColor="#2aa198"
B -> C enables ; nodeStyle="stroke: #268bd2; stroke-dasharray: 5,5;" arrowColor="#268bd2"
A -> C direct ; arrow="none" nodeStyle="stroke: #dc322f; stroke-dasharray: 2,2;"

# SLIDES

Welcome

---

-Welcome
A

---

B
A -> B

---

+Welcome
C
B -> C

---

A -> C
~Welcome
`;
