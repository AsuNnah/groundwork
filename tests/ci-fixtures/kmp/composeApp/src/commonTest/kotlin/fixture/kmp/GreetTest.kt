package fixture.kmp

import kotlin.test.Test
import kotlin.test.assertTrue

// runs on every target: Android (host and device), iOS simulator, desktop JVM and Wasm in Chrome
class GreetTest {
    @Test
    fun greetsFromThisPlatform() {
        val g = greet("KMP")
        assertTrue(g.startsWith("Hello, KMP from ") && platformName().isNotBlank(), g)
    }
}
