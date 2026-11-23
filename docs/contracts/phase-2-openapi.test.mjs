import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('attendance list metadata and employee photo boundary remain curated correctly', async () => {
  const snapshot = JSON.parse(await readFile(new URL('./phase-2-openapi.json', import.meta.url)));
  assert.match(snapshot.info.description, /1ab7655dbf3571efc704e4707fc4af63820171b2/);
  const operation = snapshot.paths['/attendance'].get;
  const params = Object.fromEntries(operation.parameters.map((p) => [p.name, p]));
  assert.deepEqual(Object.keys(params), ['from', 'to', 'employee_id', 'department', 'status', 'page', 'pageSize']);
  for (const name of ['from', 'to']) {
    assert.equal(params[name].required, false);
    assert.equal(params[name].schema.format, 'date');
    assert.match(params[name].description, /Inclusive local work date/);
  }
  assert.match(params.employee_id.description, /UUID v4/);
  assert.deepEqual(params.page.schema, { type: 'integer', minimum: 1, default: 1, maximum: 2147483647 });
  assert.deepEqual(params.pageSize.schema, { type: 'integer', minimum: 1, maximum: 100, default: 20 });
  const wrapper = operation.responses['200'].content['application/json'].schema;
  assert.deepEqual(wrapper.required, ['data']);
  assert.equal(wrapper.properties.data.$ref, '#/components/schemas/AttendanceList');
  const list = snapshot.components.schemas.AttendanceList;
  assert.deepEqual(list.required, ['items', 'page', 'pageSize', 'filteredTotal', 'totals']);
  for (const name of ['page', 'pageSize', 'filteredTotal']) assert.equal(list.properties[name].type, 'integer');
  for (const name of ['total', 'onTime', 'late']) assert.equal(list.properties.totals.properties[name].type, 'integer');
  assert.deepEqual(list.properties.totals.required, ['total', 'onTime', 'late']);
  const item = snapshot.components.schemas.AttendanceListItem;
  assert.deepEqual(item.required, ['id', 'userId', 'employeeName', 'department', 'workDate', 'checkInAt', 'checkOutAt', 'checkInDistanceM', 'hoursWorked', 'status', 'overrideReason', 'overriddenBy', 'overriddenAt']);
  assert.deepEqual(item.properties.department.enum, ['TECHNICAL', 'CUSTOMER_SERVICE', 'WAREHOUSE', 'MANAGEMENT', null]);
  assert.equal(item.properties.department.nullable, true);
  for (const name of ['checkInAt', 'checkOutAt', 'overriddenAt']) assert.equal(item.properties[name].format, 'date-time');
  for (const name of ['checkOutAt', 'overriddenAt']) assert.equal(item.properties[name].nullable, true);
  assert.deepEqual(item.properties.checkOutAt, { type: 'string', format: 'date-time', nullable: true });
  assert.ok('profilePhotoKey' in snapshot.components.schemas.Employee.properties);
  assert.ok(!('photoUrl' in snapshot.components.schemas.Employee.properties));
  assert.deepEqual(snapshot.components.schemas.PhotoUpload.required, ['profilePhotoKey', 'url']);
});

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
