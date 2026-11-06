package main

import "testing"

func TestGreet(t *testing.T) {
	if got := Greet("gw"); got != "hello gw" {
		t.Fatalf("got %q", got)
	}
}
