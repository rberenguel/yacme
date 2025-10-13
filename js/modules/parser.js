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
