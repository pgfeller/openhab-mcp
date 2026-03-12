# OpenHAB MCP Server

A Fast and Concise Model Context Protocol (MCP) server for OpenHAB (v5+).

This server exposes the entire OpenHAB REST API as a set of tools for AI models like Claude or VS Code assistants. It allows for complete control over Items, Things, Rules, Persistence, Semantic Tags, and more.

## Prerequisites

- Node.js (v18 or higher)
- An OpenHAB API Token (Generate in User Profile -> API Tokens)

## Configuration

The server requires two environment variables:

- `OPENHAB_URL`: The URL of your OpenHAB instance (e.g., `http://openhab:8080`)
- `OPENHAB_API_TOKEN`: Your generated long-lived API token.

## Setup instructions

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Build the server:**

   ```bash
   npm run build
   ```

3. **Test locally (Optional):**
   ```bash
   OPENHAB_URL=http://openhab:8080 OPENHAB_API_TOKEN=your_token_here npm start
   ```

## Client Integration

### Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openhab": {
      "command": "node",
      "args": ["/path/to/oh-mcp/dist/index.js"],
      "env": {
        "OPENHAB_URL": "http://openhab:8080",
        "OPENHAB_API_TOKEN": "your_openhab_token_here"
      }
    }
  }
}
```

### Antigravity

Add the following to your Antigravity MCP settings:

```json
{
  "mcpServers": {
    "openhab": {
      "command": "node",
      "args": ["/path/to/oh-mcp/dist/index.js"],
      "env": {
        "OPENHAB_URL": "http://openhab:8080",
        "OPENHAB_API_TOKEN": "your_openhab_token_here"
      }
    }
  }
}
```

### VS Code (Roo/Cline)

Add a new MCP server in your settings:

```json
{
  "mcpServers": {
    "openhab": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "OPENHAB_URL": "http://openhab:8080",
        "OPENHAB_API_TOKEN": "your_openhab_token_here"
      }
    }
  }
}
```

---

## 🛠 Available Tools

This server exposes over 80 tools for comprehensive OpenHAB management.

### 🚀 Smart & Advanced Tools

Tools designed to automate complex workflows and provide AI-friendly context.

- `get_system_summary`: High-density overview of the entire system (rooms, items, things, health).
- `get_prompt_context`: Condensed priming context for an AI agent.
- `get_schema`: Minimal mapping of all items (name, type, label).
- `search_items`: Fuzzy search for items by name, label, or location.
- `create_equipment_from_thing`: Automatically creates an Equipment group and Point items from a Thing's channels.
- `explain_item_state`: Forensic review of an item (state + history + linked hardware + affecting rules).
- `predictive_rule_generator`: Generates a validated Javascript rule from natural language intent.
- `shadow_run`: Simulates a sequence of commands and predicts resulting states without hardware impact.
- `generate_topology`: Generates a Mermaid graph of the home's spatial/logical hierarchy.
- `analyze_system_health`: Scans for hardware issues, connectivity drift, and low batteries.
- `audit_semantic_model`: Structural audit to find loose items or missing equipment hierarchy.
- `bulk_item_remediation`: Mass-update tags, categories, and groups for a list of items.
- `discover_automation_patterns`: Correlation engine to suggest automations based on persistence history.
- `detect_rule_conflicts`: Identifies potential race conditions or conflicting logic between rules.
- `standardize_naming_convention`: Proposes a unified Location_Equipment_Point naming format.
- `optimize_persistence_strategy`: Recommends optimal recording intervals to prevent database bloat.
- `sitemap_to_main_ui`: Converts legacy .sitemap definitions to modern MainUI YAML.
- `optimize_mcp_focus`: Locks the MCP to a specific Room or Group to save tokens and increase AI accuracy.
- `export_system_snapshot`: Generates a portable JSON snapshot for rapid backup and restore.
- `get_mcp_health`: Returns real-time health metrics (SSE status, cache hit rates, buffer size).
- `summarize_persistence_range`: Returns statistical summary of historical data to save context tokens.
- `get_mcp_capabilities`: Returns a list of currently active advanced capabilities.
- `simulate_system_state`: Predicts command outcomes (including triggers) without affecting hardware.
- `generate_home_blueprint`: Auto-generates a structured Markdown manual of your entire home model.
- `audit_system_safety`: Proactive scanner for security items (Locks, Alarms) with safety check logic.
- `calculate_energy_insights`: Aggregates energy/power data into a high-level consumption report.
- `test_transformation`: Evaluate REGEX or JSONPATH patterns locally.
- `get_recent_logs`: Real-time tail of the OpenHAB event stream (items, commands, things).
- `get_visual_chart`: Generates ASCII sparkline charts for an item's recent history.
- `validate_rule_logic`: Sanitizes scripts for syntax errors and safety (infinite loops/guards).

### 🔹 Items & State

- `get_items`: List all items with advanced filters (`tags`, `type`, `metadata`).
- `get_item`: Detailed definition and current state of an item.
- `send_command`: Send a command (e.g., `ON`, `50`, `OFF`) to an item.
- `update_state`: Manually set an item's state.
- `create_or_update_item`: Lifecycle management for items.
- `delete_item`: Remove an item.
- `get_room_status`: Summary of all items tagged in a specific room.
- `add_tag` / `remove_tag`: Manage functional and semantic tags.
- `set_metadata` / `remove_metadata`: Fine-grained configuration management.

### 🔹 Hardware & Connectivity

- `get_things`: List all logical/physical Things.
- `get_thing`: Detailed hardware configuration and UID mapping.
- `get_thing_status`: Check if hardware is `ONLINE`, `OFFLINE`, etc.
- `update_thing_config`: Modify hardware parameters.
- `enable_thing`: Restart or disable a specific Thing.
- `create_thing` / `update_thing` / `delete_thing`: Manage hardware lifecycle.
- `get_inbox`: Review discovered devices waiting to be added.
- `approve_inbox_item`: Promote a discovered device to a system Thing.

### 🔹 Automation & Rules

- `get_rules`: List all rule definitions.
- `get_rule`: Inspect triggers, conditions, and actions.
- `create_rule` / `update_rule` / `delete_rule`: Rule lifecycle.
- `run_rule`: Manually trigger an automation.
- `enable_rule`: Toggle automation logic.

### 🔹 Persistence & Analysis

- `get_item_persistence_data`: Fetch historical raw data points.
- `get_item_statistics`: Calculate peaks, averages, and duty cycles over time.
- `store_item_persistence_data`: Manually insert state history.
- `get_persistence_services`: List storage backends (RRD4j, InfluxDB, etc.).

### 🔹 Links & Semantic Model

- `get_links`: View relationships between Items and Hardware Channels.
- `link_item_to_channel`: Bind an item to a specific channel.
- `unlink_item_from_channel`: Remove a binding.
- `configure_link_profile`: Apply profiles like `system:follow` or `transform:JS` to a link.
- `get_semantic_tags`: Retrieve standard Location/Equipment/Point tags.
- `suggest_semantic_tags`: AI-driven tagging suggestions based on item naming.

### 🔹 Media, Voice & Scenes

- `control_media`: Context-aware controls (play, pause, next, volume) for any media item.
- `capture_scene`: Save a snapshot of multiple item states as a Scene.
- `activate_scene`: Restore a saved Scene state.
- `voice_say`: Send text-to-speech to a specific speaker.
- `voice_interpret`: Resolve natural language commands via OpenHAB's interpreter.
- `chat_with_habot`: NLP interaction with the HABot interface.
- `get_voices` / `get_audio_sinks` / `get_audio_sources`: Discover audio capabilities.

### 🔹 UI & System Maintenance

- `get_ui_components` / `get_ui_tiles`: Access MainUI layout data.
- `generate_ui_widget`: Create MainUI YAML for custom dashboard widgets.
- `get_system_info`: CPU, Memory, Java version, and OS details.
- `get_loggers` / `set_logger_level`: Monitor and change log verbosity on the fly.
- `get_addons` / `install_addon` / `uninstall_addon`: Manage system extensions.
- `get_sitemaps`: Access legacy sitemap UI definitions.
- `generate_system_boilerplate`: Create Typescript interfaces for your entire home.

## License

MIT
