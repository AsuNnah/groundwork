extends SceneTree
# godot --headless -s res://tests/run_tests.gd : exit code 0 when every check passes

func _init() -> void:
	var failures := 0
	if MathUtil.add(2, 3) != 5:
		printerr("add failed")
		failures += 1
	print("tests done, failures: %d" % failures)
	quit(1 if failures > 0 else 0)
