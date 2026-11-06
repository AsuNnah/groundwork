using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using Fixture;

public class ScorePlayModeTests
{
    [UnityTest]
    public IEnumerator AHitScoresTenInAPlayingScene()
    {
        var player = new GameObject("player");
        yield return null;   // one frame in play mode
        Assert.IsTrue(player.activeInHierarchy);
        Assert.AreEqual(10, Score.ForHit(1));
        Object.Destroy(player);
    }
}
