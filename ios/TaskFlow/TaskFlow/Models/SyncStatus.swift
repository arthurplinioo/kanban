import Foundation

/// Estado de sincronização de uma tarefa em relação ao Google Calendar.
/// Necessário porque o app é offline-first: mudanças locais podem existir
/// antes de haver conexão para propagá-las.
enum SyncStatus: String, Codable {
    case synced        // espelha o estado no Google Calendar
    case pendingCreate  // criada localmente, ainda não enviada
    case pendingUpdate  // editada localmente após o último sync
    case pendingDelete  // apagada localmente, exclusão remota pendente
    case conflict       // editada localmente E remotamente desde o último sync
}
