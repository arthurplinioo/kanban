import Foundation
import UserNotifications

/// Lembretes de tarefas via notificações locais (UNUserNotificationCenter).
///
/// Isso funciona com o app fechado ou em background — diferente de uma
/// notificação de navegador (o que o app web atual usa), que só dispara
/// com o processo ativo. Não é "push remoto" via APNs porque o lembrete
/// não depende de um servidor: a data já é conhecida no dispositivo, então
/// uma notificação local agendada é a ferramenta certa e mais simples.
/// APNs só entraria em cena para avisos originados fora do dispositivo
/// (ex.: alguém alterou o evento no Google Calendar pela web) — ver README.
final class NotificationService {
    static let shared = NotificationService()
    private let center = UNUserNotificationCenter.current()

    private init() {}

    func requestAuthorization() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    func scheduleReminder(for task: TaskItem) {
        cancelReminder(for: task)

        guard !task.isCompleted,
              let dueDate = task.dueDate,
              let minutesBefore = task.reminderMinutesBefore else { return }

        let triggerDate = dueDate.addingTimeInterval(-Double(minutesBefore) * 60)
        guard triggerDate > .now else { return }

        let content = UNMutableNotificationContent()
        content.title = task.title
        content.body = task.detail.isEmpty ? "Começa em \(minutesBefore) min" : task.detail
        content.sound = .default

        let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: triggerDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let request = UNNotificationRequest(identifier: task.id.uuidString, content: content, trigger: trigger)
        center.add(request)
    }

    func cancelReminder(for task: TaskItem) {
        center.removePendingNotificationRequests(withIdentifiers: [task.id.uuidString])
    }

    func rescheduleAll(for tasks: [TaskItem]) {
        center.removeAllPendingNotificationRequests()
        tasks.forEach(scheduleReminder)
    }
}
