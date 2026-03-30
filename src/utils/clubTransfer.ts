import type { GolfClub } from '../types/golf';

export const readClubsFromJsonFile = async (
  file: File,
): Promise<Omit<GolfClub, 'id'>[]> => {
  const text = await file.text();
  return JSON.parse(text) as Omit<GolfClub, 'id'>[];
};

export const downloadClubsAsJson = (
  clubs: GolfClub[],
  filename = 'golf_clubs.json',
): void => {
  const data = JSON.stringify(clubs, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};