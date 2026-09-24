import SwiftUI
import SwiftData

struct ColumnView: View {
    @Environment(BoardViewModel.self) private var viewModel
    let column: BoardColumn
    @Binding var selectedTask: TaskItem?
    @State private var isTargeted = false
    @State private var newTaskTitle = ""

    private var sortedTasks: [TaskItem] {
        column.tasks.sorted { $0.order < $1.order }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Circle().fill(Color(hex: column.colorHex)).frame(width: 8, height: 8)
                Text(column.title).font(.headline)
                Spacer()
                Text("\(column.tasks.count)").font(.caption).foregroundStyle(.secondary)
            }

            ScrollView {
                VStack(spacing: 8) {
                    ForEach(sortedTasks) { task in
                        TaskCardView(task: task)
                            .onTapGesture { selectedTask = task }
                    }
                }
            }
        }
        .padding(12)
        .frame(width: 280)
        .background(isTargeted ? Color.tfAccent.opacity(0.12) : Color.tfSurface, in: RoundedRectangle(cornerRadius: 16))
        // Área da coluna: soltar uma TASK move ela para cá; soltar uma
        // SUBTASK aqui a "promove" a task independente nesta coluna
        // (paridade com convertSubtaskToTask() do app desktop).
        .dropDestination(for: DragPayload.self) { items, _ in
            guard let payload = items.first else { return false }
            switch payload.kind {
            case .task:
                guard let task = viewModel.findTask(by: payload.id) else { return false }
                viewModel.move(task, to: column)
            case .subtask:
                guard let subtask = viewModel.findSubtask(by: payload.id) else { return false }
                viewModel.promoteSubtaskToTask(subtask, in: column)
            }
            return true
        } isTargeted: { isTargeted = $0 }
        .safeAreaInset(edge: .bottom) {
            HStack {
                TextField("Adicionar tarefa…", text: $newTaskTitle)
                    .textFieldStyle(.roundedBorder)
                Button {
                    let trimmed = newTaskTitle.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty else { return }
                    viewModel.addTask(title: trimmed, to: column)
                    newTaskTitle = ""
                } label: {
                    Image(systemName: "plus.circle.fill")
                }
            }
            .padding(.horizontal, 12)
        }
    }
}
