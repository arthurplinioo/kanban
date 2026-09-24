import SwiftUI

struct RootTabView: View {
    var body: some View {
        TabView {
            KanbanBoardView()
                .tabItem { Label("Quadro", systemImage: "square.grid.3x3") }

            CalendarContainerView()
                .tabItem { Label("Agenda", systemImage: "calendar") }

            SettingsView()
                .tabItem { Label("Ajustes", systemImage: "gearshape") }
        }
        .tint(.tfAccent)
    }
}
