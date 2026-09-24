import SwiftUI
import SwiftData

struct CalendarContainerView: View {
    @State private var viewModel = CalendarViewModel()
    @Query private var allTasks: [TaskItem]

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Picker("Modo", selection: $viewModel.mode) {
                    ForEach(CalendarViewMode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                HStack {
                    Button { viewModel.step(by: -1) } label: { Image(systemName: "chevron.left") }
                    Spacer()
                    Text(headerTitle).font(.headline)
                    Spacer()
                    Button { viewModel.step(by: 1) } label: { Image(systemName: "chevron.right") }
                }
                .padding(.horizontal)

                switch viewModel.mode {
                case .day:
                    DayView(date: viewModel.referenceDate, tasks: viewModel.tasks(for: viewModel.referenceDate, in: allTasks))
                case .week:
                    WeekView(referenceDate: viewModel.referenceDate, allTasks: allTasks, viewModel: viewModel)
                case .month:
                    MonthView(referenceDate: viewModel.referenceDate, allTasks: allTasks, viewModel: viewModel)
                }
            }
            .navigationTitle("Agenda")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Hoje") { viewModel.goToToday() }
                }
            }
        }
    }

    private var headerTitle: String {
        let formatter = DateFormatter()
        switch viewModel.mode {
        case .day: formatter.dateFormat = "d 'de' MMMM"
        case .week: formatter.dateFormat = "MMMM yyyy"
        case .month: formatter.dateFormat = "MMMM yyyy"
        }
        formatter.locale = Locale(identifier: "pt_BR")
        return formatter.string(from: viewModel.referenceDate).capitalized
    }
}
