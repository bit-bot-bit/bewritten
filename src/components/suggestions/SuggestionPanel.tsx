import React from 'react';

interface ContinuityIssue {
  severity: string;
  message: string;
  entity_id?: string;
}

interface SuggestionPanelProps {
  issues: ContinuityIssue[];
  aiIssues: string[];
  isOpen: boolean;
  onClose: () => void;
}

export const SuggestionPanel: React.FC<SuggestionPanelProps> = ({ issues, aiIssues, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 w-80 bg-white shadow-xl border-l p-4 overflow-y-auto z-50 transform transition-transform duration-300 ease-in-out">
        <div className="flex justify-between items-center mb-6 pb-2 border-b">
            <h2 className="font-bold text-lg text-gray-800">Suggestions</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-black font-semibold">X</button>
        </div>

        <div className="space-y-6">
            {issues.length > 0 && (
                <div>
                    <h3 className="font-semibold text-red-600 mb-2 flex items-center">
                        <span className="mr-2">⚠️</span> Continuity Errors
                    </h3>
                    {issues.map((issue, i) => (
                        <div key={i} className="bg-red-50 border border-red-200 p-3 rounded text-sm mb-2 text-gray-700">
                            {issue.message}
                        </div>
                    ))}
                </div>
            )}

            {aiIssues.length > 0 && (
                <div>
                    <h3 className="font-semibold text-purple-600 mb-2 flex items-center">
                        <span className="mr-2">🤖</span> AI Suggestions
                    </h3>
                    {aiIssues.map((issue, i) => (
                        <div key={i} className="bg-purple-50 border border-purple-200 p-3 rounded text-sm mb-2 text-gray-700">
                            {issue}
                        </div>
                    ))}
                </div>
            )}

            {issues.length === 0 && aiIssues.length === 0 && (
                <div className="text-green-600 text-center flex flex-col items-center mt-10">
                    <span className="text-4xl mb-2">✅</span>
                    <span className="font-semibold">No issues found!</span>
                </div>
            )}
        </div>
    </div>
  );
};
