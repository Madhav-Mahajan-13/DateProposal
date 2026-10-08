type PetIconProps = { kind: 'pet' | 'treat' | 'play' };

export default function PetIcon({ kind }: PetIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'pet' && (
        <path d="M12 20S3 14.5 3 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9 2.8C21 14.5 12 20 12 20Z" />
      )}
      {kind === 'treat' && (
        <>
          <path d="M20.7 10A5 5 0 0 1 14 3.3 9 9 0 1 0 20.7 10Z" />
          <path d="M8 8h.01M7 14h.01M13 16h.01M12 11h.01" strokeWidth="3" />
        </>
      )}
      {kind === 'play' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M5.5 5.5c6 1 6 12 13 13M18.5 5.5c-6 1-6 12-13 13" />
        </>
      )}
    </svg>
  );
}
