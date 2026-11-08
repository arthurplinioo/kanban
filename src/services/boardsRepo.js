import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where,
  serverTimestamp, arrayUnion, arrayRemove, FieldPath, deleteField,
} from 'firebase/firestore';
import { getDb } from './firebase';
import { boardToDoc } from '../utils/boardModel';
import { generateId } from '../utils/idGenerator';

export const personalBoardId = uid => `personal_${uid}`;

export const normalizeEmail = email => String(email || '').trim().toLowerCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = email => EMAIL_RE.test(normalizeEmail(email));

function boardRef(boardId) {
  return doc(getDb(), 'boards', boardId);
}

export async function getBoardDoc(boardId) {
  const snapshot = await getDoc(boardRef(boardId));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function createPersonalBoard(user, board) {
  const email = normalizeEmail(user.email);
  await setDoc(boardRef(personalBoardId(user.uid)), {
    ...boardToDoc(board),
    type: 'personal',
    ownerUid: user.uid,
    ownerEmail: email,
    memberEmails: [email],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: email,
  });
}

export async function createSharedBoard(user, board) {
  const email = normalizeEmail(user.email);
  const boardId = `shared_${generateId().replace(/-/g, '')}`;
  await setDoc(boardRef(boardId), {
    ...boardToDoc(board),
    type: 'shared',
    ownerUid: user.uid,
    ownerEmail: email,
    memberEmails: [email],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: email,
  });
  return boardId;
}

export function subscribeBoard(boardId, onData, onError) {
  return onSnapshot(
    boardRef(boardId),
    // Metadados: saber quando o servidor confirmou (status "Sincronizado").
    { includeMetadataChanges: true },
    snapshot => onData(snapshot.exists() ? snapshot.data() : null, snapshot.metadata),
    onError,
  );
}

export function subscribeMyBoards(email, onData, onError) {
  const q = query(collection(getDb(), 'boards'), where('memberEmails', 'array-contains', normalizeEmail(email)));
  return onSnapshot(q, snapshot => {
    onData(snapshot.docs.map(d => ({
      id: d.id,
      title: d.data().title,
      type: d.data().type,
      ownerEmail: d.data().ownerEmail,
      memberEmails: d.data().memberEmails || [],
    })));
  }, onError);
}

// Envia apenas os campos alterados. Atualizacoes por campo funcionam offline
// (ficam na fila do Firestore) e nao sobrescrevem edicoes de outras pessoas
// em outras tarefas.
export function pushPatches(boardId, patches, email) {
  if (!patches.length) return Promise.resolve();
  const args = [];
  for (const patch of patches) {
    args.push(new FieldPath(...patch.path), patch.delete ? deleteField() : patch.value);
  }
  args.push(new FieldPath('updatedAt'), serverTimestamp(), new FieldPath('updatedBy'), normalizeEmail(email));
  const [firstPath, firstValue, ...rest] = args;
  return updateDoc(boardRef(boardId), firstPath, firstValue, ...rest);
}

export function inviteMember(boardId, email, actorEmail) {
  return updateDoc(boardRef(boardId), {
    memberEmails: arrayUnion(normalizeEmail(email)),
    updatedAt: serverTimestamp(),
    updatedBy: normalizeEmail(actorEmail),
  });
}

export function removeMember(boardId, email, actorEmail) {
  return updateDoc(boardRef(boardId), {
    memberEmails: arrayRemove(normalizeEmail(email)),
    updatedAt: serverTimestamp(),
    updatedBy: normalizeEmail(actorEmail),
  });
}

export function deleteSharedBoard(boardId) {
  return deleteDoc(boardRef(boardId));
}
