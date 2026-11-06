package fixture.kmp

import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application

actual fun platformName(): String = "JVM ${System.getProperty("java.version")}"

fun main() = application {
    Window(onCloseRequest = ::exitApplication, title = "KMP fixture") { App() }
}
