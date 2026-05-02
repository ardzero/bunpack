#!/usr/bin/env node
import * as p from "@clack/prompts";
import color from "picocolors";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const REPO_URL = "https://github.com/ardzero/bunpack.git";
const REPO_LINK_PLACEHOLDER_PREFIX = "https://github.com/ardzero/";
/** Paths to drop from the cloned template (scaffold-only or unwanted in new projects). */
const PATHS_TO_REMOVE: string[] = ["cli.ts", "dist"];

const INTRO_TITLE = color.bgMagenta(color.black(" create-bunpack "));

/** Clack: use `cancel()` then exit for Ctrl+C / prompt cancellation (see @clack/prompts README). */
const exitCancelled = (message = "Operation cancelled"): void => {
  p.cancel(message);
  process.exit(0);
};

interface CliArguments {
  _: (string | number)[];
  y: boolean;
  git?: boolean;
  install?: boolean;
  cursor?: boolean;
  vscode?: boolean;
  h?: boolean;
  v?: boolean;
}

type PackageManager = "bun" | "pnpm" | "yarn" | "npm";
type EditorChoice = "cursor" | "vscode" | "skip" | null;

function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageJsonPath = join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version?: string };
    return packageJson.version ?? "0.0.1";
  } catch {
    return "0.0.1";
  }
}

function slugifyPackageName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "my-cli";
}

function applyProjectReadme(projectRoot: string, nameForPackage: string, author: string): void {
  const slug = slugifyPackageName(nameForPackage);
  const repoLinkPlaceholder = `${REPO_LINK_PLACEHOLDER_PREFIX}${slug}`;
  const projectReadmePath = resolve(projectRoot, "project_readme.md");
  const readmePath = resolve(projectRoot, "README.md");
  if (!existsSync(projectReadmePath)) return;
  let content = readFileSync(projectReadmePath, "utf-8");
  const year = String(new Date().getFullYear());
  content = content
    .replace(/\?\{project-name\}/g, nameForPackage)
    .replace(/\?\{repo-link\}/g, repoLinkPlaceholder)
    .replace(/\?\{current-year\}/g, year)
    .replace(/\?\{author\}/g, author);
  writeFileSync(readmePath, content);
  rmSync(projectReadmePath, { force: true });
}

function replaceReadmeRepoPlaceholder(projectRoot: string, nameForPackage: string, remoteUrl: string): void {
  const slug = slugifyPackageName(nameForPackage);
  const placeholder = `${REPO_LINK_PLACEHOLDER_PREFIX}${slug}`;
  const readmePath = resolve(projectRoot, "README.md");
  if (!existsSync(readmePath)) return;
  let content = readFileSync(readmePath, "utf-8");
  const displayUrl = remoteUrl
    .replace(/^git@github\.com:(.+?)(\.git)?$/, "https://github.com/$1")
    .replace(/^git@gitlab\.com:(.+?)(\.git)?$/, "https://gitlab.com/$1")
    .replace(/\.git$/i, "");
  content = content.split(placeholder).join(displayUrl);
  writeFileSync(readmePath, content);
}

function applyNewProjectPackageJson(projectRoot: string, nameForPackage: string): void {
  const packageJsonPath = resolve(projectRoot, "package.json");
  if (!existsSync(packageJsonPath)) return;
  let existing: Record<string, unknown>;
  try {
    existing = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return;
  }
  const slug = slugifyPackageName(nameForPackage);
  const author = typeof existing.author === "string" ? existing.author : "";
  const license = typeof existing.license === "string" ? existing.license : "MIT";
  const devDeps = existing.devDependencies;
  const devDependencies =
    devDeps && typeof devDeps === "object" && !Array.isArray(devDeps)
      ? (devDeps as Record<string, string>)
      : {};

  const next: Record<string, unknown> = {
    name: slug,
    description: "A CLI tool built with Bun and TypeScript.",
    author: author || undefined,
    version: "0.0.1",
    license,
    type: "module",
    bin: { [slug]: "dist/cli.js" },
    files: ["dist", "README.md"],
    main: "./dist/cli.js",
    module: "cli.ts",
    scripts: {
      dev: "bun run cli.ts",
      build: "bun build cli.ts --outdir dist --target node --minify --sourcemap=external",
      prepublishOnly: "bun run build",
    },
    keywords: ["cli", "bun", "typescript"],
    devDependencies,
  };

  writeFileSync(packageJsonPath, `${JSON.stringify(next, null, 2)}\n`);
}

function validateProjectName(name: string | undefined): string | undefined {
  if (name == null || name === "") return "Project name is required";
  if (name === ".") return;
  if (!/^\.\/[a-zA-Z0-9-]+$/.test(name) && !/^[a-zA-Z0-9-]+$/.test(name)) {
    return "Project name must contain only letters, numbers, and hyphens";
  }
  const dirName = name.startsWith("./") ? name.slice(2) : name;
  if (existsSync(resolve(process.cwd(), dirName))) {
    return `Directory "${dirName}" already exists`;
  }
}

async function promptForProjectName(): Promise<string> {
  const response = await p.text({
    message: "Where should we create your new project?",
    placeholder: "./my-cli",
    validate: validateProjectName,
  });

  if (p.isCancel(response)) exitCancelled();

  return response as string;
}

function showHelp(): void {
  console.clear();
  p.intro(INTRO_TITLE);

  console.log(color.bold("\nUsage:"));
  console.log(`  ${color.cyan("bun create bunpack")} ${color.dim("[project-name] [options]")}`);
  console.log(`  ${color.cyan("bunx create-bunpack")} ${color.dim("[project-name] [options]")}`);

  p.note(
    `${color.cyan("bun create bunpack my-cli")}\n  Create a new project with interactive prompts\n\n` +
    `${color.cyan("bun create bunpack my-cli -y")}\n  Create with all defaults (install deps, init git)\n\n` +
    `${color.cyan("bun create bunpack my-cli --cursor --git")}\n  Create and open in Cursor with git initialized\n\n` +
    `${color.cyan("bun create bunpack my-cli --no-install")}\n  Create without installing dependencies`,
    "Examples",
  );

  console.log(color.bold("\nOptions:"));
  console.log(`  ${color.cyan("-y, --yes")}              Skip all prompts and use defaults`);
  console.log(`  ${color.cyan("--git")}                  Initialize git repository`);
  console.log(`  ${color.cyan("--no-git")}               Skip git initialization`);
  console.log(`  ${color.cyan("--install")}              Install dependencies`);
  console.log(`  ${color.cyan("--no-install")}           Skip dependency installation`);
  console.log(`  ${color.cyan("--cursor")}               Open project in Cursor after creation`);
  console.log(`  ${color.cyan("--vscode")}               Open project in VS Code after creation`);
  console.log(`  ${color.cyan("-h, --help")}             Show this help message`);
  console.log(`  ${color.cyan("-v, --version")}          Show version number`);

  p.outro(`For more info: ${color.underline(color.cyan("https://github.com/ardzero/bunpack"))}`);
}

const argv = yargs(hideBin(process.argv))
  .help(false)
  .version(false)
  .option("y", {
    type: "boolean",
    description: "Skip all prompts and use defaults (install deps, init git)",
    default: false,
  })
  .option("git", {
    type: "boolean",
    description: "Initialize git repository",
    default: undefined,
  })
  .option("install", {
    type: "boolean",
    description: "Install dependencies",
    default: undefined,
  })
  .option("cursor", {
    type: "boolean",
    description: "Open project in Cursor after creation",
  })
  .option("vscode", {
    type: "boolean",
    description: "Open project in VS Code after creation",
  })
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
  .parse() as CliArguments;

if (argv.h) {
  showHelp();
  process.exit(0);
}

if (argv.v) {
  console.clear();
  p.intro(INTRO_TITLE);
  console.log(`\n  ${color.bold("Version:")} ${color.cyan(getVersion())}`);
  p.outro(color.dim("https://github.com/ardzero/bunpack"));
  process.exit(0);
}

function detectPackageManager(): PackageManager {
  if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") return "bun";
  if (process.env.npm_execpath?.includes("bun")) return "bun";
  if (process.argv[1]?.includes("bunx")) return "bun";
  if (process.env.npm_execpath?.includes("pnpm")) return "pnpm";
  if (process.env.npm_execpath?.includes("yarn")) return "yarn";
  return "npm";
}

async function main(): Promise<void> {
  console.clear();

  p.intro(INTRO_TITLE);

  let projectName: string = (argv._[0] as string | undefined) || "";
  let useCurrentDir = false;

  if (!projectName) {
    projectName = await promptForProjectName();
  } else {
    projectName = projectName.startsWith("./") ? projectName.slice(2) : projectName;
    const validationError = validateProjectName(projectName);
    if (validationError) {
      p.log.error(validationError);
      projectName = await promptForProjectName();
    }
  }

  if (projectName === ".") {
    useCurrentDir = true;
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(process.cwd());
    const visibleFiles = files.filter((file) => !file.startsWith("."));
    if (visibleFiles.length > 0) {
      p.cancel("Current directory is not empty. Please use an empty directory or specify a new project name.");
      process.exit(1);
    }
  } else {
    if (projectName.startsWith("./")) {
      projectName = projectName.slice(2);
    }
    const validationError = validateProjectName(projectName);
    if (validationError) {
      p.cancel(validationError);
      process.exit(1);
    }
  }

  const s = p.spinner({
    onCancel: () => exitCancelled(),
  });
  s.start("Cloning template");
  const tempDir = useCurrentDir ? ".bunpack-temp" : projectName;
  try {
    await execa("git", ["clone", "--depth", "1", REPO_URL, tempDir]);
    s.stop("Template cloned");
  } catch (error: unknown) {
    s.error("Failed to clone template");
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Could not resolve host") ||
      message.includes("unable to access") ||
      message.includes("Failed to connect")
    ) {
      p.log.error("Network error: Unable to reach GitHub");
      p.log.info("Please check your internet connection and try again.");
    } else if (message.includes("Repository not found")) {
      p.log.error("Repository not found");
      p.log.info(`The template repository at ${REPO_URL} could not be found.`);
    } else if (message.includes("already exists")) {
      p.log.error(`Directory "${tempDir}" already exists`);
      p.log.info("Please choose a different project name or remove the existing directory.");
    } else {
      p.log.error("Error details:");
      p.log.info(message);
    }
    process.exit(1);
  }

  const projectRoot = useCurrentDir ? process.cwd() : resolve(process.cwd(), projectName);
  const nameForPackage = useCurrentDir ? basename(projectRoot) : projectName;

  s.start("Cleaning up");
  try {
    const targetDir = useCurrentDir ? tempDir : projectName;
    const gitPath = resolve(process.cwd(), targetDir, ".git");
    if (existsSync(gitPath)) {
      rmSync(gitPath, { recursive: true, force: true });
    }

    for (const pathToRemove of PATHS_TO_REMOVE) {
      const fullPath = resolve(process.cwd(), targetDir, pathToRemove);
      if (existsSync(fullPath)) {
        try {
          rmSync(fullPath, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }

    if (useCurrentDir) {
      const { copyFile, mkdir, readdir } = await import("node:fs/promises");
      const { dirname: pathDirname, join: pathJoin } = await import("node:path");

      async function copyDir(src: string, dest: string): Promise<void> {
        const entries = await readdir(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = pathJoin(src, entry.name);
          const destPath = pathJoin(dest, entry.name);
          if (entry.isDirectory()) {
            await mkdir(destPath, { recursive: true });
            await copyDir(srcPath, destPath);
          } else {
            await mkdir(pathDirname(destPath), { recursive: true });
            await copyFile(srcPath, destPath);
          }
        }
      }

      await copyDir(tempDir, process.cwd());
      const tempPath = resolve(process.cwd(), tempDir);
      if (existsSync(tempPath)) {
        rmSync(tempPath, { recursive: true, force: true });
      }
    }

    const templateAuthor = (() => {
      const packageJsonPath = resolve(projectRoot, "package.json");
      if (!existsSync(packageJsonPath)) return "";
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { author?: string };
        return typeof pkg.author === "string" ? pkg.author : "";
      } catch {
        return "";
      }
    })();

    applyProjectReadme(projectRoot, nameForPackage, templateAuthor);
    applyNewProjectPackageJson(projectRoot, nameForPackage);

    s.stop("Cleaned up");
  } catch (error: unknown) {
    s.error("Failed to clean up");
    p.log.warn("Could not remove some directories");
    p.log.info("You can manually delete them later.");
    const message = error instanceof Error ? error.message : String(error);
    p.log.info(message);
  }

  const packageManager = detectPackageManager();
  p.log.info(`Detected package manager: ${packageManager}`);

  let shouldInstall = argv.install;
  let shouldInitGit = argv.git;

  if (argv.y) {
    shouldInstall = true;
    shouldInitGit = true;
  } else if (shouldInstall === undefined && shouldInitGit === undefined) {
    const { install, git } = await p.group(
      {
        install: () =>
          p.confirm({
            message: "Install dependencies?",
            initialValue: true,
          }),
        git: () =>
          p.confirm({
            message: "Initialize a new git repository?",
            initialValue: true,
          }),
      },
      { onCancel: () => exitCancelled() },
    );
    shouldInstall = install as boolean;
    shouldInitGit = git as boolean;
  } else {
    if (shouldInstall === undefined) {
      const installResponse = await p.confirm({
        message: "Install dependencies?",
        initialValue: true,
      });
      if (p.isCancel(installResponse)) exitCancelled();
      shouldInstall = installResponse as boolean;
    }
    if (shouldInitGit === undefined) {
      const gitResponse = await p.confirm({
        message: "Initialize a new git repository?",
        initialValue: true,
      });
      if (p.isCancel(gitResponse)) exitCancelled();
      shouldInitGit = gitResponse as boolean;
    }
  }

  if (shouldInstall) {
    s.start("Installing dependencies");
    try {
      await execa(packageManager, ["install"], {
        cwd: useCurrentDir ? process.cwd() : resolve(process.cwd(), projectName),
        stdio: "pipe",
      });
      s.stop("Dependencies installed");
    } catch (error: unknown) {
      s.error("Failed to install dependencies");
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("ENOTFOUND") || message.includes("network") || message.includes("timeout")) {
        p.log.error("Network error during installation");
        p.log.info("You can install dependencies later by running:");
        if (!useCurrentDir) {
          p.log.info(`  cd ${projectName} && ${packageManager} install`);
        } else {
          p.log.info(`  ${packageManager} install`);
        }
      } else if (message.includes("EACCES") || message.includes("permission denied")) {
        p.log.error("Permission error");
        p.log.info("Try running the command with appropriate permissions.");
      } else {
        p.log.error("Installation error:");
        p.log.info(message);
        p.log.info("You can try installing manually:");
        if (!useCurrentDir) {
          p.log.info(`  cd ${projectName} && ${packageManager} install`);
        } else {
          p.log.info(`  ${packageManager} install`);
        }
      }
      const continueResponse = await p.confirm({
        message: "Continue without installing dependencies?",
        initialValue: true,
      });
      if (p.isCancel(continueResponse) || !continueResponse) {
        p.cancel("Operation cancelled");
        process.exit(1);
      }
      shouldInstall = false;
    }
  }

  let gitInitialized = false;
  if (shouldInitGit) {
    s.start("Initializing git repository");
    try {
      const gitCwd = useCurrentDir ? process.cwd() : resolve(process.cwd(), projectName);
      await execa("git", ["init"], { cwd: gitCwd });
      await execa("git", ["add", "."], { cwd: gitCwd });
      await execa("git", ["commit", "-m", "Initial commit"], { cwd: gitCwd });
      s.stop("Git repository initialized");
      gitInitialized = true;
    } catch (error: unknown) {
      s.stop("Git initialization skipped");
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found") || message.includes("command not found")) {
        p.log.warn("Git is not installed or not in PATH.");
      } else if (message.includes("user.name") || message.includes("user.email")) {
        p.log.warn("Git user configuration is missing.");
        p.log.info('Run: git config --global user.name "Your Name"');
        p.log.info("     git config --global user.email \"you@example.com\"");
      }
    }
  }

  if (gitInitialized) {
    const connectRemoteResponse = await p.confirm({
      message: "Connect to a remote repository?",
      initialValue: false,
    });

    if (p.isCancel(connectRemoteResponse)) {
      exitCancelled();
    } else if (connectRemoteResponse) {
      const remoteUrlResponse = await p.text({
        message: "Enter the remote repository URL:",
        placeholder: "https://github.com/username/repo.git",
        validate: (value: string | undefined) => {
          if (!value) return "Remote URL is required";
          if (
            !value.startsWith("https://github.com/") &&
            !value.startsWith("git@github.com:") &&
            !value.startsWith("https://gitlab.com/") &&
            !value.startsWith("git@gitlab.com:")
          ) {
            return "Please enter a valid Github or Gitlab repository URL";
          }
        },
      });

      if (p.isCancel(remoteUrlResponse)) {
        exitCancelled();
      } else {
        const remoteUrl = remoteUrlResponse as string;
        const pushChoice = await p.select({
          message: "What would you like to do?",
          options: [
            { value: "push", label: "Add remote and push code now", hint: "runs git push" },
            { value: "connect", label: "Just add remote (don't push yet)", hint: "configure origin only" },
          ],
          initialValue: "push",
        });

        if (p.isCancel(pushChoice)) {
          exitCancelled();
        } else {
          const shouldPush = pushChoice === "push";
          s.start(shouldPush ? "Connecting and pushing to remote repository" : "Adding remote repository");
          try {
            const gitCwd = useCurrentDir ? process.cwd() : resolve(process.cwd(), projectName);
            await execa("git", ["remote", "add", "origin", remoteUrl], { cwd: gitCwd });
            await execa("git", ["branch", "-M", "main"], { cwd: gitCwd });
            if (shouldPush) {
              await execa("git", ["push", "-u", "origin", "main"], { cwd: gitCwd });
              s.stop("Connected and pushed to remote repository");
              p.log.success(`Successfully pushed to ${remoteUrl}`);
            } else {
              await execa("git", ["config", "push.autoSetupRemote", "true"], { cwd: gitCwd });
              s.stop("Remote repository added");
              p.log.success(`Remote added: ${remoteUrl}`);
              p.log.info("You can push later with: git push (auto-tracking enabled)");
            }
            replaceReadmeRepoPlaceholder(projectRoot, nameForPackage, remoteUrl);
          } catch (error: unknown) {
            s.error(shouldPush ? "Failed to connect and push" : "Failed to add remote");
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("Permission denied") || message.includes("authentication failed")) {
              p.log.error("Authentication failed");
              p.log.info("Make sure you have the correct permissions and authentication set up.");
            } else if (message.includes("Repository not found")) {
              p.log.error("Repository not found");
              p.log.info("Make sure the repository exists and the URL is correct.");
            } else if (message.includes("already exists")) {
              p.log.error("Remote 'origin' already exists");
              p.log.info("You can manually set the remote with:");
              p.log.info(`  git remote set-url origin ${remoteUrl}`);
            } else {
              p.log.error("Error:");
              p.log.info(message);
              p.log.info("\nYou can manually connect later with:");
              p.log.info(`  git remote add origin ${remoteUrl}`);
              p.log.info("  git config push.autoSetupRemote true");
              p.log.info("  git push");
            }
          }
        }
      }
    }
  }

  let editorChoice: EditorChoice = null;
  if (argv.cursor) {
    editorChoice = "cursor";
  } else if (argv.vscode) {
    editorChoice = "vscode";
  } else if (!argv.y) {
    const editorResponse = await p.select({
      message: "Open project in editor?",
      options: [
        { value: "cursor", label: "Cursor", hint: "cursor CLI" },
        { value: "vscode", label: "VS Code", hint: "code CLI" },
        { value: "skip", label: "Skip", hint: "finish here" },
      ],
      initialValue: "cursor",
    });
    if (p.isCancel(editorResponse)) {
      editorChoice = "skip";
    } else {
      editorChoice = editorResponse as EditorChoice;
    }
  }

  if (editorChoice && editorChoice !== "skip") {
    const editor = editorChoice === "vscode" ? "code" : "cursor";
    const editorName = editorChoice === "vscode" ? "VS Code" : "Cursor";
    try {
      await execa(editor, ["."], {
        cwd: useCurrentDir ? process.cwd() : resolve(process.cwd(), projectName),
      });
      p.log.success(`Opened in ${editorName}`);
    } catch (error: unknown) {
      p.log.warn(`Could not open ${editorName}`);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found") || message.includes("command not found")) {
        p.log.info(`${editorName} CLI is not installed or not in PATH.`);
        if (!useCurrentDir) {
          p.log.info(`You can open the project manually: cd ${projectName}`);
        }
      }
    }
  }

  let nextSteps = "";
  if (!useCurrentDir) {
    nextSteps += `cd ${projectName}\n`;
  }
  if (!shouldInstall) {
    nextSteps += `${packageManager} install\n`;
  }
  nextSteps += `${packageManager} run dev`;

  p.note(nextSteps, "Next steps");

  p.outro(color.green("All done!"));
}

main().catch((error: unknown) => {
  const err = error as { isCanceled?: boolean; message?: string };
  if (err.isCanceled || p.isCancel(error)) {
    exitCancelled("Operation cancelled by user");
  }
  p.log.error("An unexpected error occurred:");
  p.log.info(err.message || String(error));
  p.log.info("\nIf this issue persists, please report it at:");
  p.log.info("https://github.com/ardzero/bunpack/issues");
  process.exit(1);
});
