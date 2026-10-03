export const SESSION_EXPIRED_EVENT = "fahd:session-expired";

/**
 * Cross-tab invalidation channel.
 *
 * A `storage` event cannot be used for this: with no token written to
 * `localStorage` there is no storage write, so no storage event is ever emitted
 * and a `storage` listener would silently never fire.
 */
export const AUTH_CHANNEL = "fahd-auth";

/** Payload broadcast to sibling tabs when this tab's session ends. */
export const SESSION_INVALIDATED_MESSAGE = "session-invalidated";
