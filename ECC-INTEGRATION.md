# ECC Integration in Charles Chatbot

This directory contains integrated components from the Everything Claude Code (ECC) repository.

## Structure

- agents/ - 60+ specialized AI agents for various development tasks
- skills/ - 232+ reusable skills that agents can use
- rules/ - Coding standards and best practices for various languages
- commands/ - CLI commands for invoking ECC functionality
- hooks/ - Automation scripts that run on various events
- scripts/ - Installer and utility scripts
- config/ - Configuration files
- manifests/ - Installation manifests

## Usage

### Invoking Agents

Agents can be invoked using the ECC command system:

`
# List available agents
node ecc/commands/agent.js list

# Get help for a specific agent
node ecc/commands/agent.js help <agent-name>

# Run an agent on a task
node ecc/commands/agent.js run <agent-name> "<task description>"
`

### Using Skills

Skills are automatically available to agents, but can also be invoked directly:

`
# List available skills
node ecc/commands/skill.js list

# Get info about a specific skill
node ecc/commands/skill.js info <skill-name>
`

### Applying Rules

Rules can be checked using the linting commands:

`
# Check code against ECC rules
node ecc/commands/lint.js check <file-path>

# Fix auto-fixable issues
node ecc/commands/lint.js fix <file-path>
`

## Integration with Existing Quality System

The ECC agents complement the existing quality-improvement-agent.js by providing:

- Specialized agents for different domains (architecture, security, performance, etc.)
- Additional skills for code analysis and improvement
- Extended rule sets for various languages and frameworks
- Automation hooks for continuous quality improvement

## Recommended Agents for This Project

- typescript-reviewer - For reviewing TypeScript/JavaScript code
- code-reviewer - General code quality reviews
- security-reviewer - Security vulnerability detection
- performance-optimizer - Performance improvement suggestions
- architect - System design and scalability advice
- build-error-resolver - Help with build/compilation issues
- doc-updater - Keeping documentation in sync with code
- test-generator - Creating unit tests

## Configuration

ECC components can be customized by modifying:

- ecc/config/ - Configuration files
- Individual agent/skill/rule files as needed

## Updates

To update ECC components, pull changes from the original ECC repository and recopy the desired directories.

Source: https://github.com/MaTo8888/ECC
