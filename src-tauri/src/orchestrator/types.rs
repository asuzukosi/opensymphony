use std::fmt;

#[derive(Debug)]
pub enum OrchestratorError {
    Db(String),
    Io(String),
    Config(String),
    Runtime(String),
    NotFound(String),
}

impl fmt::Display for OrchestratorError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Db(msg) => write!(f, "db error: {msg}"),
            Self::Io(msg) => write!(f, "io error: {msg}"),
            Self::Config(msg) => write!(f, "config error: {msg}"),
            Self::Runtime(msg) => write!(f, "runtime error: {msg}"),
            Self::NotFound(msg) => write!(f, "not found: {msg}"),
        }
    }
}

impl std::error::Error for OrchestratorError {}

pub type Result<T> = std::result::Result<T, OrchestratorError>;
