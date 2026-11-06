package fixture.kmp

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OnDeviceTest {
    @Test
    fun runsOnTheEmulator() {
        assertEquals("fixture.kmp", InstrumentationRegistry.getInstrumentation().targetContext.packageName)
        assertEquals("Hello, device from Android", greet("device"))
    }
}
