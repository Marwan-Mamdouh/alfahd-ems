import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('attendance report requires both dates but keeps other filters optional', async () => {
  const snapshot = JSON.parse(await readFile(new URL('./phase-2-openapi.json', import.meta.url)));
  const parameters = snapshot.paths['/attendance/report'].get.parameters;
  const required = Object.fromEntries(parameters.map(({ name, required }) => [name, required]));

  assert.deepEqual(required, { from: true, to: true, department: false, employee_id: false });
  assert.deepEqual(parameters.map(({ name }) => name), ['from', 'to', 'department', 'employee_id']);
  for (const name of ['from', 'to']) {
    const parameter = parameters.find((item) => item.name === name);
    assert.match(parameter.description, /ISO 8601/);
    assert.match(parameter.description, /366 days/);
    assert.match(parameter.example, /^\d{4}-\d{2}-\d{2}$/);
  }
  const department = parameters.find((item) => item.name === 'department');
  assert.deepEqual(department.schema.enum, ['TECHNICAL', 'CUSTOMER_SERVICE', 'WAREHOUSE', 'MANAGEMENT']);
  const employee = parameters.find((item) => item.name === 'employee_id');
  assert.equal(employee.schema.format, 'uuid');
  assert.match(employee.description, /UUID v4/);
  const description = snapshot.paths['/attendance/report'].get.responses['400'].description;
  assert.match(description, /fail ISO 8601 validation or cannot be parsed/);
  assert.match(description, /DATE_RANGE_EXCEEDS_MAXIMUM/);
  assert.match(description, /unsupported department/);
  assert.match(description, /employee_id that is not a UUID v4/);
});

test('checked-in snapshot matches the generator output', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'phase-2-openapi-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const generator = join(directory, 'generate-phase-2-openapi.mjs');
  await copyFile(new URL('./generate-phase-2-openapi.mjs', import.meta.url), generator);
  execFileSync(process.execPath, [generator]);
  const generated = await readFile(join(directory, 'phase-2-openapi.json'));
  const snapshot = await readFile(new URL('./phase-2-openapi.json', import.meta.url));
  assert.deepEqual(generated, snapshot);
});
