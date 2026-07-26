export const store = {
  job: null,
  selectedClipId: null,
  pollTimer: null,
  uploadController: null,
  publishKey: null,
  currentJobId: null,
  renderSignatures: {},
  clipDrafts: {},
  layoutDraft: null,
  metadataDrafts: {},
  dirtySections: new Set(),
  story: null,
  carousel: null,
  selectedCarouselSlideId: null,
  setJob(job) {
    if (job?.id && this.currentJobId !== job.id) {
      this.currentJobId = job.id;
      this.renderSignatures = {};
      this.clipDrafts = {};
      this.layoutDraft = null;
      this.metadataDrafts = {};
      this.dirtySections.clear();
    }
    this.job = job;
    if (!job?.clips?.some((clip) => clip.id === this.selectedClipId)) {
      this.selectedClipId = job?.clips?.find((clip) => clip.files?.video)?.id ?? null;
    }
  },
  shouldRender(section, signature) {
    if (this.renderSignatures[section] === signature) return false;
    this.renderSignatures[section] = signature;
    return true;
  },
  invalidateRender(section) {
    delete this.renderSignatures[section];
  },
  markDirty(section) {
    this.dirtySections.add(section);
  },
  markClean(section) {
    this.dirtySections.delete(section);
  },
  isDirty(section) {
    return this.dirtySections.has(section);
  },
  hasUnsavedChanges() {
    return this.dirtySections.size > 0;
  },
  clearPolling() {
    clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }
};
