import Foundation
import SwiftData

/// Fonte única de verdade local. O app é offline-first: toda leitura/escrita
/// de UI passa pelo SwiftData primeiro; o Google Calendar é sincronizado
/// depois, em segundo plano, via SyncEngine.
@MainActor
enum PersistenceController {
    static let shared: ModelContainer = {
        let schema = Schema([TaskItem.self, BoardColumn.self, Subtask.self])
        let configuration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false,
            cloudKitDatabase: .none // sync é feito via Google Calendar, não CloudKit
        )

        do {
            let container = try ModelContainer(for: schema, configurations: [configuration])
            seedDefaultColumnsIfNeeded(in: container)
            return container
        } catch {
            fatalError("Não foi possível criar o ModelContainer: \(error)")
        }
    }()

    private static func seedDefaultColumnsIfNeeded(in container: ModelContainer) {
        let context = container.mainContext
        let descriptor = FetchDescriptor<BoardColumn>()
        guard let count = try? context.fetchCount(descriptor), count == 0 else { return }

        for column in BoardColumn.defaultColumns() {
            context.insert(column)
        }
        try? context.save()
    }
}
