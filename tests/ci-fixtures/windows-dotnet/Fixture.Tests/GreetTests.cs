using Xunit;

public class GreetTests
{
    static string Greet(string name) => $"hello {name}";

    [Fact]
    public void Greets() => Assert.Equal("hello gw", Greet("gw"));
}
