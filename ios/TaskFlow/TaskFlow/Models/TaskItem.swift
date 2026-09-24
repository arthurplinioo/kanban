import Foundation
import SwiftData

enum RecurrenceRule: String, Codable, CaseIterable {
    case none, daily, weekly, monthly
}

@Model
final class TaskItem {
    @Attribute(.unique) var id: UUID
    var title: String
    var detail: String
    var dueDate: Date?
    var endDate: Date?
    var isAllDay: Bool
    var reminderMinutesBefore: Int?
    var recurrence: RecurrenceRule
    var isCompleted: Bool
    var order: Int
    var createdAt: Date
    var updatedAt: Date

    // --- Integração Google Calendar ---
    var googleEventId: String?
    var syncStatusRaw: String
    var lastSyncedAt: Date?
    /// snapshot do evento remoto no último sync bem-sucedido, usado para
    /// detectar conflitos (edição local + remota entre dois syncs)
    var remoteUpdatedAt: Date?

    var column: BoardColumn?

    @Relationship(deleteRule: .cascade, inverse: \Subtask.task)
    var subtasks: [Subtask] = []

    var syncStatus: SyncStatus {
        get { SyncStatus(rawValue: syncStatusRaw) ?? .pendingCreate }
        set { syncStatusRaw = newValue.rawValue }
    }

    init(
        title: String,
        detail: String = "",
        dueDate: Date? = nil,
        column: BoardColumn? = nil
    ) {
        self.id = UUID()
        self.title = title
        self.detail = detail
        self.dueDate = dueDate
        self.endDate = nil
        self.isAllDay = false
        self.reminderMinutesBefore = 30
        self.recurrence = .none
        self.isCompleted = false
        self.order = 0
        self.createdAt = .now
        self.updatedAt = .now
        self.googleEventId = nil
        self.syncStatusRaw = SyncStatus.pendingCreate.rawValue
        self.lastSyncedAt = nil
        self.remoteUpdatedAt = nil
        self.column = column
    }

    func markDirty() {
        updatedAt = .now
        if syncStatus == .synced {
            syncStatus = .pendingUpdate
        }
    }
}
