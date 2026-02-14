import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

interface EditorProps {
  initialContent: string;
  onSave?: (content: string) => void;
  onChange?: (content: string) => void;
}

export const Editor: React.FC<EditorProps> = ({ initialContent, onSave, onChange }) => {
  const [content, setContent] = useState(initialContent);

  // Sync state if initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleChange = (val: string) => {
    setContent(val);
    if (onChange) onChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (onSave) onSave(content);
    }
  };

  return (
    <div className="h-full w-full border border-gray-300 rounded overflow-hidden" onKeyDown={handleKeyDown}>
      <CodeMirror
        value={content}
        height="100%"
        extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
        onChange={handleChange}
        theme="light"
        className="text-lg"
      />
    </div>
  );
};
