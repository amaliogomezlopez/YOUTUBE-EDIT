import drawingsCatalogJson from "../../catalog/visuals/drawings.json";
import imagesCatalogJson from "../../catalog/visuals/images.json";
import iconsCatalogJson from "../../catalog/visuals/icons.json";

export type IconCatalogEntry = {
  id: string;
  label: string;
  category: string;
  tags: string[];
  parts: string[];
};

export type DrawingCatalogEntry = {
  id: string;
  label: string;
  tags: string[];
  iconRefs: string[];
  motionVerb: string;
};

export type ImageCatalogEntry = {
  id: string;
  publicPath: string;
  alt: string;
  width: number;
  height: number;
  sha256: string;
  source: string;
  author?: string;
  license: string;
  attribution?: string;
  tags: string[];
  focalPoint?: {x: number; y: number};
};

export const iconCatalog = iconsCatalogJson.icons as IconCatalogEntry[];
export const drawingCatalog =
  drawingsCatalogJson.drawings as DrawingCatalogEntry[];
export const imageCatalog = imagesCatalogJson.images as ImageCatalogEntry[];

export const iconCatalogById = new Map(
  iconCatalog.map((entry) => [entry.id, entry]),
);

export const drawingCatalogById = new Map(
  drawingCatalog.map((entry) => [entry.id, entry]),
);

export const imageCatalogById = new Map(
  imageCatalog.map((entry) => [entry.id, entry]),
);

export const visualCatalogStats = {
  icons: iconCatalog.length,
  drawings: drawingCatalog.length,
  images: imageCatalog.length,
} as const;
