package fixture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class GreetTest {
  @Test void greets() { assertEquals("hello gw", Greet.greet("gw")); }
}
