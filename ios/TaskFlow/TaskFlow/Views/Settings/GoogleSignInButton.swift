import SwiftUI

struct GoogleSignInButton: View {
    let action: () async -> Void

    var body: some View {
        Button {
            Task { await action() }
        } label: {
            HStack {
                Image(systemName: "g.circle.fill")
                Text("Entrar com o Google")
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
    }
}
