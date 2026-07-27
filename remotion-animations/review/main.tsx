import {Player, PlayerRef} from "@remotion/player";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {createRoot} from "react-dom/client";
import {
  ContextualPatternPreview,
  ContextualPreviewProps,
  ExtendedPatternProps,
  ExtendedPatternScene,
} from "../src/motion/ExtendedPatterns";
import {
  MOTION_FORMATS,
  MotionFormat,
  MotionProfileId,
  MotionThemeId,
} from "../src/motion/DesignSystem";

type ReviewVariant = {
  id: string;
  label: string;
  compositionId: string;
  props: ExtendedPatternProps;
};

type ReviewComment = {
  id: string;
  variantId: string;
  frame: number;
  category: string;
  text: string;
  resolved: boolean;
  createdAt: string;
};

type ReviewSession = {
  id: string;
  title: string;
  projectId: string;
  status: "draft" | "in-review" | "changes-requested" | "approved";
  revision: number;
  selectedVariantId: string;
  variants: ReviewVariant[];
  comments: ReviewComment[];
  checkpoints: number[];
  context: {
    sourceVideo: string | null;
    trimBeforeSeconds: number;
    mode: "overlay" | "picture-in-picture" | "replace";
  };
  qa: {
    score: number;
    passed: boolean;
    issues: Array<{
      severity: string;
      code: string;
      message: string;
      field: string;
    }>;
  } | null;
};

type CatalogResponse = {
  sessions: Array<Pick<
    ReviewSession,
    "id" | "title" | "status" | "selectedVariantId" | "revision"
  >>;
};

const API_TIMEOUT_MS = 12_000;
const DURATION_IN_FRAMES = 8 * 60;
const FPS = 60;

const PurePatternPreview: React.FC<ContextualPreviewProps> = (props) => (
  <ExtendedPatternScene {...props} />
);

async function api<T>(
  url: string,
  options: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(), API_TIMEOUT_MS);
  const abort = () => timeout.abort();
  signal?.addEventListener("abort", abort, {once: true});
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "content-type": "application/json",
        "x-shortsmith-csrf": "1",
        ...options.headers,
      },
      signal: timeout.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Error HTTP ${response.status}`);
    }
    return payload as T;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

const sessionFromUrl = () =>
  new URLSearchParams(window.location.search).get("session");

const setSessionInUrl = (sessionId: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set("session", sessionId);
  window.history.replaceState(null, "", url);
};

const formatFrame = (frame: number) => {
  const seconds = Math.max(0, frame) / FPS;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder
    .toFixed(2)
    .padStart(5, "0")}`;
};

const App: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [frame, setFrame] = useState(0);
  const [contextEnabled, setContextEnabled] = useState(false);
  const [comment, setComment] = useState("");
  const [commentCategory, setCommentCategory] = useState("layout");
  const [statusMessage, setStatusMessage] = useState("Cargando Review Studio…");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applySession = useCallback((updated: ReviewSession) => {
    setSession(updated);
    setCatalog((current) => {
      if (!current) return current;
      const summary = {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        selectedVariantId: updated.selectedVariantId,
        revision: updated.revision,
      };
      const exists = current.sessions.some((item) => item.id === updated.id);
      return {
        ...current,
        sessions: exists
          ? current.sessions.map((item) =>
              item.id === updated.id ? summary : item,
            )
          : [summary, ...current.sessions],
      };
    });
  }, []);

  const loadSession = useCallback(async (id: string, signal?: AbortSignal) => {
    const loaded = await api<ReviewSession>(
      `/api/remotion-review/sessions/${encodeURIComponent(id)}`,
      {},
      signal,
    );
    applySession(loaded);
    setSessionInUrl(loaded.id);
    setStatusMessage(`Revisión cargada: ${loaded.title}`);
    setError(null);
  }, [applySession]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const nextCatalog = await api<CatalogResponse>(
          "/api/remotion-review/catalog",
          {},
          controller.signal,
        );
        setCatalog(nextCatalog);
        const requested = sessionFromUrl();
        const first = requested ?? nextCatalog.sessions[0]?.id;
        if (first) {
          await loadSession(first, controller.signal);
          return;
        }
        const created = await api<ReviewSession>(
          "/api/remotion-review/sessions",
          {
            method: "POST",
            body: JSON.stringify({
              projectId: "motion-library",
              title: "Primera revisión de la librería animada",
            }),
          },
          controller.signal,
        );
        applySession(created);
        setSessionInUrl(created.id);
        setStatusMessage("Se ha creado la primera revisión.");
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar Review Studio.",
          );
        }
      }
    };
    load();
    return () => controller.abort();
  }, [loadSession]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const initialFrame = Math.round(
      (session?.checkpoints[0] ?? 0.08) * (DURATION_IN_FRAMES - 1),
    );
    player.seekTo(initialFrame);
    setFrame(initialFrame);
    const onFrame = (event: {detail: {frame: number}}) =>
      setFrame(event.detail.frame);
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [session?.id, session?.selectedVariantId, contextEnabled]);

  const selectedVariant = useMemo(
    () =>
      session?.variants.find(
        (variant) => variant.id === session.selectedVariantId,
      ) ?? null,
    [session],
  );
  const format = MOTION_FORMATS[
    (selectedVariant?.props.format ?? "landscape") as MotionFormat
  ];
  const contextualProps = useMemo<ContextualPreviewProps | null>(() => {
    if (!session || !selectedVariant) return null;
    return {
      ...selectedVariant.props,
      sourceVideo: session.context.sourceVideo ?? undefined,
      contextMode: session.context.mode,
      sourceOpacity: 0.52,
      trimBeforeSeconds: session.context.trimBeforeSeconds,
      showSafeZones: true,
    };
  }, [selectedVariant, session]);

  const mutateSession = async (
    patch: Record<string, unknown>,
    message: string,
  ) => {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api<ReviewSession>(
        `/api/remotion-review/sessions/${encodeURIComponent(session.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({revision: session.revision, ...patch}),
        },
      );
      applySession(updated);
      setStatusMessage(message);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "No se pudo guardar el cambio.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateProps = (patch: Partial<ExtendedPatternProps>) =>
    mutateSession(
      {
        variantId: selectedVariant?.id,
        variantProps: patch,
      },
      "Cambios de diseño guardados.",
    );

  const createSession = async () => {
    setSaving(true);
    try {
      const created = await api<ReviewSession>(
        "/api/remotion-review/sessions",
        {
          method: "POST",
          body: JSON.stringify({
            projectId: "motion-library",
            title: `Revisión ${new Date().toLocaleDateString("es-ES")}`,
          }),
        },
      );
      applySession(created);
      setSessionInUrl(created.id);
      setStatusMessage("Nueva revisión creada.");
      setError(null);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear la revisión.",
      );
    } finally {
      setSaving(false);
    }
  };

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session || !selectedVariant || !comment.trim()) return;
    setSaving(true);
    try {
      const updated = await api<ReviewSession>(
        `/api/remotion-review/sessions/${encodeURIComponent(session.id)}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            variantId: selectedVariant.id,
            frame,
            category: commentCategory,
            text: comment,
          }),
        },
      );
      applySession(updated);
      setComment("");
      setStatusMessage(`Comentario guardado en ${formatFrame(frame)}.`);
      setError(null);
    } catch (commentError) {
      setError(
        commentError instanceof Error
          ? commentError.message
          : "No se pudo guardar el comentario.",
      );
    } finally {
      setSaving(false);
    }
  };

  const runQa = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const updated = await api<ReviewSession>(
        `/api/remotion-review/sessions/${encodeURIComponent(session.id)}/qa`,
        {method: "POST", body: "{}"},
      );
      applySession(updated);
      setStatusMessage(
        updated.qa?.passed
          ? `QA superado con ${updated.qa.score}/100.`
          : `QA pendiente: ${updated.qa?.score ?? 0}/100.`,
      );
      setError(null);
    } catch (qaError) {
      setError(
        qaError instanceof Error ? qaError.message : "No se pudo ejecutar QA.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!session || !selectedVariant || !contextualProps) {
    return (
      <main className="loading-shell">
        <div className="loading-mark" />
        <p>{error ?? statusMessage}</p>
      </main>
    );
  }

  const visibleComments = session.comments.filter(
    (item) => item.variantId === selectedVariant.id,
  );
  const PlayerComponent = contextEnabled
    ? ContextualPatternPreview
    : PurePatternPreview;

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div>
          <p className="eyebrow">SHORTSMITH / REMOTION</p>
          <h1>Review Studio</h1>
        </div>
        <div className="header-actions">
          <span className={`status-pill status-${session.status}`}>
            {session.status}
          </span>
          <button
            className="button button-secondary"
            disabled={saving}
            onClick={createSession}
            type="button"
          >
            Nueva revisión
          </button>
        </div>
      </header>

      <div className="studio-grid">
        <aside className="rail panel" aria-label="Revisiones y variantes">
          <div className="panel-heading">
            <span>Revisiones</span>
            <span>{catalog?.sessions.length ?? 0}</span>
          </div>
          <nav className="session-list">
            {catalog?.sessions.map((item) => (
              <button
                className={`session-button ${item.id === session.id ? "is-active" : ""}`}
                key={item.id}
                onClick={() => loadSession(item.id)}
                type="button"
              >
                <span>{item.title}</span>
                <small>{item.status}</small>
              </button>
            ))}
          </nav>
          <div className="panel-heading variants-heading">
            <span>Variantes</span>
            <span>{session.variants.length}</span>
          </div>
          <div className="variant-list">
            {session.variants.map((variant) => (
              <button
                className={`variant-button ${variant.id === selectedVariant.id ? "is-active" : ""}`}
                key={variant.id}
                onClick={() =>
                  mutateSession(
                    {selectedVariantId: variant.id},
                    `Variante ${variant.label} seleccionada.`,
                  )
                }
                type="button"
              >
                <span className="variant-index">
                  {variant.label.slice(0, 1)}
                </span>
                <span>
                  {variant.label}
                  <small>{variant.props.themeId}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="canvas-column">
          <div className="canvas-toolbar panel">
            <div className="toolbar-group">
              <button
                className="icon-button"
                onClick={() => playerRef.current?.toggle()}
                type="button"
              >
                Play / Pausa
              </button>
              <span className="timecode">{formatFrame(frame)}</span>
            </div>
            <div className="toolbar-group">
              <label className="toggle">
                <input
                  checked={contextEnabled}
                  onChange={(event) => setContextEnabled(event.target.checked)}
                  type="checkbox"
                />
                <span>Vídeo fuente + safe zones</span>
              </label>
              <button
                className="icon-button"
                onClick={() => playerRef.current?.requestFullscreen()}
                type="button"
              >
                Pantalla completa
              </button>
            </div>
          </div>
          <div className="player-stage panel">
            <div className={`player-frame format-${selectedVariant.props.format}`}>
              <Player
                acknowledgeRemotionLicense
                component={PlayerComponent}
                compositionHeight={format.height}
                compositionWidth={format.width}
                controls
                durationInFrames={DURATION_IN_FRAMES}
                fps={FPS}
                initialFrame={Math.round(
                  (session.checkpoints[0] ?? 0.08) *
                    (DURATION_IN_FRAMES - 1),
                )}
                inputProps={contextualProps}
                key={`${session.id}-${selectedVariant.id}-${selectedVariant.props.format}-${contextEnabled}`}
                loop
                ref={playerRef}
                showVolumeControls
                style={{height: "100%", width: "100%"}}
              />
            </div>
          </div>
          <div className="checkpoint-strip panel" aria-label="Checkpoints">
            <span>Checkpoints</span>
            {session.checkpoints.map((checkpoint) => {
              const checkpointFrame = Math.round(
                checkpoint * (DURATION_IN_FRAMES - 1),
              );
              return (
                <button
                  key={checkpoint}
                  onClick={() => playerRef.current?.seekTo(checkpointFrame)}
                  type="button"
                >
                  {Math.round(checkpoint * 100)}%
                </button>
              );
            })}
          </div>
        </section>

        <aside className="inspector panel" aria-label="Inspector de diseño">
          <div className="panel-heading">
            <span>Inspector</span>
            <span>{saving ? "Guardando…" : `r${session.revision}`}</span>
          </div>
          <div className="inspector-content">
            <label>
              <span>Título</span>
              <textarea
                defaultValue={selectedVariant.props.title}
                key={`${selectedVariant.id}-title-${session.revision}`}
                onBlur={(event) => updateProps({title: event.target.value})}
                rows={2}
              />
            </label>
            <label>
              <span>Texto de apoyo</span>
              <textarea
                defaultValue={selectedVariant.props.supportingText ?? ""}
                key={`${selectedVariant.id}-supporting-${session.revision}`}
                onBlur={(event) =>
                  updateProps({supportingText: event.target.value || undefined})
                }
                rows={3}
              />
            </label>
            <div className="field-grid">
              <label>
                <span>Formato</span>
                <select
                  onChange={(event) =>
                    updateProps({format: event.target.value as MotionFormat})
                  }
                  value={selectedVariant.props.format}
                >
                  {Object.entries(MOTION_FORMATS).map(([id, definition]) => (
                    <option key={id} value={id}>
                      {definition.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tema</span>
                <select
                  onChange={(event) =>
                    updateProps({
                      themeId: event.target.value as MotionThemeId,
                    })
                  }
                  value={selectedVariant.props.themeId}
                >
                  <option value="ink-lime">Ink + Lime</option>
                  <option value="editorial-ivory">Editorial Ivory</option>
                  <option value="signal-cobalt">Signal Cobalt</option>
                  <option value="oxide-documentary">Oxide Documentary</option>
                </select>
              </label>
            </div>
            <label>
              <span>Ritmo</span>
              <select
                onChange={(event) =>
                  updateProps({
                    motionProfile: event.target.value as MotionProfileId,
                  })
                }
                value={selectedVariant.props.motionProfile}
              >
                <option value="restrained">Restrained</option>
                <option value="editorial">Editorial</option>
                <option value="kinetic">Kinetic</option>
                <option value="technical">Technical</option>
                <option value="cinematic">Cinematic</option>
              </select>
            </label>
            <label className="toggle inspector-toggle">
              <input
                checked={selectedVariant.props.showHeader}
                onChange={(event) =>
                  updateProps({showHeader: event.target.checked})
                }
                type="checkbox"
              />
              <span>Mostrar encabezado</span>
            </label>
            <label className="toggle inspector-toggle">
              <input
                checked={selectedVariant.props.soundEnabled}
                onChange={(event) =>
                  updateProps({soundEnabled: event.target.checked})
                }
                type="checkbox"
              />
              <span>Diseño sonoro</span>
            </label>

            <div className="qa-panel">
              <div>
                <span>QA visual</span>
                <strong>{session.qa ? `${session.qa.score}/100` : "Sin ejecutar"}</strong>
              </div>
              <button
                className="button button-secondary"
                disabled={saving}
                onClick={runQa}
                type="button"
              >
                Ejecutar QA
              </button>
              {session.qa?.issues.map((item) => (
                <p className={`qa-issue qa-${item.severity}`} key={item.code}>
                  {item.message}
                </p>
              ))}
            </div>

            <div className="approval-actions">
              <button
                className="button button-secondary"
                disabled={saving}
                onClick={() =>
                  mutateSession(
                    {status: "changes-requested"},
                    "Cambios solicitados.",
                  )
                }
                type="button"
              >
                Pedir cambios
              </button>
              <button
                className="button button-primary"
                disabled={saving || !session.qa?.passed}
                onClick={() =>
                  mutateSession({status: "approved"}, "Revisión aprobada.")
                }
                type="button"
              >
                Aprobar
              </button>
            </div>

            <form className="comment-form" onSubmit={addComment}>
              <div className="comment-heading">
                <span>Comentario en {formatFrame(frame)}</span>
                <select
                  onChange={(event) => setCommentCategory(event.target.value)}
                  value={commentCategory}
                >
                  <option value="layout">Layout</option>
                  <option value="motion">Movimiento</option>
                  <option value="text">Texto</option>
                  <option value="asset">Asset</option>
                  <option value="sound">Sonido</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <textarea
                onChange={(event) => setComment(event.target.value)}
                placeholder="Describe el ajuste exacto…"
                rows={3}
                value={comment}
              />
              <button
                className="button button-secondary"
                disabled={saving || !comment.trim()}
                type="submit"
              >
                Guardar comentario
              </button>
            </form>
            <div className="comment-list">
              {visibleComments.map((item) => (
                <button
                  className="comment-item"
                  key={item.id}
                  onClick={() => playerRef.current?.seekTo(item.frame)}
                  type="button"
                >
                  <span>
                    {item.category} · {formatFrame(item.frame)}
                  </span>
                  <p>{item.text}</p>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div aria-live="polite" className="status-live" role="status">
        {error ? `Error: ${error}` : statusMessage}
      </div>
    </main>
  );
};

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
