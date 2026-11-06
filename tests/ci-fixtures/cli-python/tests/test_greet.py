from fixture import greet


def test_greet():
    assert greet("gw") == "hello gw"
