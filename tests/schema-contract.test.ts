import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const sourceRoot = path.resolve('src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = path.join(directory, entry);
    return statSync(filePath).isDirectory() ? sourceFiles(filePath) : [filePath];
  }).filter((filePath) => /\.(ts|tsx)$/.test(filePath));
}

const source = sourceFiles(sourceRoot)
  .map((filePath) => readFileSync(filePath, 'utf8'))
  .join('\n');

test('application code uses the canonical approved document status', () => {
  assert.doesNotMatch(source, /['"]tamamlandi['"]/);
});

test('application code does not reference the removed payments.paid_at field', () => {
  assert.doesNotMatch(source, /\bpaid_at\b/);
});

test('staff queries do not request removed first_name and last_name fields', () => {
  assert.doesNotMatch(source, /from\(['"]staff['"]\)[\s\S]{0,160}select\([^)]*first_name/);
});
