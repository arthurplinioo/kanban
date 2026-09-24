import SwiftUI
import GoogleSignIn

struct SettingsView: View {
    @ObservedObject var syncEngine = SyncEngine.shared
    @State private var isSignedIn = GoogleCalendarService.shared.isSignedIn
    @State private var notificationsAuthorized = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Google Agenda") {
                    if isSignedIn {
                        Label("Conectado", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                        if let last = syncEngine.lastSyncedAt {
                            Text("Última sincronização: \(last.formatted(date: .abbreviated, time: .shortened))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        if let error = syncEngine.lastSyncError {
                            Text(error).font(.caption).foregroundStyle(.red)
                        }
                        Button("Desconectar", role: .destructive) {
                            GoogleCalendarService.shared.signOut()
                            isSignedIn = false
                        }
                    } else {
                        GoogleSignInButton { await signIn() }
                    }
                }

                Section("Notificações") {
                    if notificationsAuthorized {
                        Label("Permitidas", systemImage: "bell.fill")
                    } else {
                        Button("Permitir notificações") {
                            Task { notificationsAuthorized = await NotificationService.shared.requestAuthorization() }
                        }
                    }
                }

                Section("Dados") {
                    Button("Forçar sincronização agora") {
                        Task { await syncEngine.sync(context: PersistenceController.shared.mainContext) }
                    }.disabled(!isSignedIn || syncEngine.isSyncing)
                }
            }
            .navigationTitle("Ajustes")
        }
    }

    @MainActor
    private func signIn() async {
        guard let rootVC = UIApplication.shared.connectedScenes
            .compactMap({ ($0 as? UIWindowScene)?.keyWindow?.rootViewController })
            .first else { return }
        do {
            try await GoogleCalendarService.shared.signIn(presenting: rootVC)
            isSignedIn = true
            await syncEngine.sync(context: PersistenceController.shared.mainContext)
        } catch {
            print("Erro no login Google: \(error)")
        }
    }
}
