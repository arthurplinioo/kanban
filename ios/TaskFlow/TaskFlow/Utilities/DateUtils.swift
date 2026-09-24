import Foundation

enum DateUtils {
    static func startOfDay(_ date: Date, calendar: Calendar = .current) -> Date {
        calendar.startOfDay(for: date)
    }

    static func daysInWeek(containing date: Date, calendar: Calendar = .current) -> [Date] {
        guard let weekInterval = calendar.dateInterval(of: .weekOfYear, for: date) else { return [date] }
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: weekInterval.start) }
    }

    static func weeksInMonth(containing date: Date, calendar: Calendar = .current) -> [[Date]] {
        guard let monthInterval = calendar.dateInterval(of: .month, for: date),
              let firstWeek = calendar.dateInterval(of: .weekOfYear, for: monthInterval.start) else { return [] }

        var weeks: [[Date]] = []
        var cursor = firstWeek.start
        while cursor < monthInterval.end {
            weeks.append(daysInWeek(containing: cursor, calendar: calendar))
            cursor = calendar.date(byAdding: .weekOfYear, value: 1, to: cursor) ?? monthInterval.end
        }
        return weeks
    }

    static func isSameDay(_ a: Date, _ b: Date, calendar: Calendar = .current) -> Bool {
        calendar.isDate(a, inSameDayAs: b)
    }
}
