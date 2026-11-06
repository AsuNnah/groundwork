using NUnit.Framework;
using Fixture;

public class ScoreTests
{
    [Test]
    public void AHitScoresTen() => Assert.AreEqual(10, Score.ForHit(1));

    [Test]
    public void AStreakOfThreeDoublesTheHit() => Assert.AreEqual(20, Score.ForHit(3));
}
