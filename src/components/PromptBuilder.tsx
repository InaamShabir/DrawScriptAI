import React, { useMemo, useState } from 'react';
import { Copy, Check, ExternalLink, Play } from 'lucide-react';
import { DEFAULT_SYSTEM_PROMPT, SIMULATED_CHATGPT_REPLY } from '../data/presets';

interface PromptBuilderProps {
  onLoadIntoCanvas: (script: string, sourceLabel: string) => void;
}

const SAMPLE_QUESTIONS = [
  'Explain the Pythagorean theorem visually with squares on each side.',
  'Compare the volume of a 3D cylinder and a 3D cone of equal radius and height.',
  'Explain how the unit circle generates a sine wave.',
  'Visualize vector addition u + v = w in 3D space.',
];

export const PromptBuilder: React.FC<PromptBuilderProps> = ({ onLoadIntoCanvas }) => {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [question, setQuestion] = useState(
    'Explain the Pythagorean theorem visually with squares on each side.'
  );
  const [copied, setCopied] = useState(false);

  const combinedPrompt = useMemo(() => {
    const cleanQ = question.trim() || 'Explain the Pythagorean theorem visually.';
    return `${systemPrompt.trim()}\n\nStudent Question: ${cleanQ}`;
  }, [systemPrompt, question]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(combinedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const chatGptLaunchUrl = useMemo(() => {
    return `https://chatgpt.com/?q=${encodeURIComponent(combinedPrompt)}`;
  }, [combinedPrompt]);

  return (
    <div className="space-y-6">
      {/* Intro & Value Chain */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Predefined ChatGPT & Claude Prompt Wrapper
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
            Prepend DrawScript grammar rules above any student question so free ChatGPT or Claude accounts output valid{' '}
            <code className="text-sky-300 font-mono">\(command ...\)</code> instructions ready for the Chrome Extension to render.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              onLoadIntoCanvas(SIMULATED_CHATGPT_REPLY, 'Simulated ChatGPT Reply')
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 text-amber-400" />
            Test Sample ChatGPT Reply
          </button>
        </div>
      </div>

      {/* Two-Column Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Question & Grammar Config */}
        <div className="lg:col-span-6 flex flex-col gap-5 bg-[#0F172A] border border-slate-800 rounded-xl p-5">
          <div>
            <label
              htmlFor="student-question"
              className="block text-sm font-semibold text-slate-100 mb-2"
            >
              1. Student Question
            </label>
            <textarea
              id="student-question"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything visual: Explain projectile motion, Pythagoras, 3D vectors..."
              className="w-full p-3 rounded-lg bg-[#030712] border border-slate-800 focus:border-sky-500 focus:outline-none text-sm text-slate-100 resize-none"
            />
            <div className="mt-2.5 flex flex-wrap gap-2">
              {SAMPLE_QUESTIONS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setQuestion(sample)}
                  className="text-left text-xs text-slate-400 hover:text-sky-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md px-2.5 py-1.5 transition-colors cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="system-grammar"
                className="text-sm font-semibold text-slate-100"
              >
                2. Predefined DrawScript Instructions
              </label>
              <button
                type="button"
                onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Restore Default
              </button>
            </div>
            <textarea
              id="system-grammar"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              spellCheck={false}
              className="flex-1 min-h-[260px] w-full p-3 rounded-lg bg-[#030712] border border-slate-800 focus:border-sky-500 focus:outline-none text-xs font-mono leading-relaxed text-slate-300 resize-none"
            />
          </div>
        </div>

        {/* Right: Final Wrapped Prompt Output + Launch Actions */}
        <div className="lg:col-span-6 flex flex-col bg-[#0F172A] border border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                3. Combined Prompt Sent to ChatGPT / Claude
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                {combinedPrompt.length} characters · Uses your own free or Plus account
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Prompt'}
              </button>

              <a
                href={chatGptLaunchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Open in ChatGPT
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <pre className="flex-1 p-4 rounded-lg bg-[#030712] border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap overflow-y-auto max-h-[430px] leading-relaxed">
            {combinedPrompt}
          </pre>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 leading-relaxed">
            Tip: Once the Chrome Extension is loaded, you do not even need to copy from here—just click{' '}
            <strong className="text-slate-200">+ Wrap DrawScript Prompt</strong> directly inside ChatGPT&apos;s message box, then click{' '}
            <strong className="text-slate-200">Play in DrawScript 3D</strong> on the reply.
          </div>
        </div>
      </div>
    </div>
  );
};
