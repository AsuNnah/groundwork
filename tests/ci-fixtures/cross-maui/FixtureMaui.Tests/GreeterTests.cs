using Xunit;

namespace FixtureMaui.Tests;

public class GreeterTests
{
	[Fact]
	public void GreetNamesThePlatform() => Assert.Equal("Hello from MAUI", FixtureMaui.Greeter.Greet("MAUI"));
}
