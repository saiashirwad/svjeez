import styles from "./CheckIcon.module.css";

export default function CheckIcon({ done }: { done: boolean }) {
  return done ? (
    <svg className={`${styles.check} ${styles.on}`} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M7.5 12.5l3 3 6-6.5"
        fill="none"
        stroke="var(--surface)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg
      className={styles.check}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3.1" />
    </svg>
  );
}
