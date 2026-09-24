import SwiftUI

struct MonthView: View {
    let referenceDate: Date
    let allTasks: [TaskItem]
    let viewModel: CalendarViewModel

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

    var body: some View {
        let weeks = DateUtils.weeksInMonth(containing: referenceDate)
        ScrollView {
            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(weeks.flatMap { $0 }, id: \.self) { day in
                    let dayTasks = viewModel.tasks(for: day, in: allTasks)
                    VStack(spacing: 2) {
                        Text(day.formatted(.dateTime.day()))
                            .font(.caption2)
                            .foregroundStyle(inCurrentMonth(day) ? .primary : .tertiary)
                        if !dayTasks.isEmpty {
                            Circle().fill(Color.tfAccent).frame(width: 5, height: 5)
                        }
                    }
                    .frame(height: 40)
                    .frame(maxWidth: .infinity)
                    .background(DateUtils.isSameDay(day, .now) ? Color.tfAccent.opacity(0.15) : .clear, in: RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(.horizontal)
        }
    }

    private func inCurrentMonth(_ day: Date) -> Bool {
        Calendar.current.isDate(day, equalTo: referenceDate, toGranularity: .month)
    }
}
