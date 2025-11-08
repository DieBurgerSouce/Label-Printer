import { Search, Filter, X } from 'lucide-react';
import { useState } from 'react';

interface LabelFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categories?: string[];
  selectedCategory?: string;
  onCategoryChange: (category?: string) => void;
  tags?: string[];
  selectedTags?: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function LabelFilter({
  searchQuery,
  onSearchChange,
  categories = [],
  selectedCategory,
  onCategoryChange,
  tags = [],
  selectedTags = [],
  onTagsChange,
}: LabelFilterProps) {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = selectedCategory || selectedTags.length > 0;

  const clearFilters = () => {
    onCategoryChange(undefined);
    onTagsChange([]);
    onSearchChange('');
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="card space-y-4">
      {/* Search bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search labels by name, article number, description..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            showFilters || hasActiveFilters
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Filter className="w-5 h-5" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="bg-white text-primary-600 px-2 py-0.5 rounded-full text-xs font-medium">
              {(selectedCategory ? 1 : 0) + selectedTags.length}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
          >
            <X className="w-5 h-5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="pt-4 border-t border-gray-200 space-y-4">
          {/* Categories */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onCategoryChange(undefined)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    !selectedCategory
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => onCategoryChange(category)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedCategory === category
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
