import { compile, serialize } from './src/pages/graph-reduction/graph/index.js';
import { observe } from './src/pages/graph-reduction/observer/observe.js';
import { readFileSync } from 'fs';
import readline from 'readline';

const source = readFileSync('./src/pages/graph-reduction/source.lisp', 'utf8');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'graph> '
});

console.log('Graph Reduction REPL. Type an expression or a definition to step through reduction.');
rl.prompt();

rl.on('line', (line) => {
  if (line.trim() === 'exit') process.exit(0);
  
  try {
    const fullSource = `${source}\n${line}`;
    let state = compile(fullSource);
    
    if (state.error) {
      console.log('Error:', state.error);
    } else {
      console.log('Initial:', serialize(state.graph));
      
      let i = 1;
      while (true) {
        const nextGraph = observe(state.graph);
        if (nextGraph === state.graph) {
          console.log('Stable at step', i);
          break;
        }
        state = { graph: nextGraph };
        console.log(`Step ${i}:`, serialize(state.graph));
        i++;
        if (i > 64) {
          console.log('Reached step limit');
          break;
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
  
  rl.prompt();
});
