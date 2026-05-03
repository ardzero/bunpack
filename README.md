![bunpack demo](https://i.ibb.co.com/cKRTtHXp/bunpack-demo-optimize.gif)

# create bunpack

An opinionated base template for creating quick CLI tools with Bun and TypeScript and a few helpful utilities.
Bunpack also include a detailed [Beginner's Publishing guide](./PUBLISH_GUIDE.md) on how to publish your npm package/cli.

> This requires [Bun](https://bun.com/) to be installed because it is used as the bundler and ts runner.

### Project repo: [bunpack](https://github.com/ardzero/bunpack)

## Tech stack

[![Bun](https://img.shields.io/badge/Bun-000000?style=flat&logo=bun&logoColor=white)](https://bun.com/) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![@clack/prompts](https://img.shields.io/badge/%40clack%2Fprompts-CB3837?style=flat&logo=npm&logoColor=white)](https://github.com/bombshell-dev/clack) [![execa](https://img.shields.io/badge/execa-CB3837?style=flat&logo=npm&logoColor=white)](https://github.com/sindresorhus/execa) [![yargs](https://img.shields.io/badge/yargs-CB3837?style=flat&logo=npm&logoColor=white)](https://yargs.js.org/)

## Usage

```bash
bun create bunpack@latest
```

```bash
bun create bunpack@latest [project-name] [options]
```

`project-name` can be a single segment (`my-cli`) or a **relative path** under the current directory (`./pkgs/my-cli`). Use `.` only in an **empty** directory to scaffold into the current folder.

### Options

| Flag                         | Description                                                                                                          |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| `-y`, `--yes`                | Skip all default prompts; install deps, init git, **template author**                                                |
| `--da`, `-da`                | Template `author` only; skip author prompts (`-y` implies this)                                                      |
| `--git` / `--no-git`         | Initialize or skip git                                                                                               |
| `--install` / `--no-install` | Install or skip dependencies                                                                                         |
| `--repo`                     | Git remote URL (GitHub/GitLab, same rules as interactive); adds `origin`, sets `main`, **pushes**; requires git init |
| `--cursor`                   | Open the project in Cursor after creation                                                                            |
| `--vscode`                   | Open the project in VS Code after creation                                                                           |
| `-h`, `--help`               | Show help                                                                                                            |
| `-v`, `--version`            | Show version                                                                                                         |

Run `bunx create-bunpack --help` for the same details in the terminal.

### Examples

| Command                                                             |                                                                  |
| :------------------------------------------------------------------ | :--------------------------------------------------------------- |
| `bun create bunpack my-cli`                                         | Interactive prompts (location, author, install, git, …)          |
| `bun create bunpack my-cli -y`                                      | Defaults only: install, git, template author (no author prompts) |
| `bun create bunpack miks -y --repo=https://github.com/you/miks.git` | Scaffold, then push to that remote (`https://` or `git@...`)     |
| `bun create bunpack ./pkgs/my-cli -y`                               | Nested folder under cwd; same non-interactive defaults as `-y`   |
| `bun create bunpack my-cli --cursor --git`                          | Create, init git, open in Cursor                                 |
| `bun create bunpack my-cli --no-install`                            | Create without installing dependencies                           |

---

## Developing this package

| Command         | Action                                  |
| :-------------- | :-------------------------------------- |
| `bun --help`    | Shows Bun’s CLI help                    |
| `bun dev`       | Run `cli.ts` (same as `bun run cli.ts`) |
| `bun run build` | Build the published CLI to `./dist/`    |

## Socials

- Website: [ardastroid.com](https://ardastroid.com)
- Email: [hello@ardastroid.com](mailto:hello@ardastroid.com)
- GitHub: [@ardzero](https://github.com/ardzero)

## License

MIT License

Copyright (c) 2026 Ard Astroid / Farhan Ashhab Nur

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
