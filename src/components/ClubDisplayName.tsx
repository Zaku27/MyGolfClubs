import { getClubTypeDisplay } from '../utils/clubUtils';

interface ClubDisplayNameProps {
  clubType: string;
  number: string;
  name?: string;
  className?: string;
  badgeClassName?: string;
  nameClassName?: string;
}

export const ClubDisplayName = ({
  clubType,
  number,
  name,
  className = '',
  badgeClassName = '',
  nameClassName = '',
}: ClubDisplayNameProps) => {
  const clubTypeLabel = getClubTypeDisplay(clubType, number);

  return (
    <span className={`inline-flex items-center ${className}`.trim()}>
      <span
        className={`inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-900 ${badgeClassName}`.trim()}
      >
        {clubTypeLabel}
      </span>
      {name ? (
        <span className={`ml-2 text-sm text-slate-600 ${nameClassName}`.trim()}>
          {name}
        </span>
      ) : null}
    </span>
  );
};
