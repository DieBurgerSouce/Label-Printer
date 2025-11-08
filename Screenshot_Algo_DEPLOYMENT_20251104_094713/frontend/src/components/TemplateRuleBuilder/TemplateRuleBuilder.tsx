/**
 * Template Rule Builder
 * UI for defining automatic template matching rules
 */

import { useState } from 'react';
import { Plus, Info } from 'lucide-react';
import type { TemplateRule, RuleCondition } from '../../types/template.types';
import RuleConditionRow from './RuleConditionRow';

interface TemplateRuleBuilderProps {
  rule: TemplateRule | undefined;
  onChange: (rule: TemplateRule) => void;
}

export default function TemplateRuleBuilder({ rule, onChange }: TemplateRuleBuilderProps) {
  const [showHelp, setShowHelp] = useState(false);

  // Initialize default rule if undefined
  const currentRule: TemplateRule = rule || {
    id: `rule-${Date.now()}`,
    enabled: false,
    conditions: [],
    logic: 'AND',
  };

  const handleEnabledChange = (enabled: boolean) => {
    onChange({
      ...currentRule,
      enabled,
      // Add default condition if enabling and no conditions exist
      conditions: enabled && currentRule.conditions.length === 0
        ? [{ field: 'priceType', operator: 'is', value: 'normal' }]
        : currentRule.conditions,
    });
  };

  const handleAddCondition = () => {
    onChange({
      ...currentRule,
      conditions: [
        ...currentRule.conditions,
        { field: 'priceType', operator: 'is', value: 'normal' }
      ],
    });
  };

  const handleConditionChange = (index: number, newCondition: RuleCondition) => {
    const newConditions = [...currentRule.conditions];
    newConditions[index] = newCondition;
    onChange({ ...currentRule, conditions: newConditions });
  };

  const handleConditionDelete = (index: number) => {
    const newConditions = currentRule.conditions.filter((_, i) => i !== index);
    onChange({ ...currentRule, conditions: newConditions });
  };

  const handleLogicChange = (logic: 'AND' | 'OR') => {
    onChange({ ...currentRule, logic });
  };

  return (
    <div className="border-2 border-blue-200 rounded-lg p-6 bg-blue-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="auto-match-enabled"
            checked={currentRule.enabled}
            onChange={(e) => handleEnabledChange(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="auto-match-enabled" className="font-semibold text-gray-900 text-lg">
            Automatisches Template-Matching aktivieren
          </label>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-2 hover:bg-blue-100 rounded-full transition-colors"
          title="Hilfe anzeigen"
        >
          <Info className="w-5 h-5 text-blue-600" />
        </button>
      </div>

      {/* Help Text */}
      {showHelp && (
        <div className="mb-4 p-4 bg-white rounded-lg border border-blue-300">
          <h4 className="font-semibold text-gray-900 mb-2">Wie funktioniert Auto-Matching?</h4>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
            <li>Definiere Regeln, wann dieses Template verwendet werden soll</li>
            <li>Bei Bulk-Label-Generierung wählt das System automatisch das passende Template</li>
            <li>Erstes passendes Template gewinnt (Reihenfolge wichtig!)</li>
            <li>Artikel ohne Match werden übersprungen</li>
          </ul>
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800 font-medium">
              💡 Tipp: Erstelle Templates mit gegenseitig ausschließenden Regeln:
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Template A: "Preis-Typ ist Normaler Preis"<br />
              Template B: "Preis-Typ ist Staffelpreis"
            </p>
          </div>
        </div>
      )}

      {/* Rule Builder (only shown when enabled) */}
      {currentRule.enabled && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-700 mb-4 font-medium">
              Verwende dieses Template wenn:
            </p>

            {/* Conditions */}
            <div className="space-y-2">
              {currentRule.conditions.map((condition, index) => (
                <div key={index}>
                  {index > 0 && (
                    <div className="flex items-center justify-center my-2">
                      <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded">
                        {currentRule.logic === 'AND' ? 'UND' : 'ODER'}
                      </span>
                    </div>
                  )}
                  <RuleConditionRow
                    condition={condition}
                    onChange={(newCondition) => handleConditionChange(index, newCondition)}
                    onDelete={() => handleConditionDelete(index)}
                    showDelete={currentRule.conditions.length > 1}
                  />
                </div>
              ))}
            </div>

            {/* Add Condition Button */}
            <button
              onClick={handleAddCondition}
              className="mt-3 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium transition-all w-full flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Bedingung hinzufügen
            </button>

            {/* Logic Selector (only shown when multiple conditions) */}
            {currentRule.conditions.length > 1 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verknüpfung der Bedingungen:
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="logic"
                      value="AND"
                      checked={currentRule.logic === 'AND'}
                      onChange={(e) => handleLogicChange(e.target.value as 'AND' | 'OR')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">
                      <strong>UND</strong> - Alle Bedingungen müssen erfüllt sein
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="logic"
                      value="OR"
                      checked={currentRule.logic === 'OR'}
                      onChange={(e) => handleLogicChange(e.target.value as 'AND' | 'OR')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">
                      <strong>ODER</strong> - Mindestens eine Bedingung muss erfüllt sein
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Rule Preview */}
          {currentRule.conditions.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-800 mb-2">
                📋 Regel-Zusammenfassung:
              </p>
              <p className="text-sm text-green-700">
                Dieses Template wird verwendet wenn{' '}
                {currentRule.conditions.map((condition, index) => (
                  <span key={index}>
                    {index > 0 && (
                      <strong className="text-green-900">
                        {' '}{currentRule.logic === 'AND' ? 'UND' : 'ODER'}{' '}
                      </strong>
                    )}
                    <strong>
                      {condition.field === 'priceType' && 'Preis-Typ'}
                      {condition.field === 'category' && 'Kategorie'}
                      {condition.field === 'priceRange' && 'Preis'}
                      {condition.field === 'manufacturer' && 'Hersteller'}
                    </strong>
                    {' '}
                    {condition.operator === 'is' && 'ist'}
                    {condition.operator === 'isNot' && 'ist nicht'}
                    {condition.operator === 'greaterThan' && 'größer als'}
                    {condition.operator === 'lessThan' && 'kleiner als'}
                    {condition.operator === 'contains' && 'enthält'}
                    {' '}
                    <strong>
                      {condition.field === 'priceType' && condition.value === 'normal' && 'Normaler Preis'}
                      {condition.field === 'priceType' && condition.value === 'tiered' && 'Staffelpreis'}
                      {condition.field !== 'priceType' && `"${condition.value}"`}
                    </strong>
                  </span>
                ))}
                .
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
