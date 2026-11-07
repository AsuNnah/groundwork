import SwiftUI

// one multiplatform app target: the same code builds for iOS and macOS
@main
struct FixtureApp: App {
    var body: some Scene {
        WindowGroup { Text(greet("Groundwork")).padding() }
    }
}
