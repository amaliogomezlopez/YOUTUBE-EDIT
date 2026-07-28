# Shortsmith production architecture

## Objective

Shortsmith remains a local-first Node.js application, but long-running work is separated from HTTP requests. Every external or expensive operation is resumable, cancellable where the underlying tool permits it, and persisted before side effects.

## Runtime boundaries

1. The HTTP server validates input, streams uploads to temporary files and returns job identifiers.
2. The persistent job queue owns concurrency, retries, cancellation and restart recovery.
3. The pipeline owns deterministic stage transitions and writes progress into `job.json`.
4. FFmpeg, STT and LLM adapters receive an `AbortSignal`, bounded output and stage-specific timeouts.
5. Publishers persist a run before contacting a platform. Upload sessions and remote processing IDs are saved so work can reconcile after a restart.
6. The browser only calls local `/api/*` endpoints. It renders queue and publishing state, and requires a human confirmation before publication.
7. A single-instance lock prevents two servers from mutating the same queue files. Scheduled work is persisted as `runAfter` and recovered on startup.
8. Investigated editorial episodes use a channel-neutral domain module. Their
   manifest is revisioned and atomic, while channel identity and policy remain
   versioned configuration under `channels/`.

## Job state contract

Jobs use these top-level lifecycle states:

- `queued`
- `probing`
- `detecting-webcam`
- `transcribing`
- `generating-metadata`
- `scoring`
- `rendering`
- `done`
- `cancel_requested`
- `cancelled`
- `failed`

Additional queue metadata is stored under `queue`: attempt, maximum attempts, position, enqueued time, start time, completion time and retryability. `progress` contains the current stage, completed units, total units and a safe user-facing message.

## Upload contract

- Multipart files are parsed as streams and written directly to `data/uploads` using server-generated UUID names.
- Video and transcript limits are independent.
- Partial files are removed on limit, disconnect, parser error or after the job has copied its inputs.
- Local paths remain the preferred zero-copy input for multi-gigabyte recordings.
- Remote deployments reject local source paths unless they are descendants of `SHORTSMITH_ALLOWED_MEDIA_ROOTS`.
- The browser reports upload progress and can abort the request.
- Disk reserve is checked before accepting or copying large input. Cleanup is previewable and never deletes jobs unless retention is explicitly enabled.

## Media and transcription contract

- Automatic PIP is selected only when webcam detection crosses a confidence threshold.
- No detection is a valid result and falls back to `fit`, never to an invented webcam box.
- A manual normalized webcam box can override detection and is persisted with the job.
- Long audio is split into bounded chunks. Segment timestamps are rebased and overlap is deduplicated.
- Temporary frames and audio chunks are removed in `finally` blocks.

## Publishing contract

- YouTube uses resumable sessions and streams fixed-size chunks from disk.
- TikTok upload is chunked and its `publish_id` is polled until a terminal state or a persisted timeout.
- Every publish request has an idempotency key.
- Progress and remote identifiers are persisted without tokens.
- A restart can reconcile sessions already in `uploading` or `processing`.
- If a connector cannot prove whether a remote create completed, it returns `requires_manual_action` instead of risking a duplicate.

## Security boundary

- Localhost is the default trust boundary. Non-loopback binding requires a strong `SHORTSMITH_AUTH_TOKEN` and deployment behind HTTPS.
- Mutations require authentication when configured, an allowed host/origin, a same-site request and `x-shortsmith-csrf: 1`.
- Responses use CSP, frame denial, MIME sniffing protection and no-store for API data.
- Public job DTOs expose progress and official identifiers, but remove local paths, queue payloads, stacks, tokens and resumable upload URLs.
- All backend HTTP calls use bounded timeouts and propagate cancellation.

## Verification gates

- Unit tests for parsers, queue transitions, retry policy, timestamp rebasing and upload offsets.
- HTTP integration tests for streaming upload, cancel/retry/rerender routes, Range requests and security boundaries.
- FFmpeg smoke tests for crop, fit, PIP, manual in/out and cancellation.
- Dashboard tests for long text, empty state, network errors and repeated actions.
- No test performs a real external publication.

## Editorial episode boundary

- `src/modules/editorial-video/` may reuse shared adapters, but shared
  libraries never import a concrete channel.
- `channels/<channel-id>/` stores brand, policy and prompts; runtime evidence
  and media stay under ignored `data/channels/`.
- Every manifest update requires the current revision. Public DTOs omit local
  files, queue payloads, provider errors and publication idempotency keys.
- Expensive editorial stages use `PersistentJobQueue`; no second queue,
  server, LLM, STT or Remotion project is introduced.
