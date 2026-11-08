# Ativar a sincronização em tempo real e os quadros compartilhados

O código já está pronto e testado contra o emulador do Firebase. Enquanto o
projeto Firebase não existir, o app continua sincronizando o "Meu Quadro" pelo
Google Drive, como antes. Quem cria o projeto é o dono da conta Google.

## 1. Criar o projeto (console do Firebase, logado como arthurplinioo@gmail.com)

1. https://console.firebase.google.com → **Adicionar projeto** → nome `taskflow-kanban` (Analytics: desativar).
2. **Authentication** → Começar → **Google** → Ativar → e-mail de suporte → Salvar.
3. **Authentication → Configurações → Domínios autorizados** → adicionar `arthurplinioo.github.io`.
4. **Firestore Database** → Criar banco → modo **produção** → local `southamerica-east1` (São Paulo).
5. **Firestore → Regras** → colar o conteúdo de `firestore.rules` deste repositório → Publicar.
6. **Configurações do projeto → Seus apps → Web (`</>`)** → registrar `TaskFlow` (sem Hosting) e copiar o `firebaseConfig`.

## 2. Ligar ao site (os dois repositórios)

```bash
for repo in arthurplinioo/kanban arthurplinioo/kanban-rosa; do
  gh variable set VITE_FIREBASE_API_KEY            --repo $repo --body "<apiKey>"
  gh variable set VITE_FIREBASE_AUTH_DOMAIN        --repo $repo --body "<authDomain>"
  gh variable set VITE_FIREBASE_PROJECT_ID         --repo $repo --body "<projectId>"
  gh variable set VITE_FIREBASE_APP_ID             --repo $repo --body "<appId>"
  gh variable set VITE_FIREBASE_MESSAGING_SENDER_ID --repo $repo --body "<messagingSenderId>"
  gh workflow run deploy.yml --repo $repo
done
```

A chave web do Firebase não é segredo (vai para o navegador de qualquer forma).
Quem protege os dados são as regras do Firestore.

## 3. Endurecer a chave (opcional, recomendado)

Google Cloud Console → APIs e serviços → Credenciais → chave "Browser key (auto
created by Firebase)" → Restrições de aplicativo: **Referenciadores HTTP** →
`https://arthurplinioo.github.io/*`.

## Testes

```bash
npm test            # regras de merge/sincronizacao
npm run test:rules  # regras de seguranca no emulador (requer Java + firebase-tools)
```
