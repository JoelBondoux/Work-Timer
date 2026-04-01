# Roadmap

Planned enhancements for future Work-Timer releases.

## Hosted Remote MCP Service (Planned)

Goal:
- Make Work-Timer available as a hosted remote MCP service that users can connect from supported LLM clients without running a local server process.

Why:
- Reduce setup friction for non-technical users.
- Enable centralized updates and operational visibility.
- Provide a path toward broader multi-client access.

Proposed scope (initial MVP):
- Multi-tenant hosted MCP endpoint over HTTPS.
- Per-user authentication and tenant isolation.
- Safe-by-default tool policy and explicit approval gates for destructive operations.
- Basic onboarding docs for major clients (OpenAI, Anthropic, Google, VS Code/Copilot where applicable).
- Usage limits and abuse controls.

Key dependencies:
- Stable auth model and account linking flow.
- Production-grade hosting, observability, and incident response.
- Security review for data handling and tool authorization boundaries.

Status:
- Not started.
- Kept intentionally out of current release scope.
