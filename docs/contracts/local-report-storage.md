# Local report storage fallback

To use local disk for Excel reports, set `REPORT_STORAGE_PROVIDER=local` and set
`REPORT_STORAGE_DIR` to a persistent, access-restricted directory. This affects reports only;
employee photos still use their existing storage provider, and production Cloudinary validation
remains unchanged. When the option is absent, reports use the existing storage provider.
On Unix, newly created report directories and files use modes `0700` and `0600`, respectively.
Operators must restrict permissions on pre-existing directories themselves; filesystem ACLs and
Windows permissions must likewise prevent access by untrusted local users.

Report jobs return an authenticated `/jobs/:id/download` URL. The route requires the same
requester-or-admin authorization as job polling and serves Excel with a download filename and
`Cache-Control: private, no-store`. Files have random server-generated names, never client paths.
The returned path is relative to the API origin, not the dashboard origin. Dashboard clients must
fetch it through their authenticated `/api` client (for example, Axios with `responseType: 'blob'`),
which adds the bearer token and applies the `/api/*` rewrite; navigating directly to the returned
path will not send the in-memory bearer token and bypasses the dashboard rewrite.

Local storage is a temporary, single-instance fallback. Multiple API/worker instances require
the same shared persistent directory; ephemeral containers lose reports on restart. Operators
must arrange a retention/cleanup job consistent with the report-job retention policy. Removing a
file makes subsequent downloads return 404. No automatic file cleanup is provided.
