import {z} from "zod";
import {
  AhorrarLimitesV2,
  ahorrarLimitesV2Schema,
} from "./AhorrarLimitesV2";
import {AhorrarLimitesSoundDesign} from "./motion/SoundDesign";

export const ahorrarLimitesV3Schema = ahorrarLimitesV2Schema.extend({
  soundEnabled: z.boolean(),
  soundMix: z.number().min(0).max(1),
});

export type AhorrarLimitesV3Props = z.infer<
  typeof ahorrarLimitesV3Schema
>;

export const AhorrarLimitesV3: React.FC<AhorrarLimitesV3Props> = ({
  soundEnabled,
  soundMix,
  ...visualProps
}) => (
  <>
    <AhorrarLimitesV2 {...visualProps} />
    <AhorrarLimitesSoundDesign
      enabled={soundEnabled}
      masterVolume={soundMix}
      scene={visualProps.scene}
    />
  </>
);
