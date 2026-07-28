function publicApproval(approval) {
  if (!approval) return null;
  return {
    status: approval.status,
    approvedAt: approval.approvedAt ?? null,
    approvedRevision: approval.approvedRevision ?? null
  };
}

export function sanitizePublicMessage(value, max = 500) {
  return String(value ?? '')
    .replace(/\b[A-Za-z]:[\\/][^\s"'<>]+/g, '[ruta privada]')
    .replace(/\\\\[^\\\s]+\\[^\s"'<>]+/g, '[ruta privada]')
    .replace(/\/(?:Users|home|tmp|var)\/[^\s"'<>]+/g, '[ruta privada]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/access_token=([^&\s]+)/gi, 'access_token=[redacted]')
    .replace(/\0/g, '')
    .trim()
    .slice(0, max);
}

function publicArtifact(artifact) {
  if (!artifact) return null;
  return {
    status: artifact.status,
    sha256: artifact.sha256,
    revision: artifact.revision,
    generatedAt: artifact.generatedAt,
    durationSeconds: artifact.durationSeconds,
    codec: artifact.codec,
    channels: artifact.channels,
    sampleRate: artifact.sampleRate,
    importedAt: artifact.importedAt,
    approval: publicApproval(artifact.approval)
  };
}

function publicReview(review) {
  if (!review) return null;
  return {
    status: review.status,
    revision: review.revision,
    qa: review.qa
      ? {
          status: review.qa.status,
          passed: review.qa.passed,
          checkedAt: review.qa.checkedAt
        }
      : null,
    approval: publicApproval(review.approval)
  };
}

export function episodeSummaryDto(manifest) {
  return {
    id: manifest.id,
    channelId: manifest.channelId,
    title: manifest.title,
    status: manifest.status,
    revision: manifest.revision,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
    progress: {
      ...structuredClone(manifest.progress),
      message: sanitizePublicMessage(manifest.progress.message)
    },
    warningCount: manifest.warnings.length
  };
}

export function episodePublicDto(manifest) {
  return {
    ...episodeSummaryDto(manifest),
    version: manifest.version,
    research: publicArtifact(manifest.research),
    story: publicArtifact(manifest.story),
    narration: publicArtifact(manifest.narration),
    transcript: publicArtifact(manifest.transcript),
    visualPlan: publicArtifact(manifest.visualPlan),
    review: publicReview(manifest.review),
    renders: {
      preview: publicArtifact(manifest.renders.preview),
      final: publicArtifact(manifest.renders.final)
    },
    publishing: {
      status: manifest.publishing.status,
      package: publicArtifact(manifest.publishing.package),
      confirmation: {
        status: manifest.publishing.confirmation.status,
        confirmedAt: manifest.publishing.confirmation.confirmedAt
      }
    },
    warnings: manifest.warnings.map((warning) => ({
      code: warning.code,
      message: sanitizePublicMessage(warning.message),
      stage: warning.stage,
      createdAt: warning.createdAt
    }))
  };
}
