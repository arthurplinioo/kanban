import Foundation
import SwiftData
import Observation

@Observable
final class BoardViewModel {
    var context: ModelContext

    init(context: ModelContext) {
        self.context = context
    }

    func addTask(title: String, to column: BoardColumn) {
        let task = TaskItem(title: title, column: column)
        task.order = (column.tasks.map(\.order).max() ?? -1) + 1
        context.insert(task)
        try? context.save()
    }

    func move(_ task: TaskItem, to column: BoardColumn) {
        guard task.column?.id != column.id else { return }
        task.column = column
        task.order = (column.tasks.map(\.order).max() ?? -1) + 1
        task.markDirty()
        try? context.save()
    }

    func delete(_ task: TaskItem) {
        if task.googleEventId != nil {
            // Não apaga na hora: marca para o SyncEngine remover no Google
            // Calendar também antes de sumir localmente.
            task.syncStatus = .pendingDelete
            try? context.save()
        } else {
            context.delete(task)
            try? context.save()
        }
    }

    func addColumn(title: String, colorHex: String, currentColumns: [BoardColumn]) {
        let column = BoardColumn(title: title, colorHex: colorHex, order: (currentColumns.map(\.order).max() ?? -1) + 1)
        context.insert(column)
        try? context.save()
    }

    func toggleCompleted(_ task: TaskItem) {
        task.isCompleted.toggle()
        task.markDirty()
        try? context.save()
        if task.isCompleted {
            NotificationService.shared.cancelReminder(for: task)
        } else {
            NotificationService.shared.scheduleReminder(for: task)
        }
    }

    // MARK: - Subtarefas

    func addSubtask(text: String, to task: TaskItem) {
        let subtask = Subtask(text: text, order: (task.subtasks.map(\.order).max() ?? -1) + 1)
        subtask.task = task
        context.insert(subtask)
        try? context.save()
    }

    func toggleSubtask(_ subtask: Subtask) {
        subtask.isCompleted.toggle()
        try? context.save()
    }

    func deleteSubtask(_ subtask: Subtask) {
        context.delete(subtask)
        try? context.save()
    }

    /// Move uma subtarefa de uma task para outra (arrastar e soltar em cima
    /// de outra task) — espelha `moveSubtaskToTask` do app desktop.
    func moveSubtask(_ subtask: Subtask, to targetTask: TaskItem) {
        guard subtask.task?.id != targetTask.id else { return }
        subtask.task = targetTask
        subtask.order = (targetTask.subtasks.map(\.order).max() ?? -1) + 1
        try? context.save()
    }

    /// "Promove" uma subtarefa a task independente numa coluna (soltar fora
    /// de qualquer card) — espelha `convertSubtaskToTask` do app desktop.
    func promoteSubtaskToTask(_ subtask: Subtask, in column: BoardColumn) {
        let newTask = TaskItem(title: subtask.text, column: column)
        newTask.isCompleted = subtask.isCompleted
        newTask.order = (column.tasks.map(\.order).max() ?? -1) + 1
        context.insert(newTask)
        context.delete(subtask)
        try? context.save()
    }

    func findSubtask(by id: UUID) -> Subtask? {
        try? context.fetch(FetchDescriptor<Subtask>(predicate: #Predicate { $0.id == id })).first
    }

    func findTask(by id: UUID) -> TaskItem? {
        try? context.fetch(FetchDescriptor<TaskItem>(predicate: #Predicate { $0.id == id })).first
    }
}
