package main

import "fmt"

func Greet(name string) string { return "hello " + name }

func main() { fmt.Println(Greet("world")) }
