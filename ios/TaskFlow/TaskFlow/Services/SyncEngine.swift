import Foundation
import SwiftData
import BackgroundTasks
import Network

/// Orquestra a sincronização bidirecional entre o SwiftData local e o
/// Google Calendar.
///
/// Importante: "tempo real" aqui significa "assim que o app tem
/// conectividade e roda um ciclo de sync" — via pull-to-refresh, ao abrir
/// o app, e periodicamente em segundo plano (BGAppRefreshTask). O Google
/// Calendar não empurra eventos para dispositivos iOS diretamente; push
/// instantâneo de verdade exigiria um backend recebendo webhooks da
/// Calendar API "watch" e retransmitindo via APNs — ver README, seção
/// "Melhorias futuras".
@MainActor
final class SyncEngine: ObservableObject {
    static let shared = SyncEngine()

    @Published private(set) var isSyncing = false
    @Published private(set) var lastSyncedAt: Date?
    @Published private(set) var lastSyncError: String?

    private let monitor = NWPathMonitor()
    private(set) var isOnline = true
    private var syncToken: String?

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in self?.isOnline = path.status == .satisfied }
        }
        monitor.start(queue: DispatchQueue(label: "com.taskflow.network-monitor"))
    }

    func registerBackgroundTask() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Constants.backgroundTaskIdentifier, using: nil) { task in
            self.handleBackgroundRefresh(task: task as! BGAppRefreshTask)
        }
    }

    func scheduleBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Constants.backgroundTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: Constants.backgroundSyncInterval)
        try? BGTaskScheduler.shared.submit(request)
    }

    private func handleBackgroundRefresh(task: BGAppRefreshTask) {
        scheduleBackgroundRefresh() // reagenda o próximo ciclo
        let syncTask = Task {
            await sync(context: PersistenceController.shared.mainContext)
            task.setTaskCompleted(success: true)
        }
        task.expirationHandler = { syncTask.cancel() }
    }

    /// Executa um ciclo completo: envia mudanças pendentes locais, depois
    /// baixa mudanças remotas, resolvendo conflitos por "última escrita vence"
    /// com marcação explícita quando os dois lados mudaram.
    func sync(context: ModelContext) async {
        guard GoogleCalendarService.shared.isSignedIn, isOnline, !isSyncing else { return }
        isSyncing = true
        lastSyncError = nil
        defer { isSyncing = false }

        do {
            try await pushLocalChanges(context: context)
            try await pullRemoteChanges(context: context)
            lastSyncedAt = .now
        } catch {
            lastSyncError = error.localizedDescription
        }
    }

    private func pushLocalChanges(context: ModelContext) async throws {
        let descriptor = FetchDescriptor<TaskItem>()
        let allTasks = try context.fetch(descriptor)
        let pending = allTasks.filter { $0.syncStatus != .synced && $0.syncStatus != .conflict }

        for task in pending {
            switch task.syncStatus {
            case .pendingCreate:
                let remote = try await GoogleCalendarService.shared.createEvent(for: task)
                task.googleEventId = remote.id
                task.remoteUpdatedAt = remote.updatedAt
                task.syncStatus = .synced
                task.lastSyncedAt = .now

            case .pendingUpdate:
                guard let googleId = task.googleEventId else {
                    let remote = try await GoogleCalendarService.shared.createEvent(for: task)
                    task.googleEventId = remote.id
                    task.remoteUpdatedAt = remote.updatedAt
                    task.syncStatus = .synced
                    continue
                }
                let remote = try await GoogleCalendarService.shared.updateEvent(googleEventId: googleId, task: task)
                task.remoteUpdatedAt = remote.updatedAt
                task.syncStatus = .synced
                task.lastSyncedAt = .now

            case .pendingDelete:
                if let googleId = task.googleEventId {
                    try await GoogleCalendarService.shared.deleteEvent(googleEventId: googleId)
                }
                context.delete(task)

            case .synced, .conflict:
                continue
            }
        }
        try context.save()
    }

    private func pullRemoteChanges(context: ModelContext) async throws {
        let now = Date()
        let windowStart = Calendar.current.date(byAdding: .month, value: -1, to: now) ?? now
        let windowEnd = Calendar.current.date(byAdding: .month, value: 3, to: now) ?? now

        let (events, nextToken) = try await GoogleCalendarService.shared.listEvents(
            from: windowStart, to: windowEnd, syncToken: syncToken
        )
        syncToken = nextToken

        let descriptor = FetchDescriptor<TaskItem>()
        let allTasks = try context.fetch(descriptor)
        let byGoogleId = Dictionary(uniqueKeysWithValues: allTasks.compactMap { task -> (String, TaskItem)? in
            guard let id = task.googleEventId else { return nil }
            return (id, task)
        })

        let defaultColumn = try context.fetch(FetchDescriptor<BoardColumn>(sortBy: [.init(\.order)])).first

        for event in events {
            if let existing = byGoogleId[event.id] {
                if existing.syncStatus == .pendingUpdate || existing.syncStatus == .pendingCreate {
                    // Editado localmente E remotamente desde o último sync: conflito.
                    if let remoteUpdatedAt = existing.remoteUpdatedAt, event.updatedAt > remoteUpdatedAt {
                        existing.syncStatus = .conflict
                    }
                    continue
                }
                existing.title = event.title
                existing.detail = event.detail
                existing.dueDate = event.start
                existing.endDate = event.end
                existing.isAllDay = event.isAllDay
                existing.remoteUpdatedAt = event.updatedAt
                existing.syncStatus = .synced
            } else {
                let newTask = TaskItem(title: event.title, detail: event.detail, dueDate: event.start, column: defaultColumn)
                newTask.endDate = event.end
                newTask.isAllDay = event.isAllDay
                newTask.googleEventId = event.id
                newTask.remoteUpdatedAt = event.updatedAt
                newTask.syncStatus = .synced
                context.insert(newTask)
            }
        }
        try context.save()
    }

    /// Resolução manual de conflito: usuário escolhe qual versão mantém.
    func resolveConflict(_ task: TaskItem, keepLocal: Bool) {
        if keepLocal {
            task.syncStatus = .pendingUpdate
        } else {
            task.syncStatus = .synced // próximo pull vai sobrescrever com o remoto
        }
    }
}
