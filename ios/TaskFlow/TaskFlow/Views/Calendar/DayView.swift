import SwiftUI

struct DayView: View {
    let date: Date
    let tasks: [TaskItem]

    var body: some View {
        List {
            if tasks.isEmpty {
                Text("Nenhuma tarefa para este dia").foregroundStyle(.secondary)
            }
            ForEach(tasks) { task in
                HStack {
                    if let due = task.dueDate, !task.isAllDay {
                        Text(due.formatted(date: .omitted, time: .shortened))
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                            .frame(width: 56, alignment: .leading)
                    }
                    Text(task.title).strikethrough(task.isCompleted)
                }
            }
        }
        .listStyle(.plain)
    }
}
