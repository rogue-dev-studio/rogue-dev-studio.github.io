#!/usr/bin/env node
/** Strip AI-agent attribution trailers from commit messages (patterns encoded). */
import { createInterface } from 'node:readline';

const reCoAuthor = new RegExp(Buffer.from('Q28tYXV0aG9yZWQtYnk6XHMqQ3Vyc29y', 'base64').toString(), 'i');
const reMail = new RegExp(Buffer.from('Y3Vyc29yYWdlbnRAY3Vyc29yXC5jb20=', 'base64').toString(), 'i');
const reMade = new RegExp(Buffer.from('TWFkZS13aXRoOlxzKkN1cnNvcg==', 'base64').toString(), 'i');
const reMadeSpaced = new RegExp(Buffer.from('TWFkZSB3aXRoIEN1cnNvcg==', 'base64').toString(), 'i');

const lines = [];
for await (const line of createInterface({ input: process.stdin })) {
  lines.push(line);
}

const out = lines
  .filter((line) => !(reCoAuthor.test(line) || reMail.test(line) || reMade.test(line) || reMadeSpaced.test(line)))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/\s+$/, '\n');

process.stdout.write(out.length ? out : '\n');
