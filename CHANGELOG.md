# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0] - 2026-03-16

### Added

- **SSE Log Buffering**: In-memory event buffer with searchable historical retrieval (`get_recent_logs`, `get_historical_logs`).
- **Internal Health Metrics**: New `get_mcp_health` and `get_mcp_capabilities` for agent self-diagnostic.
- **Enhanced Reliability**: Axios connection pooling (Keep-Alive) and global 10s timeout.
- **Lazy Discovery**: Background pre-warming of items/things cache for zero-latency initial responses.

## [1.2.0] - 2026-03-12

### Added

- **Community-Inspired Enhancements**:
  - `trigger_discovery_scan`: Manual hardware scan triggering.
  - `get_semantic_path`: Full semantic breadcrumb navigation.
  - `find_neighboring_equipment`: Spatial awareness tool.
  - `schedule_command`: Future-dated command queuing.
  - `get_stale_items`: Proactive maintenance for sensors.
- Optimized for agentic queries with updated `get_prompt_context`.

## [1.1.0] - 2026-03-11

### Added

- Initial release of OpenHAB MCP server.
- Support for Items, Things, Rules, Persistence, and Semantic Tags.
- Real-time event streaming via SSE.
- Advanced tools for system auditing, simulation, and energy insights.
- ASCII sparkline charts and system health analysis.

### Changed

- Refactored tool registration for better categorization.
- Standardized naming conventions for tools.

### Fixed

- Duplicated documentation in README.
- Missing `get_system_summary` tool exposure.
