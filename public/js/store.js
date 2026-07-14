export const store = {
  job: null,
  selectedClipId: null,
  pollTimer: null,
  uploadController: null,
  publishKey: null,
  story: null,
  setJob(job) {
    this.job = job;
    if (!job?.clips?.some((clip) => clip.id === this.selectedClipId)) {
      this.selectedClipId = job?.clips?.find((clip) => clip.files?.video)?.id ?? null;
    }
  },
  clearPolling() {
    clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }
};
