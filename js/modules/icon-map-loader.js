// js/modules/icon-map-loader.js

/**
 * Fetches and parses an Iconoir CSS file to create a map of icon names to their Unicode characters.
 * This avoids the need for a manually maintained map.
 * @param {string} url - The path to the Iconoir font CSS file.
 * @returns {Promise<Object>} A promise that resolves to the icon map.
 */
export async function loadIconMap(url = "/fonts/iconoir/iconoir-font.css") {
  const iconMap = {};
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch icon CSS: ${response.statusText}`);
    }
    const cssText = await response.text();
    const regex =
      /\.iconoirfont-([a-zA-Z0-9\-]+)::before\s*{\s*content:\s*["']\\([0-9a-fA-F]+)["'];\s*}/g;

    let match;
    while ((match = regex.exec(cssText)) !== null) {
      const iconName = match[1];
      const unicodeHex = match[2];
      const character = String.fromCharCode(parseInt(unicodeHex, 16));
      iconMap[iconName] = character;
    }
  } catch (error) {
    console.error("Could not load or parse icon map:", error);
  }
  console.log(iconMap);
  return iconMap;
}
