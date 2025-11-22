# Changelog

All notable changes to YACME will be documented in this file.

## [0.2.0] - 2025-01-22

### Added

- **Positioned Slides**: Nodes can now be positioned using percentage-based coordinates `NodeId (x, y)` for screen-agnostic layouts
- **Drag-to-Position**: In present mode, drag nodes to reposition them and automatically update the source text
- **Multi-Level Highlighting**: Four highlight levels with different colors:
  - `!` - Yellow highlight
  - `!!` - Blue highlight
  - `!!!` - Red highlight
  - `!!!!` - Green highlight
- **URL Parameter Support**: Add `?preso` to auto-start in presentation mode (works in both main app and exported HTML)
- **Improved Node Search**: Click/long-press search now handles all prefix characters (!, +, ~, \*, -)
- **Position Inheritance**: Node positions persist across slides unless explicitly overridden
- **Smart Slide Detection**: Drag-to-position finds the most recent slide where a node was added (handles exclusions and re-additions)

### Changed

- Present mode now properly recalculates positions when entering/exiting to handle viewport size changes
- Highlight styling now uses CSS classes for better performance

### Fixed

- Variable name conflicts in diagram.js resolved
- Viewport resizing issues when toggling present mode
- Editor updates in present mode no longer reset slide position

### Examples Added

- `examples/kafka.cmap` - Complex Kafka architecture diagram with positioned slides
- `examples/highlight-demo.cmap` - Simple highlight demonstration
- `examples/multi-highlight-demo.cmap` - All four highlight levels showcase

## [0.1.2] - Previous Release

- Initial release with basic presentation features
- Slide support with incremental reveals
- Prose sections and expandable nodes
- Icon support and URL links
- Export to standalone HTML
