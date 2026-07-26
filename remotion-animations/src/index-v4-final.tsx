import { Composition, Folder, registerRoot } from "remotion";
import {
  AhorrarLimitesV4,
  ahorrarLimitesV4Schema,
} from "./AhorrarLimitesV4";

// Entry point independiente para la entrega V4 (pasada con iconos y dibujos).
// Registra las 9 composiciones ALV4 con los IDs usados en los stills aprobados,
// sin depender de src/Root.tsx, que puede ser editado por otros procesos.

const ahorrarLimitesV4FinalCompositions = [
  {
    id: "ALV4-01-CosteCreciente",
    durationSeconds: 7,
    props: {
      scene: "rising-cost",
      clipNumber: 1,
      title: "El cuarto mensaje cuesta más que el primero",
      kicker: "Cada mensaje en el mismo chat cuesta más.",
      accentColor: "#FFD43B",
    },
  },
  {
    id: "ALV4-09-DesgloseTokens",
    durationSeconds: 8,
    props: {
      scene: "token-breakdown",
      clipNumber: 9,
      title: "Miles de tokens antes de tu pregunta",
      kicker: "System prompt y herramientas antes de responder.",
      accentColor: "#42C7F5",
    },
  },
  {
    id: "ALV4-12-VentanaContexto",
    durationSeconds: 5,
    props: {
      scene: "context-window",
      clipNumber: 12,
      title: "La ventana de contexto se llena",
      accentColor: "#45E1A4",
    },
  },
  {
    id: "ALV4-15-AtencionDispersa",
    durationSeconds: 8,
    props: {
      scene: "sparse-attention",
      clipNumber: 15,
      title: "Del repaso completo al salto directo",
      kicker: "Índices en vez de releer la conversación.",
      accentColor: "#42C7F5",
    },
  },
  {
    id: "ALV4-19-TresSkills",
    durationSeconds: 8,
    props: {
      scene: "three-skills",
      clipNumber: 19,
      title: "Una skill para cada cosa",
      kicker: "Servidores, arquitectura y rol del agente.",
      accentColor: "#FFD43B",
    },
  },
  {
    id: "ALV4-21-MarkdownClutter",
    durationSeconds: 9,
    props: {
      scene: "md-clutter",
      clipNumber: 21,
      title: "Repos llenos de .md contaminan el contexto",
      kicker: "Más tokens y peores resultados.",
      accentColor: "#FF6B6B",
    },
  },
  {
    id: "ALV4-23-BucleRevision",
    durationSeconds: 8,
    props: {
      scene: "review-loop",
      clipNumber: 23,
      title: "El bucle de revisión que no termina",
      accentColor: "#FF6B6B",
    },
  },
  {
    id: "ALV4-26-Memoria",
    durationSeconds: 8,
    props: {
      scene: "memory-cost",
      clipNumber: 26,
      title: "La memoria guarda preferencias que no viajan entre repos",
      accentColor: "#42C7F5",
    },
  },
  {
    id: "ALV4-29-HorasPico",
    durationSeconds: 6,
    props: {
      scene: "off-peak",
      clipNumber: 29,
      title: "Fuera de horas pico, el límite estira más",
      kicker: "Trabaja en horas valle.",
      accentColor: "#45E1A4",
    },
  },
] as const;

export const RemotionRootV4Final: React.FC = () => {
  return (
    <Folder name="Ahorrar-Limites-V4">
      {ahorrarLimitesV4FinalCompositions.map((composition) => (
        <Composition
          key={composition.id}
          id={composition.id}
          component={AhorrarLimitesV4}
          durationInFrames={composition.durationSeconds * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={ahorrarLimitesV4Schema}
          defaultProps={composition.props}
        />
      ))}
    </Folder>
  );
};

registerRoot(RemotionRootV4Final);
