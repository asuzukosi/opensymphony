//! substitute workflow prompt template placeholders before session/prompt.

use thiserror::Error;

use super::types::StartRuntimeSessionInput;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PromptRenderIssueFields {
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
}

pub struct RenderPromptInput<'a> {
    pub prompt_template: &'a str,
    pub issue: &'a PromptRenderIssueFields,
}

#[derive(Debug, Error, PartialEq, Eq)]
#[error("prompt template: unknown variable {variable}")]
pub struct PromptRenderError {
    pub variable: String,
}

pub fn render_prompt_template(input: &RenderPromptInput<'_>) -> Result<String, PromptRenderError> {
    let mut out = String::with_capacity(input.prompt_template.len());
    let mut rest = input.prompt_template;

    while let Some(start) = rest.find("{{") {
        out.push_str(&rest[..start]);
        let after_open = &rest[start + 2..];
        let Some(end) = after_open.find("}}") else {
            out.push_str("{{");
            rest = after_open;
            continue;
        };

        let raw = &after_open[..end];
        let name = raw.trim();
        if is_template_variable_name(name) {
            match resolve_prompt_variable(name, input.issue) {
                Some(value) => out.push_str(value),
                None => {
                    return Err(PromptRenderError {
                        variable: format!("{{{{{name}}}}}"),
                    });
                }
            }
        } else {
            out.push_str(&rest[start..start + 2 + end + 2]);
        }

        rest = &after_open[end + 2..];
    }

    out.push_str(rest);
    Ok(out)
}

pub fn render_task_prompt(input: &StartRuntimeSessionInput) -> Result<String, String> {
    if input.prompt_template.trim().is_empty() {
        return Ok(
            [
                input.identifier.as_str(),
                input.title.as_str(),
                input.description.as_deref().unwrap_or(""),
            ]
            .iter()
            .copied()
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
            .join("\n"),
        );
    }

    render_prompt_template(&RenderPromptInput {
        prompt_template: &input.prompt_template,
        issue: &PromptRenderIssueFields {
            identifier: input.identifier.clone(),
            title: input.title.clone(),
            description: input.description.clone(),
        },
    })
    .map_err(|err| err.to_string())
}

fn is_template_variable_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
}

fn resolve_prompt_variable<'a>(
    name: &str,
    issue: &'a PromptRenderIssueFields,
) -> Option<&'a str> {
    match name {
        "identifier" => Some(issue.identifier.as_str()),
        "title" => Some(issue.title.as_str()),
        "description" => Some(issue.description.as_deref().unwrap_or("")),
        _ => None,
    }
}

