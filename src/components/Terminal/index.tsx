import { useTerminal } from '~/usecase/hooks/useTerminal';

import styles from './styles.module.scss';

interface TerminalProps {
  scale: number;
  bodyW: number;
  bodyH: number;
  tileId: string;
}

const Terminal = ({ tileId, scale, bodyW, bodyH }: TerminalProps) => {
  const { hostRef, scalerRef } = useTerminal({ tileId, scale, bodyW, bodyH });

  return (
    <div ref={scalerRef} className={styles.scaler}>
      <div ref={hostRef} />
    </div>
  );
};

export default Terminal;
