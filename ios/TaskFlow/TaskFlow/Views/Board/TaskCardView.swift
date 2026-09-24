import SwiftUI

struct TaskCardView: View {
    @Environment(BoardViewModel.self) private var viewModel
    let task: TaskItem
    @State private var isTargeted = false

    private var sortedSubtasks: [Subtask] {
        task.subtasks.sorted { $0.order < $1.order }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(task.title)
                    .font(.subheadline.weight(.medium))
                    .strikethrough(task.isCompleted)
                    .lineLimit(2)
                Spacer()
                syncIcon
            }

            if let dueDate = task.dueDate {
                Label(dueDate.formatted(date: .abbreviated, time: task.isAllDay ? .omitted : .shortened), systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if !sortedSubtasks.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(sortedSubtasks) { subtask in
                        SubtaskRowView(subtask: subtask)
                    }
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(isTargeted ? Color.tfAccent.opacity(0.15) : Color(.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
        // Arrastar o card inteiro para outra coluna.
        .draggable(DragPayload(kind: .task, id: task.id, parentTaskId: nil))
        // Soltar uma subtarefa (de outra task) aqui a move para esta task —
        // paridade com moveSubtaskToTask() do app desktop.
        .dropDestination(for: DragPayload.self) { items, _ in
            guard let payload = items.first, payload.kind == .subtask,
                  let subtask = viewModel.findSubtask(by: payload.id) else { return false }
            viewModel.moveSubtask(subtask, to: task)
            return true
        } isTargeted: { isTargeted = $0 }
    }

    @ViewBuilder
    private var syncIcon: some View {
        switch task.syncStatus {
        case .synced:
            EmptyView()
        case .pendingCreate, .pendingUpdate, .pendingDelete:
            Image(systemName: "arrow.triangle.2.circlepath").font(.caption2).foregroundStyle(.orange)
        case .conflict:
            Image(systemName: "exclamationmark.triangle.fill").font(.caption2).foregroundStyle(.red)
        }
    }
}

private struct SubtaskRowView: View {
    @Environment(BoardViewModel.self) private var viewModel
    let subtask: Subtask

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: subtask.isCompleted ? "checkmark.circle.fill" : "circle")
                .font(.caption)
                .foregroundStyle(subtask.isCompleted ? .green : .secondary)
                .onTapGesture { viewModel.toggleSubtask(subtask) }

            Text(subtask.text)
                .font(.caption)
                .strikethrough(subtask.isCompleted)
                .lineLimit(1)

            Spacer()

            Image(systemName: "line.3.horizontal")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        // Arrastar a subtarefa: solta em outro card = vira subtarefa dele;
        // solta na área vazia de uma coluna = vira task própria.
        .draggable(DragPayload(kind: .subtask, id: subtask.id, parentTaskId: subtask.task?.id))
    }
}
