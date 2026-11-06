fn greet(name: &str) -> String {
    format!("hello {name}")
}

fn main() {
    println!("{}", greet("world"));
}

#[cfg(test)]
mod tests {
    #[test]
    fn greets() {
        assert_eq!(super::greet("gw"), "hello gw");
    }
}
