package fixture.kmp

import androidx.compose.ui.window.ComposeUIViewController

actual fun platformName(): String = "iOS"

// the iOS app (iosApp/) shows this view controller
fun MainViewController() = ComposeUIViewController { App() }
