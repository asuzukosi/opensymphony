fn main() {
    if let Err(err) = opensymphony_mock_acp_agent::run() {
        eprintln!("opensymphony mock acp agent: {err:#}");
        std::process::exit(1);
    }
}
