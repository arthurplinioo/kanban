import { generateId } from './idGenerator';
import { IS_ROSA } from '../config/variant';

// Cores das colunas padrao combinando com o tema de cada versao.
const DEFAULT_COLORS = IS_ROSA ? ['#ec4899', '#f59e0b', '#a855f7'] : ['#6366f1', '#f59e0b', '#10b981'];

export const LIMITS = {
  title: 120,
  text: 5000,
  columns: 50,
  tasks: 2000,
  subtasks: 100,
  labels: 10,
};

const TASK_FIELDS = [
  'title', 'subtitle', 'description', 'priority', 'dueDate', 'dueTime', 'endDate', 'endTime',
  'recurrence', 'reminderMinutes', 'subtasks', 'completed', 'googleEventId', 'syncWithGoogle',
  'createdAt', 'labels',
];
const COLUMN_FIELDS = ['title', 'color'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const RECURRENCES = ['none', 'daily', 'weekly', 'monthly'];
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

const str = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
const nullableStr = (value, max) => (typeof value === 'string' && value ? value.slice(0, max) : null);

export function createDefaultBoard() {
  return {
    title: 'Meu Quadro',
    columns: [
      {
        id: generateId(), title: 'A Fazer', color: DEFAULT_COLORS[0], tasks: [
          sanitizeTask({
            id: generateId(),
            title: 'Bem-vindo ao TaskFlow!',
            subtitle: 'Seu organizador Kanban',
            description: 'Arraste tarefas entre colunas, adicione subtarefas e muito mais.',
            priority: 'low',
            subtasks: [
              { id: generateId(), text: 'Explorar o quadro', completed: false },
              { id: generateId(), text: 'Criar uma tarefa', completed: false },
            ],
          }),
        ],
      },
      { id: generateId(), title: 'Em Progresso', color: DEFAULT_COLORS[1], tasks: [] },
      { id: generateId(), title: 'Concluído', color: DEFAULT_COLORS[2], tasks: [] },
    ],
  };
}

export function createEmptySharedBoard(title) {
  return {
    title: str(title, LIMITS.title) || 'Quadro compartilhado',
    columns: [
      { id: generateId(), title: 'A Fazer', color: DEFAULT_COLORS[0], tasks: [] },
      { id: generateId(), title: 'Em Progresso', color: DEFAULT_COLORS[1], tasks: [] },
      { id: generateId(), title: 'Concluído', color: DEFAULT_COLORS[2], tasks: [] },
    ],
  };
}

// O quadro de boas-vindas recem-criado nao deve ser mesclado com a nuvem,
// senao cada aparelho novo duplicaria a tarefa "Bem-vindo".
export function isPristineDefaultBoard(board) {
  if (!board?.columns || board.columns.length !== 3) return false;
  const tasks = board.columns.flatMap(column => column.tasks || []);
  return tasks.length === 1
    && tasks[0].title === 'Bem-vindo ao TaskFlow!'
    && (tasks[0].subtasks || []).every(subtask => !subtask.completed)
    && board.columns.map(column => column.title).join('|') === 'A Fazer|Em Progresso|Concluído';
}

function sanitizeSubtask(subtask) {
  return {
    id: str(subtask?.id, 64) || generateId(),
    text: str(subtask?.text, LIMITS.text),
    completed: subtask?.completed === true,
  };
}

export function sanitizeTask(task) {
  const reminder = Number(task?.reminderMinutes);
  return {
    id: str(task?.id, 64) || generateId(),
    title: str(task?.title, LIMITS.title) || 'Sem titulo',
    subtitle: str(task?.subtitle, LIMITS.title),
    description: str(task?.description, LIMITS.text),
    priority: PRIORITIES.includes(task?.priority) ? task.priority : null,
    dueDate: nullableStr(task?.dueDate, 40),
    dueTime: str(task?.dueTime, 5),
    endDate: nullableStr(task?.endDate, 40),
    endTime: str(task?.endTime, 5),
    recurrence: RECURRENCES.includes(task?.recurrence) ? task.recurrence : 'none',
    reminderMinutes: Number.isFinite(reminder) && reminder >= 0 && reminder <= 10080 ? reminder : 30,
    subtasks: Array.isArray(task?.subtasks) ? task.subtasks.slice(0, LIMITS.subtasks).map(sanitizeSubtask) : [],
    completed: task?.completed === true,
    googleEventId: nullableStr(task?.googleEventId, 256),
    syncWithGoogle: task?.syncWithGoogle === true,
    createdAt: str(task?.createdAt, 40) || new Date().toISOString(),
    labels: Array.isArray(task?.labels) ? task.labels.filter(label => COLOR_RE.test(label)).slice(0, LIMITS.labels) : [],
  };
}

// Dados vindos da nuvem podem ter sido escritos por outro membro do quadro
// (ou por uma versao antiga do app). Nunca confiar no formato.
export function sanitizeBoard(board) {
  const columns = Array.isArray(board?.columns) ? board.columns.slice(0, LIMITS.columns) : [];
  let taskBudget = LIMITS.tasks;
  return {
    title: str(board?.title, LIMITS.title) || 'Meu Quadro',
    columns: columns.map(column => {
      const tasks = Array.isArray(column?.tasks) ? column.tasks.slice(0, Math.max(0, taskBudget)) : [];
      taskBudget -= tasks.length;
      return {
        id: str(column?.id, 64) || generateId(),
        title: str(column?.title, LIMITS.title) || 'Categoria',
        color: COLOR_RE.test(column?.color) ? column.color : '#6366f1',
        tasks: tasks.map(sanitizeTask),
      };
    }),
  };
}

// ── Formato no Firestore ──
// Cada tarefa e cada coluna e um campo proprio de um mapa. Assim duas pessoas
// editando tarefas diferentes (ou o mesmo usuario no PC e no iPhone, ate
// offline) geram atualizacoes em caminhos diferentes e o Firestore combina
// as duas sem que uma apague a outra.
export function boardToDoc(board) {
  const clean = sanitizeBoard(board);
  const columns = {};
  const tasks = {};
  clean.columns.forEach((column, columnIndex) => {
    columns[column.id] = { title: column.title, color: column.color, order: columnIndex };
    column.tasks.forEach((task, taskIndex) => {
      const { id, ...rest } = task;
      tasks[id] = { ...rest, columnId: column.id, order: taskIndex };
    });
  });
  return { title: clean.title, columns, tasks };
}

export function docToBoard(doc) {
  const columnsMap = doc?.columns && typeof doc.columns === 'object' ? doc.columns : {};
  const tasksMap = doc?.tasks && typeof doc.tasks === 'object' ? doc.tasks : {};
  const byOrder = (a, b) => (Number(a[1]?.order) || 0) - (Number(b[1]?.order) || 0) || String(a[0]).localeCompare(String(b[0]));

  const columns = Object.entries(columnsMap).sort(byOrder).map(([id, column]) => ({
    id,
    title: column?.title,
    color: column?.color,
    tasks: [],
  }));
  const columnIndex = new Map(columns.map(column => [column.id, column]));

  Object.entries(tasksMap).sort(byOrder).forEach(([id, task]) => {
    const column = columnIndex.get(task?.columnId);
    if (column) column.tasks.push({ ...task, id });
  });

  return sanitizeBoard({ title: doc?.title, columns });
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export const same = (a, b) => stableStringify(a) === stableStringify(b);

// Retorna a lista de mudancas (por caminho de campo) que transforma `base` em
// `next`. Cada item: { path: [...segmentos], value } ou { path, delete: true }.
export function diffDocs(base, next) {
  const patches = [];
  const baseDoc = base || { title: '', columns: {}, tasks: {} };

  if (!same(baseDoc.title, next.title)) patches.push({ path: ['title'], value: next.title });

  for (const [section, fields] of [['columns', [...COLUMN_FIELDS, 'order']], ['tasks', [...TASK_FIELDS, 'columnId', 'order']]]) {
    const before = baseDoc[section] || {};
    const after = next[section] || {};
    for (const id of Object.keys(before)) {
      if (!(id in after)) patches.push({ path: [section, id], delete: true });
    }
    for (const [id, entry] of Object.entries(after)) {
      if (!(id in before)) {
        patches.push({ path: [section, id], value: entry });
        continue;
      }
      for (const field of fields) {
        if (!same(before[id][field], entry[field])) {
          patches.push({ path: [section, id, field], value: entry[field] ?? null });
        }
      }
    }
  }
  return patches;
}

export function applyPatches(doc, patches) {
  const result = JSON.parse(JSON.stringify(doc || { title: '', columns: {}, tasks: {} }));
  result.columns ||= {};
  result.tasks ||= {};
  for (const patch of patches) {
    const [section, id, field] = patch.path;
    if (patch.path.length === 1) {
      result[section] = patch.value;
    } else if (patch.path.length === 2) {
      if (patch.delete) delete result[section][id];
      else result[section][id] = JSON.parse(JSON.stringify(patch.value));
    } else if (result[section][id]) {
      // Campo de um item que o outro lado apagou: a exclusao vence.
      result[section][id][field] = JSON.parse(JSON.stringify(patch.value));
    }
  }
  return result;
}

// Mescla edicoes locais (feitas a partir de `base`) sobre a versao atual do
// servidor (`remote`).
export function rebase(base, local, remote) {
  return applyPatches(remote, diffDocs(base, local));
}
