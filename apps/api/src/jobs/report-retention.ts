// BullMQ applies age-based cleanup when a later job completes or fails.
const retentionAgeSeconds = 7 * 24 * 60 * 60;

export const reportRetentionOptions = {
  removeOnComplete: { age: retentionAgeSeconds },
  removeOnFail: { age: retentionAgeSeconds },
};
