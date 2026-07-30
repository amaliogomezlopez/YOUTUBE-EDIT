// GENERADO por `npm run intro:build` desde
// remotion-animations/projects/intro-*/intro-build.json.
// No editar a mano: los cambios se pierden en la siguiente compilacion.
import type {IntroVideoProps} from "./schemas";
import canalAmalioIntro from "../../projects/intro-canal-amalio/intro-build.json";
import demoCanalIntro from "../../projects/intro-demo-canal/intro-build.json";

export type IntroBuildEntry = {
  id: string;
  slug: string;
  build: IntroVideoProps;
};

export const introBuilds: IntroBuildEntry[] = [
  {
    id: "Intro-Canal-Amalio",
    slug: "canal-amalio",
    build: canalAmalioIntro as IntroVideoProps,
  },
  {
    id: "Intro-Demo-Canal",
    slug: "demo-canal",
    build: demoCanalIntro as IntroVideoProps,
  },
];
