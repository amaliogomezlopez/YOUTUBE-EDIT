import React from "react";
import {Img, staticFile} from "remotion";

export type ManagedImageProps = {
  publicPath: string;
  alt: string;
  fit?: "cover" | "contain";
  focalPoint?: {x: number; y: number};
  borderRadius?: number;
  dim?: number;
  opacity?: number;
  style?: React.CSSProperties;
};

const normalizePublicPath = (publicPath: string) => {
  const normalized = publicPath.split("\\").join("/").replace(/^\/+/, "");
  if (
    normalized.length === 0 ||
    normalized.includes("..") ||
    /^https?:\/\//i.test(normalized)
  ) {
    throw new Error(
      `ManagedImage solo acepta rutas locales dentro de public/: ${publicPath}`,
    );
  }
  return normalized;
};

export const ManagedImage: React.FC<ManagedImageProps> = ({
  publicPath,
  alt,
  fit = "cover",
  focalPoint = {x: 50, y: 50},
  borderRadius = 28,
  dim = 0,
  opacity = 1,
  style,
}) => {
  const safePath = normalizePublicPath(publicPath);
  const safeDim = Math.max(0, Math.min(1, dim));

  return (
    <div
      aria-label={alt}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius,
        opacity,
        ...style,
      }}
    >
      <Img
        src={staticFile(safePath)}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: fit,
          objectPosition: `${focalPoint.x}% ${focalPoint.y}%`,
        }}
      />
      {safeDim > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: `rgba(2, 10, 23, ${safeDim})`,
          }}
        />
      ) : null}
    </div>
  );
};
