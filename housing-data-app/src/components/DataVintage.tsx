import { useEffect, useState } from 'react';
import { getDataManifest, formatDataThrough, type DataManifest } from '../services/dataVersion';
import { USE_SPLIT_CSV } from '../services/providers/config';

interface DataVintageProps {
  className?: string;
}

/**
 * One quiet line saying how current the numbers are: "Data through Aug 2026".
 * Reads the published manifest; renders nothing until it arrives or if the
 * app is not in split-CSV mode.
 */
export const DataVintage = ({ className = '' }: DataVintageProps) => {
  const [manifest, setManifest] = useState<DataManifest | null>(null);

  useEffect(() => {
    if (!USE_SPLIT_CSV) return;
    let cancelled = false;
    getDataManifest().then((m) => {
      if (!cancelled) setManifest(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!manifest) return null;

  const through = formatDataThrough(manifest.zhvi?.lastColumn);
  if (!through) return null;

  return (
    <p className={className} title={`Data version ${manifest.dataVersion}`}>
      Data through {through}
    </p>
  );
};
