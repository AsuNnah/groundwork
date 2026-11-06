package fixture.kmp

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

expect fun platformName(): String

fun greet(name: String): String = "Hello, $name from ${platformName()}"

@Composable
fun App() {
    MaterialTheme { Text(greet("Groundwork")) }
}
