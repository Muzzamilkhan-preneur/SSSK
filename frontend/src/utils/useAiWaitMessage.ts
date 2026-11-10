import { useEffect, useState } from "react";

const WAIT_ACKNOWLEDGEMENT_MS = 2_000;
const LONG_WAIT_MS = 8_000;

export function useAiWaitMessage(
  active: boolean,
  messages: readonly [string, string, string],
) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!active) {
      // Reset the next request to its immediate acknowledgement.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStage(0);
      return;
    }

    setStage(0);
    const acknowledgementTimer = setTimeout(
      () => setStage(1),
      WAIT_ACKNOWLEDGEMENT_MS,
    );
    const longWaitTimer = setTimeout(() => setStage(2), LONG_WAIT_MS);

    return () => {
      clearTimeout(acknowledgementTimer);
      clearTimeout(longWaitTimer);
    };
  }, [active]);

  return messages[stage];
}
