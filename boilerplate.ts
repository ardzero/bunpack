#!/usr/bin/env node
/**
 * Starter CLI for projects scaffolded from bunpack.
 * Replaces the create-bunpack installer (`cli.ts`) during bootstrap.
 */
import * as p from "@clack/prompts";
import color from "picocolors";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface BoilerplateArgv {
    _: (string | number)[];
    h?: boolean;
    help?: boolean;
    v?: boolean;
    version?: boolean;
}

function readPackageJson(): { name: string; version: string } {
    try {
        const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8")) as {
            name?: string;
            version?: string;
        };
        return {
            name: typeof pkg.name === "string" ? pkg.name : "cli",
            version: typeof pkg.version === "string" ? pkg.version : "0.0.0",
        };
    } catch {
        return { name: "cli", version: "0.0.0" };
    }
}

const { name: PKG_NAME, version: PKG_VERSION } = readPackageJson();

const INTRO_TITLE = color.bgMagenta(color.black(` ${PKG_NAME} `));

function getVersion(): string {
    return PKG_VERSION;
}

function showHelp(): void {
    console.clear();
    p.intro(INTRO_TITLE);

    console.log(color.bold("\nUsage:"));
    console.log(`  ${color.cyan("bun run dev")} ${color.dim("<command> [options]")}`);
    p.note(
        `${color.cyan(`bun run cli.ts hello`)}\n  Greet the default name\n\n` +
        `${color.cyan(`bun run cli.ts hello Ada`)}\n  Greet someone specific\n\n` +
        `${color.cyan(`bun run cli.ts help`)}\n  Same as ${color.dim("--help")}`,
        "Examples",
    );

    console.log(color.bold("\nCommands:"));
    console.log(`  ${color.cyan("hello [name]")}    Print a greeting`);
    console.log(`  ${color.cyan("help")}           Show usage (same as ${color.dim("--help")})`);

    console.log(color.bold("\nOptions:"));
    console.log(`  ${color.cyan("-h, --help")}             Show this help message`);
    console.log(`  ${color.cyan("-v, --version")}          Show version number`);

    p.outro(color.dim(`Package: ${PKG_NAME}`));
}

function showVersion(): void {
    console.clear();
    p.intro(INTRO_TITLE);
    console.log(`\n  ${color.bold("Version:")} ${color.cyan(getVersion())}`);
    p.outro(color.dim(`${PKG_NAME}`));
}

const argv = yargs(hideBin(process.argv))
    .help(false)
    .version(false)
    .command(
        "hello [name]",
        "Print a greeting",
        (y) =>
            y.positional("name", {
                describe: "Who to greet",
                default: "world",
                type: "string",
            }),
        (cmdArgv) => {
            console.clear();
            p.intro(INTRO_TITLE);
            console.log(color.green(`\n  Hello, ${cmdArgv.name as string}!`));
            p.outro(color.dim("Done."));
        },
    )
    .command(
        "help",
        "Show usage information",
        () => { },
        () => {
            showHelp();
            process.exit(0);
        },
    )
    .option("h", {
        alias: "help",
        type: "boolean",
        description: "Show help",
    })
    .option("v", {
        alias: "version",
        type: "boolean",
        description: "Show version",
    })
    .strict()
    .parseSync() as BoilerplateArgv;

if (argv.h || argv.help) {
    showHelp();
    process.exit(0);
}

if (argv.v || argv.version) {
    showVersion();
    process.exit(0);
}

if (argv._.length === 0) {
    showHelp();
    process.exit(0);
}
