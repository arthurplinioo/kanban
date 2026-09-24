# TaskFlow iOS (SwiftUI)

Reescrita nativa do TaskFlow para iPhone. Não reaproveita o código do app
Electron/React em `taskflow-kanban/` (aquele continua existindo como app
desktop separado) — este é um projeto Xcode independente.

## 1. Estrutura de pastas

```
TaskFlow/
├── TaskFlow.xcodeproj/            ← criar no Xcode (ver seção 3)
└── TaskFlow/
    ├── TaskFlowApp.swift          # entry point, AppDelegate, configuração GIDSignIn
    ├── Info.plist
    ├── TaskFlow.entitlements
    ├── Models/
    │   ├── TaskItem.swift         # @Model SwiftData: tarefa/evento
    │   ├── BoardColumn.swift      # @Model SwiftData: coluna do Kanban
    │   ├── Subtask.swift          # @Model SwiftData: subtarefa de uma TaskItem
    │   └── SyncStatus.swift       # enum de estado de sincronização
    ├── Persistence/
    │   └── PersistenceController.swift   # ModelContainer + seed inicial
    ├── Services/
    │   ├── GoogleCalendarService.swift   # OAuth + REST Calendar API v3
    │   ├── SyncEngine.swift              # sync bidirecional + fila offline + BGTask
    │   └── NotificationService.swift     # lembretes locais (UNUserNotificationCenter)
    ├── ViewModels/
    │   ├── BoardViewModel.swift
    │   └── CalendarViewModel.swift
    ├── Views/
    │   ├── RootTabView.swift
    │   ├── Board/
    │   │   ├── KanbanBoardView.swift
    │   │   ├── ColumnView.swift
    │   │   ├── TaskCardView.swift
    │   │   └── TaskDetailView.swift
    │   ├── Calendar/
    │   │   ├── CalendarContainerView.swift
    │   │   ├── DayView.swift
    │   │   ├── WeekView.swift
    │   │   └── MonthView.swift
    │   └── Settings/
    │       ├── SettingsView.swift
    │       └── GoogleSignInButton.swift
    ├── Utilities/
    │   ├── DateUtils.swift
    │   ├── Constants.swift
    │   ├── Color+Theme.swift
    │   └── DragPayload.swift      # payload Transferable para o drag-and-drop nativo
    └── Resources/
        └── Assets.xcassets        # ícones, cores (criar no Xcode)
```

Todo o código-fonte já foi gerado nessa árvore, dentro de
`taskflow-kanban/ios/TaskFlow/`. Falta apenas criar o projeto Xcode em volta
dele (passo 3) — arquivos `.swift` fora de um `.xcodeproj` não compilam sozinhos.

## 2. Arquitetura, em uma frase por camada

- **Models** (SwiftData `@Model`): fonte única de verdade local, offline-first.
- **Persistence**: um `ModelContainer` único injetado na `WindowGroup`.
- **Services**: `GoogleCalendarService` fala HTTP puro com a Calendar API v3;
  `SyncEngine` decide o que enviar/receber e resolve conflitos; `NotificationService`
  agenda lembretes locais.
- **ViewModels** (`@Observable`): lógica de tela, sem tocar em UIKit/SwiftUI diretamente.
- **Views**: só SwiftUI declarativo, lêem dados via `@Query`/`@Bindable`.

## 3. Criar o projeto Xcode

1. Abra o Xcode → **File → New → Project → iOS → App**.
2. Nome do produto: `TaskFlow`. Interface: **SwiftUI**. Linguagem: **Swift**.
   Marque **Use SwiftData** (nos storage options), Minimum Deployment: **iOS 17**
   (SwiftData e `@Observable` exigem iOS 17+; se precisar suportar iOS 16,
   troque SwiftData por Core Data e `@Observable` por `ObservableObject` — me avise se quiser essa variante).
3. Salve o projeto dentro de `taskflow-kanban/ios/TaskFlow/` **substituindo**
   os arquivos-modelo padrão do Xcode pelos arquivos já escritos nesta pasta
   (arraste as pastas `Models/`, `Services/`, `Views/` etc. para dentro do
   grupo do projeto no Xcode, com "Copy items if needed" **desmarcado**,
   já que os arquivos já estão no lugar certo).
4. Delete o `ContentView.swift` e `Item.swift` gerados automaticamente pelo Xcode
   (foram substituídos por `RootTabView.swift` e pelos models próprios).

## 4. Configurar a API do Google Calendar

### 4.1 Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) e crie
   (ou selecione) um projeto.
2. **APIs & Services → Library** → busque "Google Calendar API" → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - Tipo de usuário: External (ou Internal, se for Google Workspace).
   - Preencha nome do app, e-mail de suporte, domínio (se tiver).
   - Em Scopes, adicione `.../auth/calendar.events`.
   - Em modo de teste, adicione seu e-mail (`arthurplinioo@gmail.com`) como test user.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **iOS**.
   - Bundle ID: o mesmo que você definiu no Xcode (ex.: `com.taskflow.app`).
   - Isso gera um Client ID e permite baixar um `GoogleService-Info.plist`.
5. Baixe o `GoogleService-Info.plist` e arraste-o para dentro do projeto Xcode
   (grupo `TaskFlow/`, "Copy items if needed" marcado).

### 4.2 Instalar o SDK

Via Swift Package Manager (Xcode → **File → Add Package Dependencies**):

```
https://github.com/google/GoogleSignIn-iOS
```

Adicione o produto `GoogleSignIn` ao target `TaskFlow`.

### 4.3 Ligar o Client ID ao app

- Abra `Utilities/Constants.swift` e troque `googleOAuthClientID` pelo
  `CLIENT_ID` real (também disponível dentro do `GoogleService-Info.plist`, chave `CLIENT_ID`).
- Abra `Info.plist` e troque `REVERSED_CLIENT_ID_AQUI` pelo valor da chave
  `REVERSED_CLIENT_ID` do mesmo `GoogleService-Info.plist`.
- **Não commite** o `GoogleService-Info.plist` real nem o Client ID em um
  repositório público — adicione ao `.gitignore` e trate como segredo.

## 5. Permissões e capabilities no Xcode

Em **Target TaskFlow → Signing & Capabilities**:

1. **+ Capability → Background Modes** → marque:
   - `Background fetch`
   - `Background processing`
2. **+ Capability → Push Notifications** (só é necessária se você implementar
   push remoto de verdade no futuro — ver seção 7; para os lembretes locais
   do app atual, `UNUserNotificationCenter` funciona sem isso).
3. Permissão de notificações é pedida em runtime pelo próprio app
   (`NotificationService.requestAuthorization()`, chamado a partir de
   `SettingsView`) — não precisa de texto extra no `Info.plist` para isso
   no iOS moderno, mas confirme que `NSUserNotificationsUsageDescription`
   não é necessário (é só para macOS legado).

## 6. Rodando o app

1. Selecione um simulador ou dispositivo físico iOS 17+.
2. `Cmd+R`.
3. Vá em **Ajustes** dentro do app → **Entrar com o Google** → conceda acesso
   ao Calendar → o `SyncEngine` roda um primeiro sync automaticamente.
4. Teste offline: ative o modo avião, crie/edite tarefas — elas ficam com
   ícone de "pendente de sync" no cartão; ao reconectar, abra o app ou
   puxe para atualizar para forçar sincronização imediata (ou aguarde o
   ciclo em segundo plano).

## 7. Limitação importante sobre "tempo real"

O app sincroniza sempre que: (a) é aberto, (b) o usuário força sync manual, ou
(c) o `BGAppRefreshTask` dispara em segundo plano (o iOS decide o intervalo
real, `Constants.backgroundSyncInterval` é só um pedido mínimo). Isso **não**
é um push instantâneo — se alguém editar um evento pelo Google Agenda web
agora, o iPhone só vai saber no próximo ciclo de sync.

Push instantâneo de verdade exige um backend (fora do escopo de um app
puramente cliente): ele se inscreve nos webhooks da Calendar API
(`events.watch`), recebe a notificação do Google quando algo muda, e
retransmite para o iPhone via APNs. Está detalhado como melhoria futura abaixo.

## 8. Arrastar e soltar (mobile + desktop)

O requisito de arrastar tarefas *e subtarefas* entre colunas/tarefas já está
coberto nos dois apps deste repositório, cada um com a API nativa da sua
plataforma:

- **iOS** (`ios/TaskFlow/`): `.draggable` / `.dropDestination` do SwiftUI
  (`Utilities/DragPayload.swift`, usado em `TaskCardView.swift` e
  `ColumnView.swift`). Funciona em iPhone (toque e segure para arrastar) e
  iPad, sem código extra por tamanho de tela.
  - Arrastar uma **task**: solta em outra coluna → move a task.
  - Arrastar uma **subtask**: solta em cima de outra task → vira subtarefa
    dela; solta na área vazia de uma coluna → "promovida" a task independente.
- **Desktop** (`taskflow-kanban/src/`, app Electron/React já existente):
  `@dnd-kit` (`components/Board/DraggableSubtask.jsx` +
  `moveSubtaskToTask`/`convertSubtaskToTask` em `hooks/useBoard.js`), mesmo
  comportamento (mover subtask entre tasks, promover subtask a task).

Os dois lados implementam a mesma regra de negócio de forma independente —
não há código compartilhado entre o app SwiftUI e o Electron/React, cada
plataforma usa o mecanismo de D&D nativo dela.

## 9. Sugestões de melhorias futuras

Em ordem aproximada de custo/benefício:

1. **Drag-and-drop mais rico no Kanban**: reordenar tarefas *dentro* da
   mesma coluna (hoje `ColumnView` só trata mover entre colunas), com
   `onMove`/índice de drop calculado pela posição do dedo.
2. **Widgets (WidgetKit)**: widget de tela de bloqueio/Home Screen mostrando
   as próximas 3 tarefas do dia — reaproveita direto os models SwiftData
   via App Group compartilhado.
3. **Siri Shortcuts / App Intents**: "Ei Siri, adicione uma tarefa no
   TaskFlow" e "o que tenho hoje no TaskFlow" via `AppIntent`, expondo
   `BoardViewModel.addTask` e `CalendarViewModel.tasks(for:)`.
4. **Push real via backend leve**: uma Cloud Function (Firebase) ou serviço
   pequeno que chama `events.watch` da Calendar API em nome do usuário,
   recebe o webhook do Google quando algo muda, e dispara um push silencioso
   (`content-available`) via APNs para acordar o `SyncEngine` na hora — resolve
   a limitação da seção 7.
5. **Apple Sign-In como alternativa** ao Google, para quem não quer conceder
   acesso à Agenda mas ainda quer usar o Kanban puramente local.
6. **Compartilhamento de quadros** entre usuários (ex.: via CloudKit
   compartilhado), para casais/times pequenos organizarem tarefas juntos.
7. **Attachments e subtarefas**: o modelo `TaskItem` já tem espaço para
   crescer — adicionar checklist de subtarefas e anexos de foto/PDF.
8. **Modo Mac Catalyst**: como já é SwiftUI puro, rodar o mesmo código como
   app de Mac é um passo pequeno, unificando com a versão desktop atual em Electron.
9. **Testes automatizados**: hoje não há testes; priorizar unit tests em
   `SyncEngine` (lógica de conflito é a parte mais arriscada) com um
   `GoogleCalendarService` mockável via protocolo.
10. **Analytics de uso opt-in** para entender quais visões (dia/semana/mês/kanban)
    são mais usadas e guiar prioridades de polimento de UI.
