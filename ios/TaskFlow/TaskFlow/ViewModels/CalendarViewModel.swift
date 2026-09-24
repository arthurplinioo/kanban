import Foundation

enum CalendarViewMode: String, CaseIterable {
    case day = "Dia", week = "Semana", month = "Mês"
}

@Observable
final class CalendarViewModel {
    var mode: CalendarViewMode = .week
    var referenceDate: Date = .now

    func tasks(for day: Date, in allTasks: [TaskItem]) -> [TaskItem] {
        allTasks
            .filter { task in
                guard let due = task.dueDate else { return false }
                return DateUtils.isSameDay(due, day)
            }
            .sorted { ($0.dueDate ?? .distantPast) < ($1.dueDate ?? .distantPast) }
    }

    func goToToday() { referenceDate = .now }

    func step(by value: Int) {
        let component: Calendar.Component = mode == .day ? .day : (mode == .week ? .weekOfYear : .month)
        referenceDate = Calendar.current.date(byAdding: component, value: value, to: referenceDate) ?? referenceDate
    }
}
