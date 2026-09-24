import Foundation
import SwiftData

@Model
final class Subtask {
    @Attribute(.unique) var id: UUID
    var text: String
    var isCompleted: Bool
    var order: Int

    var task: TaskItem?

    init(text: String, order: Int = 0) {
        self.id = UUID()
        self.text = text
        self.isCompleted = false
        self.order = order
    }
}
