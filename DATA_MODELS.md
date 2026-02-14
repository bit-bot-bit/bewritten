# Data Models

## Character
- **id**: Unique identifier (e.g., "Alice").
- **name**: Display name.
- **current_state**: JSON map of current conditions (e.g., `status: dead`).
- **aliases**: Other names for the character.
- **traits**: List of traits.

## Scene
- **id**: Scene identifier.
- **participants**: List of characters in the scene.
- **extracted_facts**: Facts extracted from the text.
- **location_ids**: List of locations.

## ProvenanceEntry
- **id**: UUID.
- **timestamp**: ISO8601 string.
- **file_path**: Relative path to edited file.
- **author_action**: e.g., "save", "ai_suggest".
- **diff_hash**: Hash of the new content.
- **ai_involved**: Boolean.

## Relationship
- **from_id**, **to_id**: Character/Location IDs.
- **relation_type**: e.g., "Ally", "Rival".
- **strength**: Integer strength value.

## Location
- **id**: Location identifier.
- **name**: Display name.
- **adjacency**: List of adjacent location IDs.
