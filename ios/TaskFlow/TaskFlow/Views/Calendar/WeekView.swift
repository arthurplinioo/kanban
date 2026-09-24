import SwiftUI

struct WeekView: View {
    let referenceDate: Date
    let allTasks: [TaskItem]
    let viewModel: CalendarViewModel

    var body: some View {
        let days = DateUtils.daysInWeek(containing: referenceDate)
        ScrollView {
            VStack(spacing: 0) {
                ForEach(days, id: \.self) { day in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(day.formatted(.dateTime.weekday(.abbreviated).day()))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(DateUtils.isSameDay(day, .now) ? Color.tfAccent : .secondary)

                        let dayTasks = viewModel.tasks(for: day, in: allTasks)
                        if dayTasks.isEmpty {
                            Text("—").font(.caption2).foregroundStyle(.tertiary)
                        } else {
                            ForEach(dayTasks) { task in
                                Text(task.title)
                                    .font(.caption)
                                    .lineLimit(1)
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(Color.tfAccent.opacity(0.15), in: Capsule())
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
                    Divider()
                }
            }
        }
    }
}
