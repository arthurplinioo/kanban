// Duas implantacoes do mesmo codigo vivem na mesma origem
// (arthurplinioo.github.io/kanban e /kanban-rosa). Tudo que fica no navegador
// (localStorage, sessao do Firebase) precisa de prefixo proprio por variante,
// senao duas pessoas usando o mesmo aparelho veriam os dados uma da outra.
const RAW_VARIANT = import.meta.env.VITE_VARIANT || 'default';

export const VARIANT = RAW_VARIANT === 'rosa' ? 'rosa' : 'default';
export const IS_ROSA = VARIANT === 'rosa';
export const STORAGE_PREFIX = IS_ROSA ? 'taskflow-rosa' : 'taskflow';
export const APP_NAME = IS_ROSA ? 'TaskFlow Rosa' : 'TaskFlow';
export const DEFAULT_THEME = IS_ROSA ? 'light' : 'dark';
