import Foundation
import CoreTransferable
import UniformTypeIdentifiers

/// Payload transportado pelo drag-and-drop nativo do SwiftUI (`.draggable` /
/// `.dropDestination`). Cobre dois casos, espelhando o comportamento do app
/// desktop (ver DraggableSubtask.jsx + useBoard.js no app Electron/React):
///   - arrastar uma TASK inteira entre colunas
///   - arrastar uma SUBTASK: solta em cima de outra task = vira subtarefa
///     dela; solta em uma coluna vazia = "promovida" a task própria
struct DragPayload: Codable, Transferable {
    enum Kind: String, Codable { case task, subtask }

    let kind: Kind
    let id: UUID
    /// Preenchido apenas quando kind == .subtask
    let parentTaskId: UUID?

    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .taskFlowDragPayload)
    }
}

extension UTType {
    static let taskFlowDragPayload = UTType(exportedAs: "com.taskflow.app.dragpayload")
}
