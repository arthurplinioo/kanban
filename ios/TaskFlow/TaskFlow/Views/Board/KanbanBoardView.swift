import SwiftUI
import SwiftData

struct KanbanBoardView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \BoardColumn.order) private var columns: [BoardColumn]
    @State private var viewModel: BoardViewModel?
    @State private var showingAddColumn = false
    @State private var selectedTask: TaskItem?

    var body: some View {
        NavigationStack {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 16) {
                    ForEach(columns) { column in
                        ColumnView(column: column, selectedTask: $selectedTask)
                            .environment(viewModel)
                    }
                    Button {
                        showingAddColumn = true
                    } label: {
                        Label("Nova coluna", systemImage: "plus")
                            .frame(width: 120)
                            .padding()
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16))
                    }
                }
                .padding(16)
            }
            .background(Color.tfBackground)
            .navigationTitle("TaskFlow")
            .onAppear { if viewModel == nil { viewModel = BoardViewModel(context: context) } }
            .sheet(isPresented: $showingAddColumn) {
                AddColumnSheet { title, color in
                    viewModel?.addColumn(title: title, colorHex: color, currentColumns: columns)
                }
            }
            .sheet(item: $selectedTask) { task in
                TaskDetailView(task: task)
            }
        }
    }
}

private struct AddColumnSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    let onAdd: (String, String) -> Void

    var body: some View {
        NavigationStack {
            Form {
                TextField("Nome da coluna", text: $title)
            }
            .navigationTitle("Nova coluna")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Adicionar") {
                        onAdd(title, "#4C6FFF")
                        dismiss()
                    }.disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
