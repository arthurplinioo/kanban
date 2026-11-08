import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { firebaseEnabled, watchAuth, signInWithGoogle, signOutFirebase, getDb } from '../services/firebase';
import {
  personalBoardId, normalizeEmail, isValidEmail, subscribeBoard, subscribeMyBoards, createPersonalBoard,
  createSharedBoard, pushPatches, inviteMember, removeMember, deleteSharedBoard,
} from '../services/boardsRepo';
import {
  boardToDoc, docToBoard, diffDocs, rebase, isPristineDefaultBoard, createEmptySharedBoard, sanitizeBoard,
  createDefaultBoard, same,
} from '../utils/boardModel';
import { storage } from '../services/storage';

const PUSH_DELAY_MS = 600;
const INVITE_HASH_RE = /^#\/b\/(shared_[a-f0-9]{32})$/;
const PENDING_INVITE_KEY = 'taskflow-pending-invite';

function readInviteFromUrl() {
  const match = window.location.hash.match(INVITE_HASH_RE);
  if (match) {
    sessionStorage.setItem(PENDING_INVITE_KEY, match[1]);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return sessionStorage.getItem(PENDING_INVITE_KEY);
}

export function buildInviteLink(boardId) {
  return `${window.location.origin}${window.location.pathname}#/b/${boardId}`;
}

function errorMessage(error) {
  const code = error?.code || '';
  if (code === 'permission-denied') return 'Sem permissao para este quadro.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
  if (code === 'auth/network-request-failed' || code === 'unavailable') return 'Sem conexao. As mudancas serao enviadas quando a internet voltar.';
  if (code === 'auth/unauthorized-domain') return 'Este endereco ainda nao foi autorizado no Firebase.';
  return 'Nao foi possivel sincronizar agora.';
}

/**
 * Sincronizacao em tempo real via Firestore.
 * - Sem login: o quadro pessoal fica so neste aparelho (como antes).
 * - Com login: "Meu Quadro" e o quadro inicial; quadros compartilhados
 *   aparecem na lista e atualizam ao vivo para todos os membros.
 */
export function useCloudBoards({ board, boardKey, replaceBoard, showToast }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!firebaseEnabled);
  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [activeMeta, setActiveMeta] = useState(null);
  const [status, setStatus] = useState(firebaseEnabled ? 'idle' : 'local');

  const boardRef = useRef(board);
  boardRef.current = board;
  const boardKeyRef = useRef(boardKey);
  boardKeyRef.current = boardKey;
  const syncRef = useRef({ boardId: null, base: null, dirty: false, ready: false });
  const lastAppliedRef = useRef(null);
  const pushTimerRef = useRef(null);
  const userRef = useRef(null);
  userRef.current = user;
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  const storageKeyFor = useCallback(
    (boardId) => (user && boardId === personalBoardId(user.uid) ? 'personal' : boardId),
    [user],
  );

  const persistSync = () => {
    const sync = syncRef.current;
    if (sync.boardId) storage.saveSyncState(sync.boardId, { base: sync.base, dirty: sync.dirty });
  };

  const applyBoard = useCallback((nextBoard, key) => {
    lastAppliedRef.current = JSON.stringify(nextBoard);
    // Atualiza as refs ja: um snapshot pode chegar antes do React renderizar,
    // e o merge precisa enxergar o quadro certo.
    boardRef.current = nextBoard;
    boardKeyRef.current = key;
    replaceBoard(nextBoard, key);
  }, [replaceBoard]);

  const pushNow = useCallback(() => {
    clearTimeout(pushTimerRef.current);
    const sync = syncRef.current;
    const currentUser = userRef.current;
    if (!sync.ready || !sync.dirty || !sync.boardId || !currentUser) return;
    const localDoc = boardToDoc(boardRef.current);
    const patches = diffDocs(sync.base, localDoc);
    sync.dirty = false;
    if (!patches.length) {
      persistSync();
      return;
    }
    sync.base = localDoc;
    persistSync();
    setStatus(navigator.onLine === false ? 'offline' : 'syncing');
    const targetId = sync.boardId;
    // Nao aguardamos: offline a promessa so resolve quando a internet volta,
    // mas o Firestore ja guardou a mudanca na fila local.
    pushPatches(targetId, patches, currentUser.email)
      .then(() => { if (syncRef.current.boardId === targetId && !syncRef.current.dirty) setStatus('synced'); })
      .catch(error => {
        setStatus('error');
        const message = errorMessage(error);
        if (message) toastRef.current?.(message, 'error');
      });
  }, []);

  // ── Login ──
  useEffect(() => {
    if (!firebaseEnabled) return undefined;
    readInviteFromUrl();
    const onHashChange = () => {
      const pending = readInviteFromUrl();
      if (pending && userRef.current) {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        setActiveBoardId(pending);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    const unsubscribe = watchAuth(nextUser => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setActiveBoardId(null);
        setBoards([]);
        setStatus('idle');
        return;
      }
      const pending = sessionStorage.getItem(PENDING_INVITE_KEY);
      sessionStorage.removeItem(PENDING_INVITE_KEY);
      setActiveBoardId(pending || personalBoardId(nextUser.uid));
    });
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      unsubscribe();
    };
  }, []);

  // ── Lista de quadros do usuario ──
  useEffect(() => {
    if (!user) return undefined;
    return subscribeMyBoards(user.email, setBoards, error => console.error('Lista de quadros:', error));
  }, [user]);

  // ── Quadro ativo: escuta mudancas ao vivo ──
  useEffect(() => {
    if (!user || !activeBoardId) return undefined;
    const boardId = activeBoardId;
    const isPersonal = boardId === personalBoardId(user.uid);
    const key = storageKeyFor(boardId);
    const saved = storage.loadSyncState(boardId);
    syncRef.current = { boardId, base: saved?.base || null, dirty: Boolean(saved?.dirty), ready: false };

    // Antes de ouvir a nuvem, o estado local TEM que ser a copia deste
    // quadro. Mesclar com o conteudo de outro quadro apagaria tarefas.
    if (boardKeyRef.current !== key) {
      const cached = storage.loadBoard(key);
      const localCopy = cached ? sanitizeBoard(cached) : (isPersonal ? createDefaultBoard() : null);
      if (localCopy) {
        applyBoard(localCopy, key);
      } else {
        syncRef.current.dirty = false;
        applyBoard({ title: 'Carregando...', columns: [] }, key);
      }
    }
    if (isPersonal && !saved && !isPristineDefaultBoard(boardRef.current)) {
      // Primeiro login neste aparelho: o que ja estava aqui e mesclado
      // (uniao) com a nuvem em vez de ser descartado.
      syncRef.current.dirty = true;
    }

    setStatus('syncing');
    let creating = false;
    const unsubscribe = subscribeBoard(boardId, async (data, metadata) => {
      const sync = syncRef.current;
      if (sync.boardId !== boardId) return;

      if (!data) {
        if (metadata.fromCache) return;
        if (isPersonal && !creating) {
          creating = true;
          try {
            await createPersonalBoard(user, boardRef.current);
          } catch (error) {
            setStatus('error');
            toastRef.current?.(errorMessage(error) || 'Erro ao criar quadro na nuvem', 'error');
          }
          return;
        }
        if (!isPersonal) {
          toastRef.current?.('Este quadro foi removido ou voce nao tem mais acesso.', 'error');
          setActiveBoardId(personalBoardId(user.uid));
        }
        return;
      }

      setActiveMeta({
        id: boardId,
        type: data.type,
        ownerEmail: data.ownerEmail,
        memberEmails: data.memberEmails || [],
        isOwner: data.ownerUid === user.uid,
      });

      const remoteDoc = { title: data.title, columns: data.columns || {}, tasks: data.tasks || {} };
      const nextStatus = metadata.hasPendingWrites ? 'syncing' : (metadata.fromCache ? 'offline' : 'synced');
      // Mudanca so de metadados (ex.: servidor confirmou nossa escrita).
      if (sync.ready && !sync.dirty && same(remoteDoc, sync.base)) {
        setStatus(nextStatus);
        return;
      }
      const localNow = boardToDoc(boardRef.current);
      const localChanged = sync.dirty || (sync.ready && JSON.stringify(boardRef.current) !== lastAppliedRef.current);

      if (localChanged) {
        const merged = rebase(sync.base, localNow, remoteDoc);
        sync.base = remoteDoc;
        sync.dirty = true;
        sync.ready = true;
        applyBoard(docToBoard(merged), key);
        persistSync();
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(pushNow, PUSH_DELAY_MS);
      } else {
        sync.base = remoteDoc;
        sync.ready = true;
        applyBoard(docToBoard(remoteDoc), key);
        persistSync();
        setStatus(nextStatus);
      }
    }, error => {
      setStatus('error');
      if (error?.code === 'permission-denied' && !isPersonal) {
        toastRef.current?.('Voce nao tem acesso a este quadro. Peca ao dono para convidar o seu e-mail.', 'error');
        setActiveBoardId(personalBoardId(user.uid));
      } else {
        const message = errorMessage(error);
        if (message) toastRef.current?.(message, 'error');
      }
    });

    return () => {
      pushNow();
      unsubscribe();
    };
  }, [user, activeBoardId, applyBoard, pushNow, storageKeyFor]);

  // ── Edicoes locais → envio com atraso curto ──
  useEffect(() => {
    const sync = syncRef.current;
    if (!user || !sync.ready) return;
    if (JSON.stringify(board) === lastAppliedRef.current) return;
    sync.dirty = true;
    persistSync();
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(pushNow, PUSH_DELAY_MS);
  }, [board, user, pushNow]);

  // Fechar/ocultar o app (comum no iPhone) envia o que estiver pendente.
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') pushNow(); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', pushNow);
    const onOnline = () => setStatus(s => (s === 'offline' ? 'syncing' : s));
    const onOffline = () => setStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', pushNow);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [pushNow]);

  // ── Acoes ──
  const signIn = useCallback(async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      const message = errorMessage(error);
      if (message) toastRef.current?.(message, 'error');
    }
  }, []);

  const signOut = useCallback(async () => {
    pushNow();
    await signOutFirebase();
    // Aparelho compartilhado: nao deixar copia dos quadros para o proximo usuario.
    storage.clearAllForSignOut();
    try {
      await terminate(getDb());
      await clearIndexedDbPersistence(getDb());
    } catch (error) {
      console.warn('Cache local nao pode ser limpo:', error);
    }
    window.location.reload();
  }, [pushNow]);

  const selectBoard = useCallback((boardId) => {
    if (boardId && boardId !== syncRef.current.boardId) setActiveBoardId(boardId);
  }, []);

  const createBoard = useCallback(async (title) => {
    if (!user) return null;
    try {
      const boardId = await createSharedBoard(user, createEmptySharedBoard(title));
      setActiveBoardId(boardId);
      toastRef.current?.('Quadro compartilhado criado');
      return boardId;
    } catch (error) {
      toastRef.current?.(errorMessage(error) || 'Erro ao criar quadro', 'error');
      return null;
    }
  }, [user]);

  const invite = useCallback(async (email) => {
    const clean = normalizeEmail(email);
    if (!isValidEmail(clean)) throw new Error('E-mail invalido');
    if (!activeMeta?.isOwner || activeMeta.type !== 'shared') throw new Error('Somente o dono pode convidar');
    if (activeMeta.memberEmails.length >= 50) throw new Error('Limite de 50 pessoas por quadro');
    await inviteMember(activeMeta.id, clean, user.email);
    return clean;
  }, [activeMeta, user]);

  const removePerson = useCallback(async (email) => {
    if (!activeMeta) return;
    await removeMember(activeMeta.id, email, user.email);
    if (normalizeEmail(email) === normalizeEmail(user.email)) {
      toastRef.current?.('Voce saiu do quadro');
      setActiveBoardId(personalBoardId(user.uid));
    }
  }, [activeMeta, user]);

  const deleteBoard = useCallback(async () => {
    if (!activeMeta?.isOwner || activeMeta.type !== 'shared') return;
    const boardId = activeMeta.id;
    setActiveBoardId(personalBoardId(user.uid));
    await deleteSharedBoard(boardId);
    storage.saveSyncState(boardId, null);
    storage.saveBoard(null, boardId);
    toastRef.current?.('Quadro excluido');
  }, [activeMeta, user]);

  const boardList = useMemo(() => {
    if (!user) return [];
    const personalId = personalBoardId(user.uid);
    const shared = boards.filter(b => b.id !== personalId && b.type === 'shared')
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));
    return [{ id: personalId, title: 'Meu Quadro', type: 'personal' }, ...shared];
  }, [boards, user]);

  const isPersonal = !user || !activeBoardId || activeBoardId === personalBoardId(user.uid);

  return {
    enabled: firebaseEnabled,
    authReady,
    user,
    status,
    boards: boardList,
    activeBoardId,
    activeMeta: isPersonal ? null : activeMeta,
    isPersonal,
    signIn,
    signOut,
    selectBoard,
    createBoard,
    invite,
    removePerson,
    deleteBoard,
  };
}
