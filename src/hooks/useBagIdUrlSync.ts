import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

type BagRef = { id?: number };

type UseBagIdUrlSyncParams = {
  bags: BagRef[];
  activeBagId: number | null;
  setActiveBag: (id: number) => Promise<void>;
};

export const useBagIdUrlSync = ({
  bags,
  activeBagId,
  setActiveBag,
}: UseBagIdUrlSyncParams): void => {
  const [searchParams, setSearchParams] = useSearchParams();
  const bagIdParam = searchParams.get('bagId');

  useEffect(() => {
    if (bags.length === 0) {
      return;
    }

    const parsedBagId = bagIdParam == null ? null : Number(bagIdParam);
    const normalizedBagId = parsedBagId ?? -1;
    const isValidBagId =
      Number.isInteger(normalizedBagId) &&
      bags.some((bag) => bag.id === normalizedBagId);

    if (isValidBagId && normalizedBagId !== activeBagId) {
      void setActiveBag(normalizedBagId);
      return;
    }

    if (activeBagId == null) {
      return;
    }

    if (bagIdParam === String(activeBagId)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('bagId', String(activeBagId));
    setSearchParams(nextParams, { replace: true });
  }, [activeBagId, bagIdParam, bags, searchParams, setActiveBag, setSearchParams]);
};
