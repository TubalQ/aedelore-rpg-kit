export const IMPORT_FORMAT = `
When exporting content for import into the DM tool, output JSON between ---IMPORT_START--- and ---IMPORT_END--- markers.

**CRITICAL JSON RULE:** NEVER use double quotes (") inside text strings. Use SINGLE quotes (') for all dialogue. Double quotes inside strings break JSON parsing.

**LOOT RULE:** Simple loot (gold, potions) goes ONLY in encounter "loot" field. Story items (diaries, keys, maps) go ONLY in "items" array with descriptions.

## HOW THE DM TOOL ORGANIZES CONTENT

The DM tool groups content in a **day -> time -> place** hierarchy:
1. Content is grouped by **day** (integer)
2. Within each day, grouped by **time** (dawn/morning/noon/afternoon/dusk/evening/night)
3. Within each time slot, **places** act as containers -- encounters, NPCs, items, and read-aloud nest INSIDE their place

**EVERY piece of content MUST have \`day\` (integer) and \`time\` (string).** Content without day/time appears in an "Unscheduled" bucket and looks broken.

## LINKING RULES (how content nests under places)

The tool matches by **exact name** (case-sensitive). Content only nests inside a place when BOTH the name matches AND the day+time are identical.

| Content type | Linking field | Must match | Example |
|---|---|---|---|
| **encounters** | \`location\` | exact place \`name\` | encounter location: "The Rusty Anchor" -> nests under place named "The Rusty Anchor" |
| **npcs** | \`plannedLocation\` | exact place \`name\` | npc plannedLocation: "The Rusty Anchor" -> nests under that place |
| **items** | \`plannedLocation\` | exact place \`name\` OR encounter \`location\` OR encounter \`name\` | item plannedLocation: "The Rusty Anchor" -> nests under place. OR: "Bandit Ambush" -> nests under that encounter |
| **readAloud** | \`linkedType\` + \`linkedTo\` | exact name of place/encounter/npc | linkedType: "place", linkedTo: "The Rusty Anchor" |

**CRITICAL:** The \`time\` on an NPC/encounter/item MUST be identical to the \`time\` on its target place. If a place has time "evening" but an NPC has time "night", the NPC will NOT appear inside that place.

## STRUCTURE YOUR CONTENT AROUND PLACES

Think of places as the skeleton of the session. Plan places first, then attach everything else to them:

1. **Define places** with day + time (these are the containers)
2. **Put encounters at places** by setting encounter \`location\` = exact place name, same day + time
3. **Put NPCs at places** by setting npc \`plannedLocation\` = exact place name, same day + time
4. **Put items at places or encounters** by setting item \`plannedLocation\` = place name or encounter name, same day + time
5. **Attach read-aloud to places/encounters/npcs** via \`linkedType\` + \`linkedTo\`, same day + time

## FORMAT

\`\`\`json
{
  "hook": "Session goal or hook text",
  "places": [
    {"name": "The Rusty Anchor", "description": "A weathered tavern on the harbor.", "day": 1, "time": "evening"},
    {"name": "Forest Road", "description": "A narrow dirt path through dense woodland.", "day": 1, "time": "dusk"}
  ],
  "npcs": [
    {"name": "Old Marta", "role": "Tavern keeper", "description": "Weathered woman who knows everyone's secrets.", "disposition": "friendly", "day": 1, "time": "evening", "plannedLocation": "The Rusty Anchor"}
  ],
  "encounters": [
    {
      "name": "Bandit Ambush", "location": "Forest Road", "day": 1, "time": "dusk",
      "enemies": [
        {"name": "Bandit Leader", "disposition": "enemy", "role": "Warrior", "hp": "15", "armor": "Leather", "weapon": "Sword", "atkBonus": "+3", "dmg": "1d8"}
      ],
      "tactics": "Leader engages melee while archer flanks from trees.",
      "loot": "25 gold, 2 antidotes"
    }
  ],
  "readAloud": [
    {"title": "Entering the Tavern", "text": "Warm light spills from the crooked doorway...", "day": 1, "time": "evening", "linkedType": "place", "linkedTo": "The Rusty Anchor"}
  ],
  "items": [
    {"name": "Aldrich's Diary", "description": "Leather-bound journal with notes about a secret meeting.", "day": 1, "time": "dusk", "plannedLocation": "Forest Road"}
  ]
}
\`\`\`

## REFERENCE

- **Time values:** dawn, morning, noon, afternoon, dusk, evening, night
- **NPC dispositions:** friendly, neutral, hostile
- **Enemy dispositions:** enemy, neutral
- **Enemy roles:** Warrior, Rogue, Mage, Healer, Ranger, Beast, Civilian, Historian, Other
- **HP and atkBonus are strings**, not numbers: "15", "+3"
`;
