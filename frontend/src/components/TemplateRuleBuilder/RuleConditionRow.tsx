/**
 * Rule Condition Row
 * Single row for defining a template matching condition
 */

import { Trash2 } from 'lucide-react';
import type { RuleCondition, RuleField, RuleOperator } from '../../types/template.types';

interface RuleConditionRowProps {
  condition: RuleCondition;
  onChange: (condition: RuleCondition) => void;
  onDelete: () => void;
  showDelete: boolean;
}

export default function RuleConditionRow({ condition, onChange, onDelete, showDelete }: RuleConditionRowProps) {
  const handleFieldChange = (field: RuleField) => {
    // Reset operator and value when field changes
    let newOperator: RuleOperator = 'is';
    let newValue: string | number = '';

    if (field === 'priceType') {
      newOperator = 'is';
      newValue = 'normal';
    } else if (field === 'priceRange') {
      newOperator = 'greaterThan';
      newValue = 0;
    }

    onChange({ field, operator: newOperator, value: newValue });
  };

  const handleOperatorChange = (operator: RuleOperator) => {
    onChange({ ...condition, operator });
  };

  const handleValueChange = (value: string | number) => {
    onChange({ ...condition, value });
  };

  return (
    <div className="flex gap-3 items-center mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      {/* Field Selector */}
      <div className="flex-1">
        <label className="block text-xs text-gray-600 mb-1">Feld</label>
        <select
          value={condition.field}
          onChange={(e) => handleFieldChange(e.target.value as RuleField)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="priceType">Preis-Typ</option>
          <option value="category">Kategorie</option>
          <option value="priceRange">Preisbereich</option>
          <option value="manufacturer">Hersteller</option>
        </select>
      </div>

      {/* Operator Selector */}
      <div className="flex-1">
        <label className="block text-xs text-gray-600 mb-1">Operator</label>
        <select
          value={condition.operator}
          onChange={(e) => handleOperatorChange(e.target.value as RuleOperator)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {condition.field === 'priceType' && (
            <>
              <option value="is">ist</option>
              <option value="isNot">ist nicht</option>
            </>
          )}
          {condition.field === 'category' && (
            <>
              <option value="is">ist</option>
              <option value="isNot">ist nicht</option>
              <option value="contains">enthält</option>
            </>
          )}
          {condition.field === 'priceRange' && (
            <>
              <option value="greaterThan">größer als</option>
              <option value="lessThan">kleiner als</option>
            </>
          )}
          {condition.field === 'manufacturer' && (
            <>
              <option value="is">ist</option>
              <option value="contains">enthält</option>
            </>
          )}
        </select>
      </div>

      {/* Value Input */}
      <div className="flex-1">
        <label className="block text-xs text-gray-600 mb-1">Wert</label>
        {condition.field === 'priceType' ? (
          <select
            value={String(condition.value)}
            onChange={(e) => handleValueChange(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="normal">Normaler Preis</option>
            <option value="tiered">Staffelpreis</option>
          </select>
        ) : condition.field === 'priceRange' ? (
          <input
            type="number"
            value={Number(condition.value)}
            onChange={(e) => handleValueChange(Number(e.target.value))}
            placeholder="z.B. 100"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        ) : (
          <input
            type="text"
            value={String(condition.value)}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder={condition.field === 'category' ? 'z.B. Werkzeug' : 'z.B. ACME Corp'}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )}
      </div>

      {/* Delete Button */}
      {showDelete && (
        <div className="pt-5">
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-50 rounded transition-colors"
            title="Bedingung löschen"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}
    </div>
  );
}
