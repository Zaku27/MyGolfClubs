import { useEffect, useRef } from 'react';
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
  // undefined = 初回実行前（まだ見たことがない）を表すセンチネル値
  const prevBagIdParamRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // URL の bagId パラメータが実際に変化したか（初回は必ず true）
    const bagIdParamChanged =
      prevBagIdParamRef.current === undefined || bagIdParam !== prevBagIdParamRef.current;
    prevBagIdParamRef.current = bagIdParam;

    if (bags.length === 0) {
      return;
    }

    const parsedBagId = bagIdParam == null ? null : Number(bagIdParam);
    const normalizedBagId = parsedBagId ?? -1;
    const isValidBagId =
      Number.isInteger(normalizedBagId) &&
      bags.some((bag) => bag.id === normalizedBagId);

    // URL が変わった場合のみ store へ反映する（UI 操作で store が変わった場合は URL を追随させる）
    if (bagIdParamChanged && isValidBagId && normalizedBagId !== activeBagId) {
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
