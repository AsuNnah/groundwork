namespace Fixture
{
    // game rule under test: hits score 10, a streak of 3 or more doubles the hit
    public static class Score
    {
        public static int ForHit(int streak) => streak >= 3 ? 20 : 10;
    }
}
