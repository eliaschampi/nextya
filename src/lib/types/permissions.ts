// Tipos y constantes para permisos de entidades
export const ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];
export type EntityPermissions = Record<Action, boolean>;
