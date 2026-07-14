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

Install globally for Pi without prompts:

```bash
npx --yes skills@latest add j8ckfi/macro-cli \
  --skill macro-workspace \
  --global \
  --agent pi \
  --yes
```

Or let the Skills CLI detect installed agents and prompt for destinations:

```bash
npx --yes skills@latest add j8ckfi/macro-cli --skill macro-workspace --global
```

List the repository's available skills without installing:

```bash
npx --yes skills@latest add j8ckfi/macro-cli --list
```

After installing for Pi, run `/reload` or start a new Pi session.

## Authenticate

```bash
macro login
macro status
```

Authentication is per user and is not installed with either package.

## Update

Update the CLI by rerunning its installer. Update installed skills with:

```bash
npx --yes skills@latest update macro-workspace --global --yes
```

## Uninstall

Remove the skill:

```bash
npx --yes skills@latest remove macro-workspace --global --agent pi --yes
```

Remove local credentials and the CLI:

```bash
macro logout
npm uninstall --global --prefix "$HOME/.local" macro-cli
```
