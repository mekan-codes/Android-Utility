const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const cliArgs = new Set(process.argv.slice(2));

function getMobilePaths(rootDir) {
  return {
    mobileRoot: rootDir,
    androidRoot: path.join(rootDir, "android"),
    outputApk: path.join(
      rootDir,
      "android",
      "app",
      "build",
      "outputs",
      "apk",
      "release",
      "app-release.apk",
    ),
  };
}

function sanitizeFileName(value) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-");
}

function readAppConfig(rootDir = projectRoot) {
  const raw = fs.readFileSync(path.join(rootDir, "app.json"), "utf8");
  const parsed = JSON.parse(raw);
  return parsed.expo ?? {};
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command exited with code ${code ?? "unknown"}`));
    });
  });
}

function shouldCopyMobileEntry(sourceRoot, source) {
  const rel = path.relative(sourceRoot, source).replace(/\\/g, "/");
  if (rel === "") return true;

  const topLevel = rel.split("/")[0];
  if (
    topLevel === ".expo" ||
    topLevel === "dist" ||
    topLevel === "static-build" ||
    topLevel === "apk-inspect" ||
    topLevel === "apk-icon-check" ||
    topLevel === "generated-icons" ||
    topLevel === "bundle-cyclefix" ||
    topLevel === "bundle-polishfix" ||
    topLevel === "bundle-test" ||
    topLevel === "bundle-test2" ||
    topLevel === "node_modules"
  ) {
    return false;
  }

  if (
    rel.startsWith("android/.gradle/") ||
    rel.startsWith("android/app/build/") ||
    rel.startsWith("android/app/.cxx/") ||
    rel.startsWith("android/build/")
  ) {
    return false;
  }

  return !rel.endsWith(".apk") && !rel.endsWith(".idsig");
}

function resolveInstalledVersion(packageName) {
  const packageJsonPath = path.join(projectRoot, "node_modules", packageName, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Cannot resolve installed version for ${packageName}`);
  }

  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version;
}

function sanitizePackageJsonForNpm(packageJson) {
  const next = JSON.parse(JSON.stringify(packageJson));
  next.name = "resetflow-mobile-stage";

  for (const sectionName of ["dependencies", "devDependencies"]) {
    const section = next[sectionName];
    if (!section) continue;

    for (const [name, version] of Object.entries(section)) {
      if (version === "catalog:") {
        section[name] = resolveInstalledVersion(name);
      }
    }
  }

  if (next.dependencies && next.devDependencies) {
    for (const dependencyName of Object.keys(next.dependencies)) {
      if (dependencyName in next.devDependencies) {
        delete next.devDependencies[dependencyName];
      }
    }
  }

  return next;
}

async function createShortMobileProject() {
  if (process.platform !== "win32") {
    return { rootDir: projectRoot, cleanup: async () => {} };
  }

  const stagingRoot = path.join(path.parse(projectRoot).root, `m${process.pid}`);
  fs.rmSync(stagingRoot, { recursive: true, force: true });

  fs.cpSync(projectRoot, stagingRoot, {
    recursive: true,
    filter: (source) => shouldCopyMobileEntry(projectRoot, source),
  });

  const packageJsonPath = path.join(stagingRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const sanitizedPackageJson = sanitizePackageJsonForNpm(packageJson);
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(sanitizedPackageJson, null, 2)}\n`);

  return {
    rootDir: stagingRoot,
    cleanup: async () => {
      try {
        fs.rmSync(stagingRoot, { recursive: true, force: true });
      } catch {}
    },
  };
}

function getBaseEnv() {
  return {
    ...process.env,
  };
}

function getInstallEnv() {
  return {
    ...getBaseEnv(),
    NODE_ENV: process.env.NODE_ENV || "development",
  };
}

function getBuildEnv() {
  return {
    ...getBaseEnv(),
    NODE_ENV: process.env.NODE_ENV || "production",
  };
}

async function installStageDependencies(stageRoot) {
  const args = ["install", "--include=dev", "--legacy-peer-deps", "--no-fund", "--no-audit"];
  if (process.platform === "win32") {
    await runCommand("cmd.exe", ["/d", "/s", "/c", npmCommand, ...args], {
      cwd: stageRoot,
      env: getInstallEnv(),
    });
    return;
  }

  await runCommand(npmCommand, args, {
    cwd: stageRoot,
    env: getInstallEnv(),
  });
}

function runGradle(tasks, androidRoot) {
  if (process.platform === "win32") {
    return runCommand("cmd.exe", ["/d", "/s", "/c", "gradlew.bat", ...tasks], {
      cwd: androidRoot,
      env: getBuildEnv(),
    });
  }

  return runCommand("./gradlew", tasks, {
    cwd: androidRoot,
    env: getBuildEnv(),
  });
}

async function main() {
  const expoConfig = readAppConfig();
  const appName = sanitizeFileName(expoConfig.name ?? "app");
  const versionName = expoConfig.version ?? "0.0.0";
  const versionCode = expoConfig.android?.versionCode ?? 0;
  const tasks = cliArgs.has("--clean")
    ? ["clean", "assembleRelease"]
    : ["assembleRelease"];
  const keepStage = cliArgs.has("--keep-stage");
  const stagedProject = await createShortMobileProject();
  const buildPaths = getMobilePaths(stagedProject.rootDir);

  try {
    if (stagedProject.rootDir !== projectRoot) {
      console.log(`Using short build path: ${stagedProject.rootDir}`);
    }

    console.log("Installing staged mobile dependencies with npm...");
    await installStageDependencies(stagedProject.rootDir);

    console.log(`Building Android release APK (${tasks.join(" ")})...`);
    await runGradle(tasks, buildPaths.androidRoot);

    if (!fs.existsSync(buildPaths.outputApk)) {
      throw new Error(`APK not found at ${buildPaths.outputApk}`);
    }

    const distDir = path.join(projectRoot, "dist");
    fs.mkdirSync(distDir, { recursive: true });

    const versionedName = `${appName}-${versionName}-${versionCode}-release.apk`;
    const versionedPath = path.join(distDir, versionedName);
    const latestPath = path.join(distDir, `${appName}-latest.apk`);

    fs.copyFileSync(buildPaths.outputApk, versionedPath);
    fs.copyFileSync(buildPaths.outputApk, latestPath);

    console.log(`APK ready: ${versionedPath}`);
    console.log(`Latest copy: ${latestPath}`);
    console.log("Note: the current Gradle config signs release builds with the debug keystore.");
  } finally {
    if (keepStage) {
      console.log(`Keeping staged project at: ${stagedProject.rootDir}`);
    } else {
      await stagedProject.cleanup();
    }
  }
}

main().catch((error) => {
  console.error(`APK build failed: ${error.message}`);
  process.exit(1);
});
