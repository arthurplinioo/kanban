import Foundation
import GoogleSignIn

/// Representação mínima de um evento do Google Calendar, mapeada de/para TaskItem.
struct RemoteEvent {
    let id: String
    let title: String
    let detail: String
    let start: Date
    let end: Date
    let isAllDay: Bool
    let updatedAt: Date
}

enum GoogleCalendarError: Error {
    case notSignedIn
    case invalidResponse
    case http(Int, String)
}

/// Fala diretamente com a API REST do Google Calendar (v3).
/// Autenticação via GoogleSignIn SDK (GIS) — não usa client secret,
/// pois é um cliente público (app iOS).
final class GoogleCalendarService {
    static let shared = GoogleCalendarService()
    private let baseURL = URL(string: "https://www.googleapis.com/calendar/v3/calendars/primary/events")!

    private init() {}

    var isSignedIn: Bool {
        GIDSignIn.sharedInstance.currentUser != nil
    }

    @MainActor
    func signIn(presenting viewController: UIViewController) async throws {
        let result = try await GIDSignIn.sharedInstance.signIn(
            withPresenting: viewController,
            hint: nil,
            additionalScopes: [Constants.googleCalendarScope]
        )
        // Garante que o escopo de Calendar foi de fato concedido.
        let grantedScopes = result.user.grantedScopes ?? []
        guard grantedScopes.contains(Constants.googleCalendarScope) else {
            throw GoogleCalendarError.notSignedIn
        }
    }

    func signOut() {
        GIDSignIn.sharedInstance.signOut()
    }

    private func accessToken() async throws -> String {
        guard let user = GIDSignIn.sharedInstance.currentUser else {
            throw GoogleCalendarError.notSignedIn
        }
        // refreshTokensIfNeeded renova automaticamente se o access token expirou.
        let refreshed = try await user.refreshTokensIfNeeded()
        return refreshed.accessToken.tokenString
    }

    private func authorizedRequest(url: URL, method: String) async throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(try await accessToken())", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return request
    }

    /// Lista eventos alterados desde `syncToken` (sync incremental) ou,
    /// na primeira sincronização, dentro da janela [from, to].
    func listEvents(from: Date, to: Date, syncToken: String? = nil) async throws -> (events: [RemoteEvent], nextSyncToken: String) {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        var items: [URLQueryItem] = [
            .init(name: "singleEvents", value: "true"),
            .init(name: "showDeleted", value: "true"),
            .init(name: "maxResults", value: "250"),
        ]
        if let syncToken {
            items.append(.init(name: "syncToken", value: syncToken))
        } else {
            items.append(.init(name: "timeMin", value: ISO8601DateFormatter().string(from: from)))
            items.append(.init(name: "timeMax", value: ISO8601DateFormatter().string(from: to)))
        }
        components.queryItems = items

        let request = try await authorizedRequest(url: components.url!, method: "GET")
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)

        let decoded = try JSONDecoder().decode(EventsListResponse.self, from: data)
        let events = decoded.items?.compactMap { $0.toRemoteEvent() } ?? []
        return (events, decoded.nextSyncToken ?? "")
    }

    func createEvent(for task: TaskItem) async throws -> RemoteEvent {
        var request = try await authorizedRequest(url: baseURL, method: "POST")
        request.httpBody = try JSONEncoder().encode(GoogleEventPayload(task: task))
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)
        let decoded = try JSONDecoder().decode(GoogleEventDTO.self, from: data)
        guard let remote = decoded.toRemoteEvent() else { throw GoogleCalendarError.invalidResponse }
        return remote
    }

    func updateEvent(googleEventId: String, task: TaskItem) async throws -> RemoteEvent {
        let url = baseURL.appendingPathComponent(googleEventId)
        var request = try await authorizedRequest(url: url, method: "PATCH")
        request.httpBody = try JSONEncoder().encode(GoogleEventPayload(task: task))
        let (data, response) = try await URLSession.shared.data(for: request)
        try Self.validate(response, data: data)
        let decoded = try JSONDecoder().decode(GoogleEventDTO.self, from: data)
        guard let remote = decoded.toRemoteEvent() else { throw GoogleCalendarError.invalidResponse }
        return remote
    }

    func deleteEvent(googleEventId: String) async throws {
        let url = baseURL.appendingPathComponent(googleEventId)
        let request = try await authorizedRequest(url: url, method: "DELETE")
        let (data, response) = try await URLSession.shared.data(for: request)
        // 410 Gone = já estava excluído no Google; tratamos como sucesso.
        if case .http(410, _) = (try? Self.validate(response, data: data)) as? GoogleCalendarError ?? .invalidResponse {
            return
        }
        try Self.validate(response, data: data)
    }

    private static func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw GoogleCalendarError.invalidResponse }
        guard (200...299).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw GoogleCalendarError.http(http.statusCode, body)
        }
    }
}

// MARK: - DTOs

private struct EventsListResponse: Decodable {
    let items: [GoogleEventDTO]?
    let nextSyncToken: String?
}

private struct GoogleEventDTO: Decodable {
    let id: String
    let status: String?
    let summary: String?
    let description: String?
    let start: EventDateTime?
    let end: EventDateTime?
    let updated: String?

    func toRemoteEvent() -> RemoteEvent? {
        guard status != "cancelled",
              let startDate = start?.resolvedDate,
              let endDate = end?.resolvedDate,
              let updatedString = updated,
              let updatedDate = ISO8601DateFormatter().date(from: updatedString) else { return nil }

        return RemoteEvent(
            id: id,
            title: summary ?? "Sem título",
            detail: description ?? "",
            start: startDate,
            end: endDate,
            isAllDay: start?.date != nil,
            updatedAt: updatedDate
        )
    }
}

private struct EventDateTime: Codable {
    let dateTime: String?
    let date: String?
    let timeZone: String?

    var resolvedDate: Date? {
        if let dateTime { return ISO8601DateFormatter().date(from: dateTime) }
        if let date {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            return formatter.date(from: date)
        }
        return nil
    }
}

private struct GoogleEventPayload: Encodable {
    let summary: String
    let description: String
    let start: EventDateTime
    let end: EventDateTime

    init(task: TaskItem) {
        summary = task.title
        description = task.detail
        let start = task.dueDate ?? .now
        let end = task.endDate ?? start.addingTimeInterval(3600)
        let iso = ISO8601DateFormatter()
        let tz = TimeZone.current.identifier
        self.start = EventDateTime(dateTime: iso.string(from: start), date: nil, timeZone: tz)
        self.end = EventDateTime(dateTime: iso.string(from: end), date: nil, timeZone: tz)
    }
}
