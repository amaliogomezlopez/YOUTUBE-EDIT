// GENERADO por `npm run shorts:build` desde
// remotion-animations/projects/shorts-*/short-build.json.
// No editar a mano: los cambios se pierden en la siguiente compilacion.
import type {ShortVideoProps} from "./schemas";
import deepseekBuild from "../../projects/shorts-deepseek/short-build.json";
import harnessVsModeloBuild from "../../projects/shorts-harness-vs-modelo/short-build.json";

export type ShortBuildEntry = {
  id: string;
  slug: string;
  build: ShortVideoProps;
};

export const shortBuilds: ShortBuildEntry[] = [
  {
    id: "Short-Deepseek",
    slug: "deepseek",
    build: deepseekBuild as ShortVideoProps,
  },
  {
    id: "Short-Harness-vs-Modelo",
    slug: "harness-vs-modelo",
    build: harnessVsModeloBuild as ShortVideoProps,
  },
];
