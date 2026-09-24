import Foundation

enum Constants {
    /// Client ID OAuth 2.0 do tipo "iOS" criado no Google Cloud Console.
    /// Ver README.md → "Configurar Google Cloud" para o passo a passo.
    /// Não commitar valores reais direto no código-fonte em produção:
    /// prefira ler de um .xcconfig / Secrets.plist fora do controle de versão.
    static let googleOAuthClientID = "SEU_CLIENT_ID.apps.googleusercontent.com"

    static let googleCalendarScope = "https://www.googleapis.com/auth/calendar.events"

    /// Intervalo mínimo entre sincronizações automáticas em segundo plano.
    static let backgroundSyncInterval: TimeInterval = 15 * 60

    static let backgroundTaskIdentifier = "com.taskflow.app.sync"
}
