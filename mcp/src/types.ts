export interface UserContext {
  userId: string;
  isAdmin: boolean;
  token: string;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface SessionData {
  transport: unknown;
  server: unknown;
  token: string;
  userId: string;
  isAdmin: boolean;
  createdAt: number;
}

export interface EquippedWeapon {
  name: string;
  damage: string;
  bonus: string;
  range: string;
  break: number;
}

export interface EquippedArmor {
  name: string;
  bodypart: string;
  ac: number;
  hp: number;
  maxHp: number;
  disadvantage: string | null;
}

export interface EquippedShield {
  name: string;
  ac: number;
  hp: number;
  maxHp: number;
  damage: string;
  disadvantage: string | null;
}

export interface SpellSlot {
  name: string;
  selected: boolean;
}

export interface Relationship {
  name: string;
  relation?: string;
  notes?: string;
  archived: boolean;
}

export interface QuestItem {
  name: string;
  description?: string;
  sessionName?: string;
}

export interface DmEquipment {
  name: string;
  type?: string;
  [key: string]: unknown;
}
