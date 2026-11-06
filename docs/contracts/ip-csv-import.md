# IP CSV import

Admins submit a UTF-8 CSV file to `POST /ip-addresses/import` as multipart field `file`.
An optional UTF-8 BOM is ignored. The header must contain `address`; `notes` is optional.
Other columns are ignored and cannot set server-owned fields. New addresses are FREE,
unarchived, and have no customer. Address and notes fields are trimmed. This parser treats
commas as field separators; quoted fields containing commas or newlines are not supported.

The limit is 5 MiB and 5,000 nonblank data rows. Blank lines are ignored; error row numbers
refer to physical lines in the original file, including the header and blank lines. Example:

```csv
address,notes
192.0.2.1,Example address
192.0.2.2,
```

Submission returns `{ jobId }`. Requester/admin job polling returns inserted and skipped counts
and errors containing `row`, `address`, and a client-safe `reason`. Duplicate addresses are
skips. Each valid row's outcome is stored in PostgreSQL by job ID and physical row number;
insertion, creation history and the outcome commit together. Errors are logged server-side
and stored without database details. Completed row outcomes remain stable across job retries.
The outcome ledger currently has no automatic retention policy; operators should include it
in their database-retention planning and avoid pruning entries while jobs can still be retried.
