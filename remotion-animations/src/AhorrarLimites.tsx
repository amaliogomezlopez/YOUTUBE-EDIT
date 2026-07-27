import { zColor } from "@remotion/zod-types";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

const scenes = [
  "input-share",
  "harness-workshop",
  "harness-compare",
  "context-snowball",
  "batch-prompts",
  "skills-range",
  "fresh-chat",
  "subagents",
] as const;

export const ahorrarLimitesSchema = z.object({
  scene: z.enum(scenes),
  clipNumber: z.number().int().min(1),
  title: z.string(),
  kicker: z.string(),
  showHeader: z.boolean().optional(),
  accentColor: zColor(),
});

export type AhorrarLimitesProps = z.infer<typeof ahorrarLimitesSchema>;
type SceneProps = {
  frame: number;
  fps: number;
  accentColor: string;
};

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const enter = (frame: number, fps: number, start: number, end: number) =>
  interpolate(frame, [start * fps, end * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const leave = (
  frame: number,
  fps: number,
  durationInFrames: number,
  seconds = 0.45,
) =>
  interpolate(
    frame,
    [durationInFrames - seconds * fps, durationInFrames - 1],
    [1, 0],
    {
      ...clamp,
      easing: Easing.in(Easing.cubic),
    },
  );

const rgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => character.repeat(2))
          .join("")
      : normalized;
  if (!/^[\da-f]{6}$/i.test(expanded)) {
    return `rgba(255, 210, 62, ${alpha})`;
  }
  return `rgba(${Number.parseInt(expanded.slice(0, 2), 16)}, ${Number.parseInt(
    expanded.slice(2, 4),
    16,
  )}, ${Number.parseInt(expanded.slice(4, 6), 16)}, ${alpha})`;
};

const Panel: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      background:
        "linear-gradient(145deg, rgba(18, 42, 69, 0.94), rgba(8, 24, 43, 0.96))",
      border: "1px solid rgba(139, 197, 255, 0.2)",
      borderRadius: 32,
      boxShadow: "0 28px 80px rgba(0, 0, 0, 0.3)",
      ...style,
    }}
  >
    {children}
  </div>
);

const Arrow: React.FC<{ progress: number; color?: string }> = ({
  progress,
  color = "#39C8FF",
}) => (
  <div
    style={{
      alignItems: "center",
      display: "flex",
      opacity: progress,
      width: 150,
    }}
  >
    <div
      style={{
        backgroundColor: color,
        boxShadow: `0 0 24px ${rgba(color, 0.55)}`,
        height: 6,
        transform: `scaleX(${progress})`,
        transformOrigin: "left",
        width: 112,
      }}
    />
    <div
      style={{
        borderBottom: "14px solid transparent",
        borderLeft: `24px solid ${color}`,
        borderTop: "14px solid transparent",
      }}
    />
  </div>
);

const Badge: React.FC<{
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, color = "#39C8FF", style }) => (
  <div
    style={{
      backgroundColor: rgba(color, 0.12),
      border: `1px solid ${rgba(color, 0.48)}`,
      borderRadius: 999,
      color,
      fontSize: 23,
      fontWeight: 850,
      letterSpacing: 1.4,
      padding: "12px 22px",
      ...style,
    }}
  >
    {children}
  </div>
);

const InputShareScene: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const draw = enter(frame, fps, 0.55, 2.4);
  const detail = enter(frame, fps, 2.2, 3.5);
  const circumference = 2 * Math.PI * 154;

  return (
    <div
      style={{
        alignItems: "center",
        display: "grid",
        gap: 90,
        gridTemplateColumns: "0.86fr 1.14fr",
        height: "100%",
      }}
    >
      <Panel
        style={{
          alignItems: "center",
          display: "flex",
          height: 560,
          justifyContent: "center",
          position: "relative",
        }}
      >
        <svg height="430" viewBox="0 0 430 430" width="430">
          <circle
            cx="215"
            cy="215"
            fill="none"
            r="154"
            stroke="rgba(134, 170, 204, 0.18)"
            strokeWidth="62"
          />
          <circle
            cx="215"
            cy="215"
            fill="none"
            r="154"
            stroke={accentColor}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - 0.9 * draw)}
            strokeLinecap="round"
            strokeWidth="62"
            style={{
              filter: `drop-shadow(0 0 ${26 * detail}px ${rgba(
                accentColor,
                0.9,
              )})`,
              transform: "rotate(-90deg)",
              transformOrigin: "215px 215px",
            }}
          />
        </svg>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            inset: 0,
            justifyContent: "center",
            position: "absolute",
          }}
        >
          <div
            style={{
              color: accentColor,
              fontSize: 106,
              fontWeight: 950,
              letterSpacing: -5,
            }}
          >
            {Math.round(90 * draw)}%
          </div>
          <div
            style={{
              color: "#DDEBFA",
              fontSize: 27,
              fontWeight: 800,
              letterSpacing: 2.6,
            }}
          >
            INPUT
          </div>
        </div>
      </Panel>

      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div
          style={{
            color: "#F4F8FC",
            fontSize: 51,
            fontWeight: 870,
            letterSpacing: -1.5,
            lineHeight: 1.1,
          }}
        >
          El coste grande está en lo que el agente tiene que leer.
        </div>
        <Panel style={{ padding: "38px 42px" }}>
          <div
            style={{
              color: "#9DB4CA",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 2,
              marginBottom: 16,
            }}
          >
            REPARTO APROXIMADO
          </div>
          <div
            style={{
              borderRadius: 22,
              display: "flex",
              height: 76,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: `linear-gradient(90deg, ${accentColor}, #FF9D2E)`,
                color: "#101824",
                display: "flex",
                fontSize: 27,
                fontWeight: 900,
                justifyContent: "center",
                width: `${90 * draw}%`,
              }}
            >
              TOKENS DE ENTRADA
            </div>
            <div
              style={{
                alignItems: "center",
                backgroundColor: "#29425C",
                display: "flex",
                fontSize: 23,
                fontWeight: 850,
                justifyContent: "center",
                opacity: detail,
                width: `${10 * draw}%`,
              }}
            >
              RESTO
            </div>
          </div>
        </Panel>
        <Badge color={accentColor} style={{ alignSelf: "flex-start" }}>
          Optimiza contexto antes que respuestas
        </Badge>
      </div>
    </div>
  );
};

const HarnessWorkshopScene: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const modelIn = enter(frame, fps, 0.35, 1.2);
  const harnessIn = enter(frame, fps, 1.1, 2.15);
  const toolsIn = enter(frame, fps, 2.0, 3.2);
  const resultIn = enter(frame, fps, 3.15, 4.25);

  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        height: "100%",
        justifyContent: "space-between",
      }}
    >
      <Panel
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          height: 390,
          justifyContent: "center",
          opacity: modelIn,
          transform: `translateX(${interpolate(modelIn, [0, 1], [-80, 0])}px)`,
          width: 390,
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "linear-gradient(145deg, #39C8FF, #5865F2)",
            borderRadius: 999,
            boxShadow: "0 0 60px rgba(57, 200, 255, 0.4)",
            display: "flex",
            fontSize: 92,
            fontWeight: 950,
            height: 170,
            justifyContent: "center",
            width: 170,
          }}
        >
          IA
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, marginTop: 28 }}>
          EL MECÁNICO
        </div>
        <div style={{ color: "#9CB3C8", fontSize: 24, marginTop: 8 }}>
          El modelo
        </div>
      </Panel>

      <Arrow progress={harnessIn} />

      <Panel
        style={{
          borderColor: rgba(accentColor, 0.65),
          boxShadow: `0 28px 90px rgba(0, 0, 0, 0.3), 0 0 ${
            38 * toolsIn
          }px ${rgba(accentColor, 0.2)}`,
          height: 500,
          opacity: harnessIn,
          padding: "40px 42px",
          transform: `scale(${0.92 + harnessIn * 0.08})`,
          width: 520,
        }}
      >
        <div
          style={{
            color: accentColor,
            fontSize: 25,
            fontWeight: 900,
            letterSpacing: 3,
          }}
        >
          HARNESS
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, marginTop: 8 }}>
          EL TALLER
        </div>
        <div
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns: "1fr 1fr",
            marginTop: 40,
          }}
        >
          {["HERRAMIENTAS", "INSTRUCCIONES", "CONTEXTO", "FLUJO"].map(
            (item, index) => {
              const itemIn = enter(frame, fps, 2.0 + index * 0.22, 2.7 + index * 0.22);
              return (
                <div
                  key={item}
                  style={{
                    alignItems: "center",
                    backgroundColor: rgba(accentColor, 0.09),
                    border: `1px solid ${rgba(accentColor, 0.35)}`,
                    borderRadius: 18,
                    color: "#E9F2FB",
                    display: "flex",
                    fontSize: 21,
                    fontWeight: 850,
                    height: 98,
                    justifyContent: "center",
                    opacity: itemIn,
                    transform: `translateY(${(1 - itemIn) * 24}px)`,
                  }}
                >
                  {item}
                </div>
              );
            },
          )}
        </div>
      </Panel>

      <Arrow color={accentColor} progress={resultIn} />

      <Panel
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          height: 390,
          justifyContent: "center",
          opacity: resultIn,
          padding: 38,
          transform: `translateX(${interpolate(
            resultIn,
            [0, 1],
            [80, 0],
          )}px)`,
          width: 390,
        }}
      >
        <div style={{ color: "#9DB4CA", fontSize: 23, fontWeight: 850 }}>
          RESULTADO
        </div>
        <div
          style={{
            backgroundColor: "#183451",
            borderRadius: 999,
            height: 34,
            marginTop: 38,
            overflow: "hidden",
            width: 280,
          }}
        >
          <div
            style={{
              background: `linear-gradient(90deg, #39C8FF, ${accentColor})`,
              boxShadow: `0 0 24px ${rgba(accentColor, 0.7)}`,
              height: "100%",
              width: `${88 * resultIn}%`,
            }}
          />
        </div>
        <div
          style={{
            color: accentColor,
            fontSize: 39,
            fontWeight: 920,
            marginTop: 32,
            textAlign: "center",
          }}
        >
          EL ENTORNO
          <br />
          IMPORTA
        </div>
      </Panel>
    </div>
  );
};

const HarnessCompareScene: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const leftIn = enter(frame, fps, 0.45, 1.55);
  const rightIn = enter(frame, fps, 1.2, 2.3);
  const compare = enter(frame, fps, 2.6, 4.0);

  const CompareCard: React.FC<{
    title: string;
    items: string[];
    verdict: string;
    color: string;
    progress: number;
    direction: number;
  }> = ({ title, items, verdict, color, progress, direction }) => (
    <Panel
      style={{
        borderColor: rgba(color, 0.5),
        height: 520,
        opacity: progress,
        padding: "42px 46px",
        transform: `translateX(${direction * (1 - progress) * 90}px)`,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 46, fontWeight: 930 }}>{title}</div>
        <div
          style={{
            backgroundColor: color,
            borderRadius: 999,
            boxShadow: `0 0 28px ${rgba(color, 0.5)}`,
            height: 26,
            width: 26,
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 48 }}>
        {items.map((item, index) => {
          const itemIn = enter(frame, fps, 1.35 + index * 0.3, 2.05 + index * 0.3);
          return (
            <div
              key={item}
              style={{
                alignItems: "center",
                backgroundColor: rgba(color, 0.09),
                border: `1px solid ${rgba(color, 0.32)}`,
                borderRadius: 18,
                display: "flex",
                fontSize: 27,
                fontWeight: 730,
                gap: 16,
                opacity: itemIn,
                padding: "21px 25px",
              }}
            >
              <span style={{ color, fontSize: 28 }}>●</span>
              {item}
            </div>
          );
        })}
      </div>
      <div
        style={{
          backgroundColor: rgba(color, 0.14),
          border: `1px solid ${rgba(color, 0.5)}`,
          borderRadius: 18,
          bottom: 34,
          color,
          fontSize: 25,
          fontWeight: 900,
          left: 46,
          letterSpacing: 1.8,
          opacity: compare,
          padding: "17px 22px",
          position: "absolute",
          right: 46,
          textAlign: "center",
        }}
      >
        {verdict}
      </div>
    </Panel>
  );

  return (
    <div
      style={{
        display: "grid",
        gap: 54,
        gridTemplateColumns: "1fr 120px 1fr",
        height: "100%",
        placeItems: "center",
      }}
    >
      <CompareCard
        color="#FF6B78"
        direction={-1}
        items={["System prompt extenso", "Herramientas precargadas"]}
        progress={leftIn}
        title="CLAUDE CODE"
        verdict="CARGA BASE ALTA"
      />
      <div
        style={{
          alignItems: "center",
          color: "#718BA4",
          display: "flex",
          flexDirection: "column",
          fontSize: 28,
          fontWeight: 900,
          gap: 18,
          opacity: compare,
        }}
      >
        <div style={{ height: 170, width: 2, backgroundColor: "#31506D" }} />
        VS
        <div style={{ height: 170, width: 2, backgroundColor: "#31506D" }} />
      </div>
      <CompareCard
        color={accentColor}
        direction={1}
        items={["Prompt personalizable", "Herramientas ajustables"]}
        progress={rightIn}
        title="PI"
        verdict="CARGA AJUSTABLE"
      />
    </div>
  );
};

const ContextSnowballScene: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const sizes = [120, 168, 220, 290];
  const labels = ["PROMPT 1", "PROMPT 2", "PROMPT 3", "PROMPT 4"];

  return (
    <div
      style={{
        alignItems: "flex-end",
        display: "flex",
        gap: 62,
        height: "100%",
        justifyContent: "center",
        paddingBottom: 38,
      }}
    >
      {sizes.map((size, index) => {
        const progress = enter(frame, fps, 0.35 + index * 0.75, 1.25 + index * 0.75);
        const isLast = index === sizes.length - 1;
        return (
          <div
            key={labels[index]}
            style={{
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
              gap: 22,
              opacity: progress,
              transform: `translateY(${(1 - progress) * 80}px)`,
            }}
          >
            <div
              style={{
                alignItems: "center",
                background: isLast
                  ? `radial-gradient(circle at 34% 28%, #FFF7BA, ${accentColor} 48%, #EF8B24)`
                  : "radial-gradient(circle at 34% 28%, #72D9FF, #315F91 58%, #183651)",
                border: `2px solid ${
                  isLast ? rgba(accentColor, 0.85) : "rgba(120, 207, 255, 0.38)"
                }`,
                borderRadius: 999,
                boxShadow: isLast
                  ? `0 0 ${55 * progress}px ${rgba(accentColor, 0.55)}`
                  : "0 18px 44px rgba(0,0,0,0.32)",
                color: isLast ? "#101824" : "#F4F9FE",
                display: "flex",
                flexDirection: "column",
                fontSize: isLast ? 31 : 25,
                fontWeight: 900,
                height: size,
                justifyContent: "center",
                textAlign: "center",
                width: size,
              }}
            >
              <span>{labels[index]}</span>
              <span
                style={{
                  fontSize: isLast ? 22 : 17,
                  marginTop: 8,
                  opacity: 0.72,
                }}
              >
                + CONTEXTO
              </span>
            </div>
            {index < sizes.length - 1 ? (
              <div
                style={{
                  color: "#7892AA",
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                recuerda lo anterior
              </div>
            ) : (
              <Badge color={accentColor}>MÁS CONTEXTO · MÁS CONSUMO</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
};

const BatchPromptsScene: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const divider = enter(frame, fps, 0.2, 0.8);
  const rightIn = enter(frame, fps, 2.0, 3.15);

  return (
    <div
      style={{
        display: "grid",
        gap: 62,
        gridTemplateColumns: "1fr 3px 1fr",
        height: "100%",
      }}
    >
      <Panel style={{ padding: "38px 42px" }}>
        <Badge color="#FF6B78" style={{ display: "inline-block" }}>
          VARIOS PROMPTS
        </Badge>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 17,
            marginTop: 34,
          }}
        >
          {["TAREA 1", "TAREA 2", "TAREA 3"].map((task, index) => {
            const itemIn = enter(frame, fps, 0.55 + index * 0.48, 1.25 + index * 0.48);
            return (
              <div
                key={task}
                style={{
                  backgroundColor: "rgba(255, 107, 120, 0.08)",
                  border: "1px solid rgba(255, 107, 120, 0.28)",
                  borderRadius: 18,
                  opacity: itemIn,
                  padding: "19px 23px",
                  transform: `translateX(${(1 - itemIn) * -45}px)`,
                }}
              >
                <div style={{ fontSize: 25, fontWeight: 900 }}>{task}</div>
                <div
                  style={{
                    alignItems: "center",
                    color: "#FF8E99",
                    display: "flex",
                    fontSize: 20,
                    fontWeight: 800,
                    gap: 12,
                    marginTop: 10,
                  }}
                >
                  <span
                    style={{
                      backgroundColor: "#FF6B78",
                      borderRadius: 999,
                      height: 10,
                      width: 10,
                    }}
                  />
                  VUELVE A LEER EL CONTEXTO
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div
        style={{
          background: "linear-gradient(transparent, #315979, transparent)",
          opacity: divider,
        }}
      />

      <Panel
        style={{
          borderColor: rgba(accentColor, 0.55),
          boxShadow: `0 28px 80px rgba(0,0,0,0.3), 0 0 ${
            40 * rightIn
          }px ${rgba(accentColor, 0.14)}`,
          opacity: rightIn,
          padding: "38px 42px",
          transform: `scale(${0.95 + rightIn * 0.05})`,
        }}
      >
        <Badge color={accentColor} style={{ display: "inline-block" }}>
          UN SOLO PROMPT
        </Badge>
        <div
          style={{
            backgroundColor: rgba(accentColor, 0.1),
            border: `1px solid ${rgba(accentColor, 0.4)}`,
            borderRadius: 24,
            marginTop: 34,
            padding: "32px 34px",
          }}
        >
          <div style={{ color: accentColor, fontSize: 22, fontWeight: 900 }}>
            UNA LECTURA DE CONTEXTO
          </div>
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "1fr 1fr",
              marginTop: 30,
            }}
          >
            {["TAREA 1", "TAREA 2", "TAREA 3", "TAREA 4"].map((task, index) => {
              const chipIn = enter(frame, fps, 2.65 + index * 0.18, 3.3 + index * 0.18);
              return (
                <div
                  key={task}
                  style={{
                    backgroundColor: "#163650",
                    borderRadius: 16,
                    fontSize: 24,
                    fontWeight: 850,
                    opacity: chipIn,
                    padding: "22px 20px",
                    textAlign: "center",
                    transform: `translateY(${(1 - chipIn) * 24}px)`,
                  }}
                >
                  {task}
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
};

const SkillsRangeScene: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const scaleIn = enter(frame, fps, 0.55, 1.7);
  const bandIn = enter(frame, fps, 1.45, 2.9);
  const warningIn = enter(frame, fps, 3.1, 4.25);
  const ticks = [0, 10, 20, 30];

  return (
    <Panel
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: "60px 90px",
      }}
    >
      <div
        style={{
          color: accentColor,
          fontSize: 35,
          fontWeight: 900,
          letterSpacing: 3,
          opacity: bandIn,
        }}
      >
        RANGO RECOMENDADO
      </div>
      <div
        style={{
          height: 155,
          marginTop: 54,
          opacity: scaleIn,
          position: "relative",
          width: 1380,
        }}
      >
        <div
          style={{
            backgroundColor: "#203D58",
            borderRadius: 999,
            height: 34,
            left: 0,
            overflow: "hidden",
            position: "absolute",
            right: 0,
            top: 46,
          }}
        >
          <div
            style={{
              background: `linear-gradient(90deg, #38D9A9, ${accentColor})`,
              boxShadow: `0 0 34px ${rgba(accentColor, 0.65)}`,
              height: "100%",
              left: "25%",
              position: "absolute",
              transform: `scaleX(${bandIn})`,
              transformOrigin: "left",
              width: "50%",
            }}
          />
          <div
            style={{
              background:
                "repeating-linear-gradient(135deg, rgba(255,107,120,0.88) 0 18px, rgba(255,107,120,0.5) 18px 36px)",
              height: "100%",
              left: "75%",
              opacity: warningIn,
              position: "absolute",
              right: 0,
            }}
          />
        </div>
        {ticks.map((tick) => (
          <div
            key={tick}
            style={{
              left: `${(tick / 40) * 100}%`,
              position: "absolute",
              top: 0,
              transform: "translateX(-50%)",
            }}
          >
            <div
              style={{
                backgroundColor:
                  tick === 10 || tick === 30 ? accentColor : "#7892AA",
                height: 84,
                margin: "0 auto",
                width: tick === 10 || tick === 30 ? 5 : 2,
              }}
            />
            <div
              style={{
                color: tick === 10 || tick === 30 ? accentColor : "#A6BBCE",
                fontSize: tick === 10 || tick === 30 ? 42 : 31,
                fontWeight: 900,
                marginTop: 14,
              }}
            >
              {tick}
            </div>
          </div>
        ))}
        <div
          style={{
            color: "#FF7A87",
            fontSize: 27,
            fontWeight: 900,
            left: "82%",
            opacity: warningIn,
            position: "absolute",
            top: 105,
            whiteSpace: "nowrap",
          }}
        >
          MÁS DE 30
        </div>
      </div>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 24,
          marginTop: 90,
          opacity: warningIn,
        }}
      >
        <Badge color={accentColor}>SINTETIZA</Badge>
        <span style={{ color: "#7892AA", fontSize: 32 }}>→</span>
        <Badge color="#39C8FF">ELIMINA RUIDO</Badge>
        <span style={{ color: "#7892AA", fontSize: 32 }}>→</span>
        <Badge color="#45E1A4">MEJOR CONTEXTO</Badge>
      </div>
    </Panel>
  );
};

const FreshChatScene: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const oldIn = enter(frame, fps, 0.35, 1.3);
  const loopIn = enter(frame, fps, 1.25, 2.3);
  const freshIn = enter(frame, fps, 3.1, 4.35);
  const focus = enter(frame, fps, 4.1, 5.15);

  return (
    <div
      style={{
        display: "grid",
        gap: 60,
        gridTemplateColumns: "1fr 1fr",
        height: "100%",
      }}
    >
      <Panel
        style={{
          filter: `saturate(${1 - focus * 0.72})`,
          opacity: oldIn * (1 - focus * 0.45),
          padding: "38px 42px",
          transform: `translateX(${(1 - oldIn) * -70}px)`,
        }}
      >
        <Badge color="#FF6B78" style={{ display: "inline-block" }}>
          MISMO CHAT
        </Badge>
        <div style={{ marginTop: 38, position: "relative" }}>
          {["HISTORIAL", "SOLUCIÓN FALLIDA", "CORRECCIÓN", "OTRA CORRECCIÓN"].map(
            (item, index) => {
              const itemIn = enter(frame, fps, 0.7 + index * 0.3, 1.35 + index * 0.3);
              return (
                <div
                  key={item}
                  style={{
                    backgroundColor: "rgba(255,107,120,0.08)",
                    border: "1px solid rgba(255,107,120,0.28)",
                    borderRadius: 18,
                    fontSize: 24,
                    fontWeight: 800,
                    marginBottom: 15,
                    opacity: itemIn,
                    padding: "20px 23px",
                    transform: `translateX(${index * 18}px)`,
                    width: `${100 - index * 4}%`,
                  }}
                >
                  {item}
                </div>
              );
            },
          )}
          <div
            style={{
              color: "#FF6B78",
              fontSize: 31,
              fontWeight: 930,
              marginTop: 26,
              opacity: loopIn,
              textAlign: "center",
            }}
          >
            ↻ ARRASTRA TODO EL CONTEXTO
          </div>
        </div>
      </Panel>

      <Panel
        style={{
          borderColor: rgba(accentColor, 0.62),
          boxShadow: `0 28px 80px rgba(0,0,0,0.3), 0 0 ${
            48 * focus
          }px ${rgba(accentColor, 0.16)}`,
          opacity: freshIn,
          padding: "38px 42px",
          transform: `translateX(${(1 - freshIn) * 70}px) scale(${
            0.97 + focus * 0.03
          })`,
        }}
      >
        <Badge color={accentColor} style={{ display: "inline-block" }}>
          CHAT NUEVO
        </Badge>
        <div
          style={{
            backgroundColor: rgba(accentColor, 0.09),
            border: `1px solid ${rgba(accentColor, 0.34)}`,
            borderRadius: 20,
            marginTop: 38,
            padding: "27px 30px",
          }}
        >
          <div style={{ color: "#93ADC5", fontSize: 21, fontWeight: 850 }}>
            CONTEXTO MÍNIMO
          </div>
          <div style={{ fontSize: 29, fontWeight: 850, marginTop: 13 }}>
            “Mi agente ha implementado esto…”
          </div>
        </div>
        <div
          style={{
            backgroundColor: rgba(accentColor, 0.14),
            border: `1px solid ${rgba(accentColor, 0.5)}`,
            borderRadius: 20,
            marginTop: 20,
            padding: "27px 30px",
          }}
        >
          <div style={{ color: accentColor, fontSize: 21, fontWeight: 900 }}>
            OBJETIVO CLARO
          </div>
          <div style={{ fontSize: 29, fontWeight: 850, marginTop: 13 }}>
            Verificación crítica de bugs y fallos
          </div>
        </div>
        <div
          style={{
            color: "#45E1A4",
            fontSize: 30,
            fontWeight: 930,
            marginTop: 31,
            opacity: focus,
            textAlign: "center",
          }}
        >
          VISIÓN LIMPIA · RESULTADO MEJOR
        </div>
      </Panel>
    </div>
  );
};

const SubagentsScene: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const orchestratorIn = enter(frame, fps, 0.35, 1.3);
  const linesIn = enter(frame, fps, 1.15, 2.3);
  const collect = enter(frame, fps, 4.15, 5.4);
  const agents = [
    { x: 180, label: "EXPLORAR" },
    { x: 650, label: "BUSCAR" },
    { x: 1120, label: "RESUMIR" },
  ];

  return (
    <div style={{ height: "100%", position: "relative" }}>
      <Panel
        style={{
          borderColor: rgba(accentColor, 0.6),
          height: 170,
          left: "50%",
          opacity: orchestratorIn,
          padding: "31px 44px",
          position: "absolute",
          textAlign: "center",
          top: 12,
          transform: `translateX(-50%) scale(${0.92 + orchestratorIn * 0.08})`,
          width: 680,
        }}
      >
        <div
          style={{
            color: accentColor,
            fontSize: 23,
            fontWeight: 900,
            letterSpacing: 3,
          }}
        >
          ORQUESTADOR
        </div>
        <div style={{ fontSize: 43, fontWeight: 930, marginTop: 10 }}>
          MODELO POTENTE
        </div>
      </Panel>

      <svg
        height="340"
        style={{ left: 150, position: "absolute", top: 175 }}
        viewBox="0 0 1450 340"
        width="1450"
      >
        {agents.map((agent) => (
          <path
            key={agent.x}
            d={`M 725 0 C 725 135, ${agent.x + 130} 100, ${agent.x + 130} 300`}
            fill="none"
            stroke={accentColor}
            strokeDasharray="900"
            strokeDashoffset={900 * (1 - linesIn)}
            strokeLinecap="round"
            strokeWidth="5"
            style={{
              filter: `drop-shadow(0 0 10px ${rgba(accentColor, 0.65)})`,
            }}
          />
        ))}
      </svg>

      <div
        style={{
          bottom: 20,
          display: "flex",
          justifyContent: "space-between",
          left: 50,
          position: "absolute",
          right: 50,
        }}
      >
        {agents.map((agent, index) => {
          const agentIn = enter(frame, fps, 1.75 + index * 0.35, 2.8 + index * 0.35);
          return (
            <Panel
              key={agent.label}
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: "column",
                height: 310,
                justifyContent: "center",
                opacity: agentIn,
                padding: 30,
                transform: `translateY(${(1 - agentIn) * 60}px)`,
                width: 405,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  backgroundColor: rgba("#39C8FF", 0.13),
                  border: "2px solid rgba(57,200,255,0.5)",
                  borderRadius: 999,
                  color: "#39C8FF",
                  display: "flex",
                  fontSize: 43,
                  fontWeight: 950,
                  height: 94,
                  justifyContent: "center",
                  width: 94,
                }}
              >
                {index + 1}
              </div>
              <div style={{ fontSize: 32, fontWeight: 920, marginTop: 25 }}>
                {agent.label}
              </div>
              <div
                style={{
                  color: "#9DB4CA",
                  fontSize: 23,
                  fontWeight: 760,
                  marginTop: 14,
                }}
              >
                ligero · rápido · eficiente
              </div>
              <div
                style={{
                  color: "#45E1A4",
                  fontSize: 20,
                  fontWeight: 900,
                  marginTop: 18,
                  opacity: collect,
                }}
              >
                DEVUELVE INFORMACIÓN ↑
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
};

const sceneComponents: Record<
  AhorrarLimitesProps["scene"],
  React.FC<SceneProps>
> = {
  "input-share": InputShareScene,
  "harness-workshop": HarnessWorkshopScene,
  "harness-compare": HarnessCompareScene,
  "context-snowball": ContextSnowballScene,
  "batch-prompts": BatchPromptsScene,
  "skills-range": SkillsRangeScene,
  "fresh-chat": FreshChatScene,
  subagents: SubagentsScene,
};

export const AhorrarLimitesAnimation: React.FC<AhorrarLimitesProps> = ({
  scene,
  title,
  kicker,
  showHeader = true,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const headerIn = enter(frame, fps, 0, 0.75);
  const outro = leave(frame, fps, durationInFrames);
  const Scene = sceneComponents[scene];

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 16% 10%, rgba(33, 150, 243, 0.26), transparent 33%), radial-gradient(circle at 86% 84%, rgba(82, 70, 230, 0.2), transparent 38%), linear-gradient(145deg, #06101D, #0A1D31 55%, #071525)",
        color: "#F5F9FD",
        fontFamily: "Schibsted Grotesk",
        opacity: outro,
        overflow: "hidden",
        padding: "58px 86px 54px",
      }}
    >
      {showHeader ? (
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            left: 140,
            opacity: headerIn,
            position: "absolute",
            right: 140,
            textAlign: "center",
            top: 58,
            transform: `translateY(${interpolate(headerIn, [0, 1], [-24, 0])}px)`,
          }}
        >
          <div
            style={{
              fontSize: 54,
              fontWeight: 920,
              letterSpacing: -1.5,
              lineHeight: 1.04,
              maxWidth: 1500,
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: "#A9BED2",
              fontSize: 24,
              fontWeight: 570,
              marginTop: 10,
              maxWidth: 1260,
            }}
          >
            {kicker}
          </div>
        </div>
      ) : null}

      <div
        style={{
          bottom: 72,
          left: 86,
          position: "absolute",
          right: 86,
          top: showHeader ? 230 : 54,
        }}
      >
        <Scene accentColor={accentColor} fps={fps} frame={frame} />
      </div>

      <div
        style={{
          backgroundColor: "rgba(99, 139, 176, 0.2)",
          bottom: 30,
          height: 3,
          left: 86,
          position: "absolute",
          right: 86,
        }}
      >
        <div
          style={{
            background: `linear-gradient(90deg, #39C8FF, ${accentColor})`,
            boxShadow: `0 0 16px ${rgba(accentColor, 0.6)}`,
            height: "100%",
            width: `${interpolate(frame, [0, durationInFrames - 1], [0, 100], clamp)}%`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
