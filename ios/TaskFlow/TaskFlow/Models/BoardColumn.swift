import Foundation
import SwiftData

/// Coluna personalizável do quadro Kanban (ex.: "A Fazer", "Em Progresso", "Concluído").
@Model
final class BoardColumn {
    @Attribute(.unique) var id: UUID
    var title: String
    var colorHex: String
    var order: Int
    var createdAt: Date

    @Relationship(deleteRule: .cascade, inverse: \TaskItem.column)
    var tasks: [TaskItem] = []

    init(title: String, colorHex: String = "#4C6FFF", order: Int = 0) {
        self.id = UUID()
        self.title = title
        self.colorHex = colorHex
        self.order = order
        self.createdAt = .now
    }

    static func defaultColumns() -> [BoardColumn] {
        [
            BoardColumn(title: "A Fazer", colorHex: "#8A94A6", order: 0),
            BoardColumn(title: "Em Progresso", colorHex: "#4C6FFF", order: 1),
            BoardColumn(title: "Concluído", colorHex: "#2ECC71", order: 2),
        ]
    }
}
