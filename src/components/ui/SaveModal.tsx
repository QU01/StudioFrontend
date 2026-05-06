import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  title: string;
  descriptionLabel?: string;
  initialName?: string;
}

export function SaveModal({ isOpen, onClose, onSave, title, descriptionLabel = "Description", initialName = "" }: SaveModalProps) {
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDesc("");
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#161b22] border border-white/10 rounded-xl shadow-2xl overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-70" />
        
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white/90">{title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1 block">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0d1117]/80 text-white border border-white/10 rounded-lg py-2.5 px-3 outline-none focus:border-[#00f0ff]/50 transition-all text-sm placeholder:text-white/20"
              placeholder="E.g. My Awesome Project"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-1 block">
              {descriptionLabel} (Optional)
            </label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-[#0d1117]/80 text-white border border-white/10 rounded-lg py-2.5 px-3 outline-none focus:border-[#00f0ff]/50 transition-all text-sm placeholder:text-white/20 resize-none h-20"
              placeholder="Keep track of what this configuration does..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/5 bg-[#0d1117]/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-transparent"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim()) {
                onSave(name.trim(), desc.trim());
                onClose();
              }
            }}
            disabled={!name.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-[#00f0ff] to-[#0a58ca] text-white rounded-lg shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] disabled:opacity-50 transition-all border border-transparent"
          >
            <Save size={14} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}
