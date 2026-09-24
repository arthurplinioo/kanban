import SwiftUI
import GoogleSignIn
import SwiftData

@main
struct TaskFlowApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .modelContainer(PersistenceController.shared)
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
                .task {
                    // Restaura a sessão Google salva no Keychain, se houver,
                    // e dispara um sync ao abrir o app.
                    GIDSignIn.sharedInstance.restorePreviousSignIn { _, _ in
                        Task { @MainActor in
                            await SyncEngine.shared.sync(context: PersistenceController.shared.mainContext)
                        }
                    }
                    SyncEngine.shared.scheduleBackgroundRefresh()
                }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: Constants.googleOAuthClientID)
        SyncEngine.shared.registerBackgroundTask()
        return true
    }
}
