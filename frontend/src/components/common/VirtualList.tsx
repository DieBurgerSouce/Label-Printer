/**
 * VirtualList Component
 * High-performance virtualized list for rendering large datasets
 * Uses @tanstack/react-virtual for windowing
 */

import { useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';

// Type for render item function
export type RenderItemFn<T> = (item: T, index: number, isSelected: boolean) => React.ReactNode;

// Props interface
export interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Function to render each item */
  renderItem: RenderItemFn<T>;
  /** Estimated height of each item in pixels */
  estimatedItemHeight?: number;
  /** Key extractor function */
  getItemKey?: (item: T, index: number) => string | number;
  /** Currently selected item index */
  selectedIndex?: number;
  /** Callback when item is clicked */
  onItemClick?: (item: T, index: number) => void;
  /** Overscan count - how many items to render outside viewport */
  overscan?: number;
  /** Container className */
  className?: string;
  /** Whether list is loading */
  isLoading?: boolean;
  /** Loading placeholder */
  loadingComponent?: React.ReactNode;
  /** Empty state component */
  emptyComponent?: React.ReactNode;
  /** Gap between items in pixels */
  gap?: number;
  /** Horizontal mode */
  horizontal?: boolean;
}

function VirtualList<T>({
  items,
  renderItem,
  estimatedItemHeight = 60,
  getItemKey,
  selectedIndex,
  onItemClick,
  overscan = 5,
  className = '',
  isLoading = false,
  loadingComponent,
  emptyComponent,
  gap = 0,
  horizontal = false,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Memoize item count
  const itemCount = useMemo(() => items.length, [items.length]);

  // Create virtualizer instance
  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => estimatedItemHeight + gap, [estimatedItemHeight, gap]),
    overscan,
    horizontal,
    getItemKey: getItemKey ? (index) => getItemKey(items[index], index) : undefined,
  });

  // Get virtual items
  const virtualItems = virtualizer.getVirtualItems();

  // Handle item click
  const handleItemClick = useCallback(
    (item: T, index: number) => {
      onItemClick?.(item, index);
    },
    [onItemClick]
  );

  // Loading state
  if (isLoading) {
    return (
      loadingComponent || (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Laden...</span>
        </div>
      )
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      emptyComponent || (
        <div className="flex flex-col items-center justify-center p-8 text-gray-500">
          <p>Keine Einträge vorhanden</p>
        </div>
      )
    );
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: horizontal ? '100%' : `${virtualizer.getTotalSize()}px`,
          width: horizontal ? `${virtualizer.getTotalSize()}px` : '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          const isSelected = selectedIndex === virtualItem.index;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: horizontal ? undefined : '100%',
                height: horizontal ? '100%' : undefined,
                transform: horizontal
                  ? `translateX(${virtualItem.start}px)`
                  : `translateY(${virtualItem.start}px)`,
              }}
              onClick={() => handleItemClick(item, virtualItem.index)}
              role="listitem"
              aria-selected={isSelected}
            >
              {renderItem(item, virtualItem.index, isSelected)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualList;

// Utility hook for virtual list with selection
export function useVirtualSelection<T>(items: T[], initialIndex?: number) {
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>(initialIndex);

  const selectedItem = useMemo(
    () => (selectedIndex !== undefined ? items[selectedIndex] : undefined),
    [items, selectedIndex]
  );

  const handleItemClick = useCallback((_item: T, index: number) => {
    setSelectedIndex(index);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIndex(undefined);
  }, []);

  const selectNext = useCallback(() => {
    setSelectedIndex((prev) => (prev === undefined ? 0 : Math.min(prev + 1, items.length - 1)));
  }, [items.length]);

  const selectPrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev === undefined ? items.length - 1 : Math.max(prev - 1, 0)));
  }, [items.length]);

  return {
    selectedIndex,
    selectedItem,
    setSelectedIndex,
    handleItemClick,
    clearSelection,
    selectNext,
    selectPrevious,
  };
}

// Re-export useState for the hook
import { useState } from 'react';
