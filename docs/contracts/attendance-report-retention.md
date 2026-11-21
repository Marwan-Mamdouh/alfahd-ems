# Attendance report retention

Completed and failed jobs in the reports queue are eligible for removal after
seven days. BullMQ performs age-based removal when subsequent jobs complete or
fail; this is not a scheduled deletion and idle queues may retain older jobs.
Operators must monitor Redis and arrange periodic cleanup if a hard deadline is
required. A later job with retention configured only cleans up older jobs in
the same terminal state: completion cleans completed jobs, and failure cleans
failed jobs. Without a later job in the same state, old jobs may remain
indefinitely even if other jobs are finishing.

Report workbooks may contain personal information. Until private report URLs and
automated cleanup are implemented, the operator must inventory and manually
purge Cloudinary assets in the `reports` folder at least every seven days,
including existing assets, and verify deletion in Cloudinary. Cloudinary report
URLs remain public to anyone who has the link until deletion; deleting a job
does not delete its workbook. Follow the provider's invalidation guidance for
cached copies. Restrict access to the Cloudinary account and avoid sharing
report URLs. For local storage, apply the same seven-day cleanup schedule to the
configured report directory; see [local report storage](local-report-storage.md).

Scheduled purge and private or signed URLs remain separate work.
