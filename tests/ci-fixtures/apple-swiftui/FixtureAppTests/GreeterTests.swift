import XCTest

// a logic test bundle (no host app): Greeter.swift is compiled into it, so it runs on the iOS Simulator and on macOS alike
final class GreeterTests: XCTestCase {
    func testGreetNamesTheUser() {
        XCTAssertEqual(greet("Groundwork"), "Hello, Groundwork from SwiftUI")
    }
}
