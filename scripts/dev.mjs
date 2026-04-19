import chalk from 'chalk';
import dotenv from 'dotenv';
import { execa } from 'execa';
import fs from 'fs';
import inquirer from 'inquirer';

const environments = ['sit', 'uat', 'prod'];

inquirer
  .prompt([
    {
      type: 'select',
      name: 'environment',
      message: '请选择运行环境:',
      choices: environments,
    },
  ])
  .then(async (answers) => {
    const { environment } = answers;
    const envFilePath = `.env.${environment}`;

    if (fs.existsSync(envFilePath)) {
      const envConfig = dotenv.parse(fs.readFileSync(envFilePath));
      console.log(chalk.blue(`Environment from ${envFilePath}:`));
      for (const key in envConfig) {
        console.log(chalk.bold.greenBright(`${key}=${envConfig[key]}`));
      }
    } else {
      console.error(chalk.red(`Environment file ${envFilePath} does not exist`));
      return;
    }

    const command = `env-cmd -f ${envFilePath} next dev -p 4000`;
    console.log(`Running ${command}`);

    try {
      const subprocess = execa(command, { shell: true });
      subprocess.stdout.on('data', (data) => console.log(data.toString()));
      subprocess.stderr.on('data', (data) =>
        console.error(chalk.red(data.toString()))
      );
      await subprocess;
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  });
