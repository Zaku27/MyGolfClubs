/**
 * Converts a single image data string to an array format
 * @param imageData - Optional image data string
 * @returns Array format or undefined
 */
export const toImageDataArray = (imageData?: string): string[] | undefined => {
  return imageData ? [imageData] : undefined;
};

/**
 * Shifts an item in an array one position to the left
 * @param array - The array to modify
 * @param itemId - The ID of the item to shift
 * @param getId - Function to extract ID from array items
 * @returns New array with the item shifted, or original array if shift not possible
 */
export const shiftItemLeft = <T>(
  array: T[],
  itemId: string | number | null,
  getId: (item: T) => string | number
): T[] => {
  if (!itemId) return array;

  const currentIndex = array.findIndex(item => getId(item) === itemId);
  if (currentIndex <= 0) return array;

  const newArray = [...array];
  const [movedItem] = newArray.splice(currentIndex, 1);
  newArray.splice(currentIndex - 1, 0, movedItem);

  return newArray;
};
