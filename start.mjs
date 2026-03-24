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

const nextStart = spawn('npx', ['next', 'start', ...filteredArgs], {
  stdio: 'inherit',
  shell: true,
});

nextStart.on('close', (code) => {
  process.exit(code);
});
