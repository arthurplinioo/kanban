// Testes das regras de seguranca do Firestore contra o emulador local.
// Rodar: npm run test:rules  (requer Java e firebase-tools)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';

const rules = readFileSync(fileURLToPath(new URL('../firestore.rules', import.meta.url)), 'utf8');
const env = await initializeTestEnvironment({
  projectId: 'demo-taskflow',
  firestore: { rules, host: '127.0.0.1', port: 8080 },
});

const user = (uid, email, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();

const alice = user('alice', 'alice@example.com');
const bob = user('bob', 'bob@example.com');
const mallory = user('mallory', 'mallory@example.com');
const unverified = user('eve', 'bob@example.com', false);
const anon = env.unauthenticatedContext().firestore();

const board = (extra) => ({
  title: 'Q', columns: { c1: { title: 'A', color: '#fff', order: 0 } }, tasks: {},
  updatedBy: 'alice@example.com', ...extra,
});
const personal = board({ type: 'personal', ownerUid: 'alice', ownerEmail: 'alice@example.com', memberEmails: ['alice@example.com'] });
const SHARED = 'shared_0123456789abcdef0123456789abcdef';
const shared = board({ type: 'shared', ownerUid: 'alice', ownerEmail: 'alice@example.com', memberEmails: ['alice@example.com'] });

let failures = 0;
async function check(name, promise) {
  try {
    await promise;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}\n       ${error.message.split('\n')[0]}`);
  }
}

console.log('quadro pessoal');
await check('dono le o proprio quadro pessoal antes de existir', assertSucceeds(getDoc(doc(alice, 'boards/personal_alice'))));
await check('ninguem le o quadro pessoal (inexistente) de outra pessoa', assertFails(getDoc(doc(mallory, 'boards/personal_alice'))));
await check('quadro compartilhado inexistente nao e legivel', assertFails(getDoc(doc(alice, 'boards/shared_99999999999999999999999999999999'))));
await check('dono cria o proprio quadro pessoal', assertSucceeds(setDoc(doc(alice, 'boards/personal_alice'), personal)));
await check('ninguem cria quadro pessoal com id de outra pessoa', assertFails(setDoc(doc(mallory, 'boards/personal_alice2'), { ...personal, ownerUid: 'mallory', ownerEmail: 'mallory@example.com', memberEmails: ['mallory@example.com'] })));
await check('quadro pessoal nao aceita membros extras', assertFails(setDoc(doc(bob, 'boards/personal_bob'), board({ type: 'personal', ownerUid: 'bob', ownerEmail: 'bob@example.com', memberEmails: ['bob@example.com', 'mallory@example.com'], updatedBy: 'bob@example.com' }))));
await check('dono le o proprio quadro', assertSucceeds(getDoc(doc(alice, 'boards/personal_alice'))));
await check('outro usuario NAO le quadro pessoal', assertFails(getDoc(doc(mallory, 'boards/personal_alice'))));
await check('visitante sem login NAO le nada', assertFails(getDoc(doc(anon, 'boards/personal_alice'))));
await check('dono edita tarefa', assertSucceeds(updateDoc(doc(alice, 'boards/personal_alice'), { 'tasks.t1': { title: 'x', columnId: 'c1', order: 0 }, updatedBy: 'alice@example.com' })));
await check('dono nao consegue compartilhar quadro pessoal', assertFails(updateDoc(doc(alice, 'boards/personal_alice'), { memberEmails: arrayUnion('bob@example.com') })));
await check('quadro pessoal nao pode ser apagado', assertFails(deleteDoc(doc(alice, 'boards/personal_alice'))));

console.log('quadro compartilhado');
await check('dono cria quadro compartilhado', assertSucceeds(setDoc(doc(alice, `boards/${SHARED}`), shared)));
await check('id curto/adivinhavel e recusado', assertFails(setDoc(doc(alice, 'boards/abc'), shared)));
await check('nao da pra criar quadro em nome de outra pessoa', assertFails(setDoc(doc(mallory, 'boards/shared_ffffffffffffffffffffffffffffffff'), shared)));
await check('nao convidado NAO le, mesmo sabendo o id (link)', assertFails(getDoc(doc(bob, `boards/${SHARED}`))));
await check('dono convida bob', assertSucceeds(updateDoc(doc(alice, `boards/${SHARED}`), { memberEmails: arrayUnion('bob@example.com'), updatedBy: 'alice@example.com' })));
await check('bob convidado le', assertSucceeds(getDoc(doc(bob, `boards/${SHARED}`))));
await check('conta com e-mail NAO verificado nao le', assertFails(getDoc(doc(unverified, `boards/${SHARED}`))));
await check('bob edita tarefas', assertSucceeds(updateDoc(doc(bob, `boards/${SHARED}`), { 'tasks.t9': { title: 'do bob', columnId: 'c1', order: 1 }, updatedBy: 'bob@example.com' })));
await check('bob nao pode se passar por outro em updatedBy', assertFails(updateDoc(doc(bob, `boards/${SHARED}`), { title: 'x', updatedBy: 'alice@example.com' })));
await check('bob NAO convida terceiros', assertFails(updateDoc(doc(bob, `boards/${SHARED}`), { memberEmails: arrayUnion('mallory@example.com'), updatedBy: 'bob@example.com' })));
await check('bob NAO remove a dona', assertFails(updateDoc(doc(bob, `boards/${SHARED}`), { memberEmails: arrayRemove('alice@example.com'), updatedBy: 'bob@example.com' })));
await check('bob NAO toma posse do quadro', assertFails(updateDoc(doc(bob, `boards/${SHARED}`), { ownerUid: 'bob', updatedBy: 'bob@example.com' })));
await check('bob NAO apaga o quadro', assertFails(deleteDoc(doc(bob, `boards/${SHARED}`))));
await check('campo desconhecido e recusado', assertFails(updateDoc(doc(bob, `boards/${SHARED}`), { evil: '<script>', updatedBy: 'bob@example.com' })));
await check('titulo gigante e recusado', assertFails(updateDoc(doc(bob, `boards/${SHARED}`), { title: 'x'.repeat(500), updatedBy: 'bob@example.com' })));
await check('apagar campos obrigatorios e recusado', assertFails(updateDoc(doc(bob, `boards/${SHARED}`), { tasks: deleteField(), updatedBy: 'bob@example.com' })));
await check('listagem so retorna quadros onde sou membro', assertSucceeds(getDocs(query(collection(bob, 'boards'), where('memberEmails', 'array-contains', 'bob@example.com')))));
await check('listagem de quadros alheios e recusada', assertFails(getDocs(query(collection(mallory, 'boards'), where('memberEmails', 'array-contains', 'bob@example.com')))));
await check('listar tudo e recusado', assertFails(getDocs(collection(mallory, 'boards'))));
await check('bob sai do quadro (remove a si mesmo)', assertSucceeds(updateDoc(doc(bob, `boards/${SHARED}`), { memberEmails: arrayRemove('bob@example.com'), updatedBy: 'bob@example.com' })));
await check('depois de sair, bob nao le mais', assertFails(getDoc(doc(bob, `boards/${SHARED}`))));
await check('dona apaga o quadro compartilhado', assertSucceeds(deleteDoc(doc(alice, `boards/${SHARED}`))));
await check('outras colecoes sao fechadas', assertFails(setDoc(doc(alice, 'users/alice'), { a: 1 })));

await env.cleanup();
console.log(failures ? `\n${failures} falha(s)` : '\ntodas as regras passaram');
process.exit(failures ? 1 : 0);
