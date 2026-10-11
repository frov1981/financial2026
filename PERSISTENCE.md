# Persistence providers and migration

## Selecting the active provider

The application uses one provider for images and logs, selected with
`PERSISTENCE_PROVIDER`:

```env
PERSISTENCE_PROVIDER=local
```

`local` is the default and continues to use `STORAGE_PATH` (or `./storage` when
unset). To use the Firebase project's Cloud Storage bucket:

```env
PERSISTENCE_PROVIDER=firebase
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
```

The Node process must have Google Cloud Application Default Credentials with
permission to read, create, and delete objects in the bucket. Do not put service
account keys in source control. An unsupported provider or missing Firebase
bucket prevents the application from starting.

Changing the provider does not migrate any data. Migrate and verify the target
first, then change the environment setting and restart the application.

When Firebase is active, image objects are read and written through the Firebase
adapter. Structured application logs are buffered in memory and uploaded as the
current day's `logs/ssrfinan.YYYY-MM-DD.log` object every five seconds; the log
viewer reads those objects through the same persistence layer. The seven most
recent log objects are retained. A process crash or forced termination can
therefore lose log entries from the most recent flush interval. Run a single
application writer per bucket: concurrent instances would overwrite the same
daily log object. Keep local mode enabled until these tradeoffs and the
production bucket/credentials have been validated.

## Migrating persisted files

The migration command copies transaction images and `.log` files between the
local `STORAGE_PATH` and the Firebase Cloud Storage bucket. It does not change
the application's active persistence provider and does not delete the source.

## Prerequisites

- Set `STORAGE_PATH` to the local storage root when using the local provider.
- Set `FIREBASE_STORAGE_BUCKET` when either side of the migration is Firebase.
- Configure Google Cloud Application Default Credentials with access to read and
  write objects in the bucket.
- Put the application in maintenance mode and stop processes that can write
  images or logs for the duration of the migration.
- Take a backup of the source and destination before starting.

## Commands

Copy from the local host to Firebase:

```sh
npm run migrate:persistence -- --from local --to firebase
```

Copy from Firebase back to the local host:

```sh
npm run migrate:persistence -- --from firebase --to local
```

The command prints source totals, copied and already-present object counts,
verification counts, and any errors. It verifies each copied object by size and
SHA-256. Objects already present with identical content are accepted, making a
retry safe. An object with the same key but different content is reported as an
error and is not overwritten.

Review the summary and require every source object to be verified with no
errors before changing the active provider. If any item fails, the command exits
with a non-zero status; fix the cause and rerun it. Successful items are
preserved, so a retry only recopies missing objects.

The migration currently includes files under `images/` and log objects ending
in `.log` under `logs/`. It does not migrate other files, database records, or
the active provider setting. Keep the application stopped until the migration
and provider change are complete; otherwise new writes may not be included in
the copy.
