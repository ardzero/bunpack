# create bunpack

An opinionated base template for creating quick cli tools with Bun and typescript and a few helpful utilities.

> This requires `bun` cause we're using it as the bundler.

### Project Repo: [bunpack](https://github.com/ardzero/bunpack)

#### Command list

| Command         | Action                                         |
| :-------------- | :--------------------------------------------- |
| `bun --help`    | Shows all the available commands               |
| `bun dev`       | Run entry point `index.ts` with bun            |
| `bun run build` | Build your production package/cli to `./dist/` |

## Tech Stack

[![Bun](https://img.shields.io/badge/Bun-000000?style=flat&logo=data:image/png;base64,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)](https://bun.com/) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![@clack/prompts](https://img.shields.io/badge/%40clack%2Fprompts-CB3837?style=flat&logo=npm&logoColor=white)](https://github.com/bombshell-dev/clack) [![execa](https://img.shields.io/badge/execa-CB3837?style=flat&logo=npm&logoColor=white)](https://github.com/sindresorhus/execa) [![yargs](https://img.shields.io/badge/yargs-CB3837?style=flat&logo=npm&logoColor=white)](https://yargs.js.org/)

## Socials

- Website: [ardastroid.com](https://ardastroid.com)
- Email: [hello@ardastroid.com](mailto:hello@ardastroid.com)
- GitHub: [@ardzero](https://github.com/ardzero)

## License

MIT License

Copyright (c) 2026 Ard Astroid / Farhan Ashhab Nur

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
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
