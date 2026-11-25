# Mutation testing (StrykerJS, command runner)

Stryker is not a project dependency. Install it beside the repo and run from `apps/extension`:

    mkdir -p /tmp/stryker && cd /tmp/stryker && npm i @stryker-mutator/core typescript@5
    cd <repo>/apps/extension && /tmp/stryker/node_modules/.bin/stryker run <repo>/qa/tools/mutation/cfg-errors.json

The configs mutate one source file each and run the named node:test files per mutant (the QA tests bundle `src/**` with esbuild at run time, so the mutated sandbox copy is what they exercise). Reports are written to `/tmp/stryker/report-*.json`; edit the `jsonReporter.fileName` / `tempDirName` paths if /tmp is not suitable.
