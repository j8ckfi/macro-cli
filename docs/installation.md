# Installation

The CLI and Agent Skill are installed separately: the CLI provides the `macro` executable, while the skill teaches an agent when and how to use it.

## Install the CLI

```bash
curl -fsSL https://raw.githubusercontent.com/j8ckfi/macro-cli/main/install.sh | sh
```

The installer:

1. requires Node.js 18.14 or newer and npm;
2. installs the GitHub package with npm lifecycle scripts disabled;
3. uses a user-owned prefix, `~/.local`, without `sudo`;
4. verifies that `~/.local/bin/macro` is executable;
5. warns when that directory is not on `PATH`.

Review [`install.sh`](../install.sh) before piping it to a shell if that matches your security policy.

Override the prefix when needed:

```bash
curl -fsSL https://raw.githubusercontent.com/j8ckfi/macro-cli/main/install.sh \
  | MACRO_CLI_PREFIX="$HOME/.local" sh
```

Rerun the same command to update the installation from `main`.

### Install from source

```bash
git clone https://github.com/j8ckfi/macro-cli.git
cd macro-cli
npm ci --ignore-scripts
npm link
```

Use source installation for development or when pinning and auditing an exact commit.

## Install the Agent Skill

The repository follows the open Agent Skills layout and is discoverable by Vercel's [`skills`](https://github.com/vercel-labs/skills) CLI.

Start the interactive installer:

```bash
npx skills add j8ckfi/macro-cli
```

The Skills CLI discovers `macro-workspace`, detects supported agents, and prompts for the skill, target agent or agents, project or global scope, and installation method. Reload or restart the selected agent after installation.

## Authenticate

```bash
macro login
macro status
```

Authentication is per user and is not installed with either package.

## Update

Update the CLI by rerunning its installer. Update installed skills interactively with:

```bash
npx skills update macro-workspace
```

## Uninstall

Remove the skill and choose its installed targets interactively:

```bash
npx skills remove macro-workspace
```

Remove local credentials and the CLI:

```bash
macro logout
npm uninstall --global --prefix "$HOME/.local" macro-cli
```
