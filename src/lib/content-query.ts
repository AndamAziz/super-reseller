import { queryOptions } from '@tanstack/react-query';
import { getManagedContent, getExistingSeries } from './content.functions';

export const managedContentOptions = queryOptions({ queryKey: ['managed-content'], queryFn: () => getManagedContent(), staleTime: 0, refetchInterval: 5000, refetchIntervalInBackground: false });
export const existingSeriesOptions = queryOptions({ queryKey: ['existing-series'], queryFn: () => getExistingSeries(), staleTime: 5000 });