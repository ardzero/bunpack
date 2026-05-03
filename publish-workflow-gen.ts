import packageJson from "./package.json"
const workflowConfig = {
    workflowName: `Publish ${packageJson.name} to npm`,
    // branches to watch for changes to trigger the workflow
    watchBranches: ["main"],
    // paths to watch for changes to trigger the workflow
    watchPaths: [
        "cli.ts",
        "package.json",
        "bun.lock",
        "README.md",
        ".github/workflows/publish-package.yml"
    ],
    nodeVersion: "24",
    workflowFilename: "publish-package.yml",
    environmentName: "npm",
}
