# Game systems

Each subdirectory is a self-contained **game system**: the data that defines one tabletop
RPG (races, classes, spells, items, attributes, theme, and an optional starter wiki). The
engine is generic and reads from whichever system is active.

- `example/` - a minimal, generic fantasy system. **Copy it to start your own.**

Choose the active system with `NEXT_PUBLIC_ACTIVE_SYSTEM` (defaults to `example`). Swapping
systems needs no engine code changes.

See **[../../docs/BUILD-YOUR-OWN-SYSTEM.md](../../docs/BUILD-YOUR-OWN-SYSTEM.md)** for a full
guide.
