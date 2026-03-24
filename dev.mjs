import { spawn } from 'child_process';

const args = process.argv.slice(2);
const filteredArgs = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--host') {
    filteredArgs.push('-H', args[i + 1]);
    i++;
  } else {
    filteredArgs.push(args[i]);
  }
}

const nextDev = spawn('npx', ['next', 'dev', ...filteredArgs], {
  stdio: 'inherit',
  shell: true,
});

nextDev.on('close', (code) => {
  process.exit(code);
});
