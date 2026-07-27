import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {z} from "zod";
import {drawingCatalog, iconCatalog} from "./catalog";
import {EditorialDoodle} from "./drawings/EditorialDoodle";
import {MotionIcon} from "./icons/MotionIcon";

export const iconGallerySchema = z.object({
  page: z.number().int().min(0).max(1),
});

export const drawingGallerySchema = z.object({
  showLabels: z.boolean(),
});

export type IconGalleryProps = z.infer<typeof iconGallerySchema>;
export type DrawingGalleryProps = z.infer<typeof drawingGallerySchema>;

const background =
  "radial-gradient(circle at 50% -20%, rgba(56,189,248,.15), transparent 43%), #03101D";

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#F8FAFC",
  fontFamily: "Inter, Arial, sans-serif",
  fontSize: 56,
  fontWeight: 850,
  letterSpacing: -2,
};

export const IconCatalogGallery: React.FC<IconGalleryProps> = ({page}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entries = iconCatalog.slice(page * 20, page * 20 + 20);

  return (
    <AbsoluteFill
      style={{
        background,
        padding: "68px 80px",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div style={{display: "flex", alignItems: "baseline", gap: 24}}>
        <h1 style={titleStyle}>Catálogo de iconos</h1>
        <span style={{color: "#38BDF8", fontSize: 24, fontWeight: 800}}>
          {page + 1}/2 · SVG original · 64 × 64
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
          gap: 18,
          height: 790,
          marginTop: 42,
        }}
      >
        {entries.map((entry, index) => {
          const delay = index * 2;
          const reveal = spring({
            frame: frame - delay,
            fps,
            config: {damping: 18, stiffness: 120},
          });
          const translateY = interpolate(reveal, [0, 1], [24, 0]);

          return (
            <div
              key={entry.id}
              style={{
                minWidth: 0,
                border: "1px solid rgba(56,189,248,.23)",
                borderRadius: 24,
                background: "rgba(7,24,39,.82)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
                opacity: reveal,
                transform: `translateY(${translateY}px)`,
              }}
            >
              <MotionIcon
                id={entry.id}
                title={entry.label}
                progress={reveal}
                style={{width: 88, height: 88}}
              />
              <div style={{textAlign: "center", minWidth: 0, width: "100%"}}>
                <div
                  style={{
                    color: "#F8FAFC",
                    fontSize: 20,
                    fontWeight: 800,
                    lineHeight: 1.1,
                  }}
                >
                  {entry.label}
                </div>
                <div
                  style={{
                    color: "#38BDF8",
                    fontSize: 14,
                    fontWeight: 700,
                    marginTop: 7,
                  }}
                >
                  {entry.id}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const DrawingCatalogGallery: React.FC<DrawingGalleryProps> = ({
  showLabels,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background,
        padding: "58px 72px",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div style={{display: "flex", alignItems: "baseline", gap: 24}}>
        <h1 style={titleStyle}>Catálogo de dibujos</h1>
        <span style={{color: "#38BDF8", fontSize: 24, fontWeight: 800}}>
          Relaciones visuales reutilizables
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gridTemplateRows: "repeat(3, minmax(0, 1fr))",
          gap: 18,
          height: 820,
          marginTop: 28,
        }}
      >
        {drawingCatalog.map((entry, index) => {
          const reveal = spring({
            frame: frame - index * 2,
            fps,
            config: {damping: 18, stiffness: 105},
          });
          return (
            <div
              key={entry.id}
              style={{
                border: "1px solid rgba(56,189,248,.22)",
                borderRadius: 24,
                background: "rgba(7,24,39,.84)",
                padding: "5px 13px 12px",
                opacity: reveal,
                transform: `scale(${0.96 + reveal * 0.04})`,
              }}
            >
              <EditorialDoodle
                id={entry.id}
                progress={reveal}
                showLabel={false}
                style={{width: "100%", height: 210}}
              />
              <div
                style={{
                  color: "#F8FAFC",
                  textAlign: "center",
                  fontSize: 17,
                  fontWeight: 800,
                  lineHeight: 1.1,
                }}
              >
                {showLabels ? entry.label : entry.id}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
