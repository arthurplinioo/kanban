import SwiftUI

struct TaskDetailView: View {
    @Bindable var task: TaskItem
    @Environment(\.dismiss) private var dismiss
    @Environment(BoardViewModel.self) private var viewModel
    @State private var newSubtaskText = ""

    private var sortedSubtasks: [Subtask] {
        task.subtasks.sorted { $0.order < $1.order }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Detalhes") {
                    TextField("Título", text: $task.title)
                    TextField("Descrição", text: $task.detail, axis: .vertical)
                    Toggle("Concluída", isOn: Binding(
                        get: { task.isCompleted },
                        set: { _ in viewModel.toggleCompleted(task) }
                    ))
                }

                Section("Data e lembrete") {
                    Toggle("Dia inteiro", isOn: $task.isAllDay)
                    DatePicker("Vencimento", selection: Binding(
                        get: { task.dueDate ?? .now },
                        set: { task.dueDate = $0 }
                    ), displayedComponents: task.isAllDay ? [.date] : [.date, .hourAndMinute])

                    Picker("Lembrar", selection: Binding(
                        get: { task.reminderMinutesBefore ?? -1 },
                        set: { task.reminderMinutesBefore = $0 == -1 ? nil : $0 }
                    )) {
                        Text("Sem lembrete").tag(-1)
                        Text("10 min antes").tag(10)
                        Text("30 min antes").tag(30)
                        Text("1 hora antes").tag(60)
                        Text("1 dia antes").tag(1440)
                    }

                    Picker("Repetir", selection: $task.recurrence) {
                        ForEach(RecurrenceRule.allCases, id: \.self) { rule in
                            Text(label(for: rule)).tag(rule)
                        }
                    }
                }

                Section("Subtarefas") {
                    ForEach(sortedSubtasks) { subtask in
                        HStack {
                            Button {
                                viewModel.toggleSubtask(subtask)
                            } label: {
                                Image(systemName: subtask.isCompleted ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(subtask.isCompleted ? .green : .secondary)
                            }
                            Text(subtask.text).strikethrough(subtask.isCompleted)
                        }
                    }
                    .onDelete { offsets in
                        offsets.map { sortedSubtasks[$0] }.forEach(viewModel.deleteSubtask)
                    }

                    HStack {
                        TextField("Nova subtarefa…", text: $newSubtaskText)
                        Button("Adicionar") {
                            let trimmed = newSubtaskText.trimmingCharacters(in: .whitespaces)
                            guard !trimmed.isEmpty else { return }
                            viewModel.addSubtask(text: trimmed, to: task)
                            newSubtaskText = ""
                        }.disabled(newSubtaskText.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }

                if task.syncStatus == .conflict {
                    Section("Conflito de sincronização") {
                        Text("Este evento foi alterado tanto no app quanto no Google Agenda.")
                            .foregroundStyle(.secondary)
                        Button("Manter versão do app") { SyncEngine.shared.resolveConflict(task, keepLocal: true) }
                        Button("Usar versão do Google Agenda") { SyncEngine.shared.resolveConflict(task, keepLocal: false) }
                    }
                }

                Section {
                    Button("Excluir tarefa", role: .destructive) {
                        viewModel.delete(task)
                        dismiss()
                    }
                }
            }
            .navigationTitle("Tarefa")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Pronto") {
                        task.markDirty()
                        NotificationService.shared.scheduleReminder(for: task)
                        try? task.modelContext?.save()
                        dismiss()
                    }
                }
            }
        }
    }

    private func label(for rule: RecurrenceRule) -> String {
        switch rule {
        case .none: return "Não repete"
        case .daily: return "Diariamente"
        case .weekly: return "Semanalmente"
        case .monthly: return "Mensalmente"
        }
    }
}
