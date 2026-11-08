import { describe, it, expect } from 'vitest';
import {
  boardToDoc, docToBoard, diffDocs, applyPatches, rebase, sanitizeBoard,
  createDefaultBoard, isPristineDefaultBoard, same,
} from './boardModel';

function board(columns) {
  return {
    title: 'Q',
    columns: columns.map(([id, tasks]) => ({
      id, title: id, color: '#6366f1',
      tasks: tasks.map(task => (typeof task === 'string' ? { id: task, title: task, createdAt: '2026-01-01' } : { createdAt: '2026-01-01', ...task })),
    })),
  };
}

describe('boardToDoc / docToBoard', () => {
  it('round-trips order, columns and tasks', () => {
    const original = sanitizeBoard(board([['c1', ['a', 'b']], ['c2', ['c']]]));
    expect(docToBoard(boardToDoc(original))).toEqual(original);
  });

  it('drops tasks pointing at a missing column instead of crashing', () => {
    const doc = boardToDoc(board([['c1', ['a']]]));
    doc.tasks.ghost = { title: 'x', columnId: 'nope', order: 0 };
    expect(docToBoard(doc).columns[0].tasks.map(t => t.id)).toEqual(['a']);
  });
});

describe('sanitizeBoard', () => {
  it('rejects hostile values from other members', () => {
    const clean = sanitizeBoard({
      title: 'x'.repeat(10000),
      columns: [{ id: 'c', title: 5, color: 'red;background:url(evil)', tasks: [{ id: 't', title: {}, priority: 'boom', labels: ['javascript:1', '#fff'], reminderMinutes: -5 }] }],
    });
    expect(clean.title.length).toBe(120);
    expect(clean.columns[0].color).toBe('#6366f1');
    expect(clean.columns[0].title).toBe('Categoria');
    const task = clean.columns[0].tasks[0];
    expect(task.title).toBe('Sem titulo');
    expect(task.priority).toBeNull();
    expect(task.labels).toEqual(['#fff']);
    expect(task.reminderMinutes).toBe(30);
  });
});

describe('diff + rebase (concurrent editing)', () => {
  it('produces no patches for an unchanged board, even with reordered keys', () => {
    const doc = boardToDoc(board([['c1', [{ id: 'a', title: 'a', subtasks: [{ id: 's', text: 't', completed: false }] }]]]));
    const shuffled = JSON.parse(JSON.stringify(doc));
    shuffled.tasks.a.subtasks = [{ completed: false, text: 't', id: 's' }];
    expect(diffDocs(doc, shuffled)).toEqual([]);
    expect(same({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('keeps both edits when two devices change different tasks', () => {
    const base = boardToDoc(board([['c1', ['a', 'b']]]));
    const pc = JSON.parse(JSON.stringify(base));
    pc.tasks.a.title = 'editado no PC';
    const iphone = JSON.parse(JSON.stringify(base));
    iphone.tasks.b.completed = true;

    const merged = docToBoard(rebase(base, iphone, pc));
    const tasks = merged.columns[0].tasks;
    expect(tasks.find(t => t.id === 'a').title).toBe('editado no PC');
    expect(tasks.find(t => t.id === 'b').completed).toBe(true);
  });

  it('keeps tasks added on both sides', () => {
    const base = boardToDoc(board([['c1', ['a']]]));
    const left = boardToDoc(board([['c1', ['a', 'x']]]));
    const right = boardToDoc(board([['c1', ['a', 'y']]]));
    const ids = docToBoard(rebase(base, left, right)).columns[0].tasks.map(t => t.id).sort();
    expect(ids).toEqual(['a', 'x', 'y']);
  });

  it('a delete wins over a concurrent field edit', () => {
    const base = boardToDoc(board([['c1', ['a']]]));
    const deleter = boardToDoc(board([['c1', []]]));
    const editor = JSON.parse(JSON.stringify(base));
    editor.tasks.a.title = 'tarde demais';
    expect(docToBoard(rebase(base, editor, deleter)).columns[0].tasks).toEqual([]);
  });

  it('moving a task between columns is a field update, not delete+add', () => {
    const base = boardToDoc(board([['c1', ['a']], ['c2', []]]));
    const moved = boardToDoc(board([['c1', []], ['c2', ['a']]]));
    const patches = diffDocs(base, moved);
    expect(patches).toEqual([{ path: ['tasks', 'a', 'columnId'], value: 'c2' }]);
    expect(docToBoard(applyPatches(base, patches)).columns[1].tasks[0].id).toBe('a');
  });

  it('first sync with no base unions local and remote', () => {
    const local = boardToDoc(board([['c1', ['mine']]]));
    const remote = boardToDoc(board([['c1', ['theirs']]]));
    const ids = docToBoard(rebase(null, local, remote)).columns[0].tasks.map(t => t.id).sort();
    expect(ids).toEqual(['mine', 'theirs']);
  });
});

describe('isPristineDefaultBoard', () => {
  it('detects the untouched welcome board only', () => {
    const fresh = createDefaultBoard();
    expect(isPristineDefaultBoard(fresh)).toBe(true);
    fresh.columns[1].tasks.push({ id: 'n', title: 'nova' });
    expect(isPristineDefaultBoard(fresh)).toBe(false);
  });
});
