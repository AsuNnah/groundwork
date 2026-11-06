package fixture.app;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public class GreetTest {
    @Test public void greets() { assertEquals("hello gw", MainActivity.greet("gw")); }
}
