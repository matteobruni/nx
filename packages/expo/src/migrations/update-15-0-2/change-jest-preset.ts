import {
  formatFiles,
  logger,
  ProjectConfiguration,
  readProjectConfiguration,
  stripIndents,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from '@nrwl/jest';
import { JestExecutorOptions } from '@nrwl/jest/src/executors/jest/schema';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { join } from 'path';

/**
 * Change the preset in expo's jest config
 * - remove transform and testRunner from jest config
 * - changes preset from jest-expo to react-native
 * - change to babel.config.json
 */
export default async function update(tree: Tree) {
  let useJestExpo = false;
  forEachExecutorOptions<JestExecutorOptions>(
    tree,
    '@nrwl/jest:jest',
    (options, projectName) => {
      if (options.jestConfig && tree.exists(options.jestConfig)) {
        const jestConfig = tree.read(options.jestConfig, 'utf-8');

        if (jestConfig.includes(`preset: 'jest-expo'`)) {
          const project = readProjectConfiguration(tree, projectName);
          changePreset(tree, project);
          renameBabelJson(tree, project);
          useJestExpo = true;
        }
      }
    }
  );

  if (useJestExpo) {
    removeJestExpoFromPackageJson(tree);
  }

  await formatFiles(tree);
}

function changePreset(host: Tree, project: ProjectConfiguration) {
  const jestConfigPath = project.targets?.test?.options?.jestConfig;
  if (!jestConfigPath || !host.exists(jestConfigPath)) return;
  try {
    removePropertyFromJestConfig(host, jestConfigPath, 'transform');
    removePropertyFromJestConfig(host, jestConfigPath, 'testRunner');
    removePropertyFromJestConfig(host, jestConfigPath, 'preset');
    addPropertyToJestConfig(host, jestConfigPath, 'preset', 'react-native');
  } catch {
    logger.error(
      stripIndents`Unable to update ${jestConfigPath} for project ${project.root}.`
    );
  }
}

function renameBabelJson(host: Tree, project: ProjectConfiguration) {
  const babelrcPath = join(project.root, '.babelrc');
  const babelJsonPath = join(project.root, 'babel.config.json');
  if (!host.exists(babelrcPath)) {
    return;
  }
  try {
    const buffer = host.read(babelrcPath);
    if (!buffer) {
      return;
    }
    host.write(babelJsonPath, buffer);
    host.delete(babelrcPath);
  } catch {
    logger.error(
      stripIndents`Unable to rename from ${babelrcPath} to ${babelJsonPath} for project ${project.root}.`
    );
  }
}

function removeJestExpoFromPackageJson(tree: Tree) {
  updateJson(tree, 'package.json', (packageJson) => {
    delete packageJson.devDependencies['jest-expo'];
    return packageJson;
  });
}
