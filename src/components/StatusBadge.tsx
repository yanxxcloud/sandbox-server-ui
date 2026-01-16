import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  state: string;
}

export function StatusBadge({ state }: StatusBadgeProps) {
  const getStateClass = () => {
    switch (state.toLowerCase()) {
      case 'running':
        return styles.running;
      case 'pending':
        return styles.pending;
      case 'paused':
      case 'pausing':
        return styles.paused;
      case 'stopping':
      case 'terminated':
        return styles.terminated;
      case 'failed':
        return styles.failed;
      default:
        return styles.default;
    }
  };

  return <span className={`${styles.badge} ${getStateClass()}`}>{state}</span>;
}
