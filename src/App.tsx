/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  Film, 
  Sparkles,
  Volume2,
  VolumeX,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateVideoProject } from "./lib/gemini";
import { VideoProject, Scene } from "./types";
import { cn } from "@/lib/utils";

export default function App() {
  const [story, setStory] = useState("");
  const [project, setProject] = useState<VideoProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleGenerate = async () => {
    if (!story.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateVideoProject(story);
      setProject(result);
      setCurrentSceneIndex(0);
      setIsPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate project");
    } finally {
      setIsGenerating(false);
    }
  };

  const nextScene = () => {
    if (!project) return;
    if (currentSceneIndex < project.scenes.length - 1) {
      setCurrentSceneIndex(prev => prev + 1);
      setProgress(0);
    } else {
      setIsPlaying(false);
      setProgress(100);
    }
  };

  const prevScene = () => {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (isPlaying && project) {
      const duration = project.scenes[currentSceneIndex].duration_seconds * 1000;
      const interval = 50;
      const step = (interval / duration) * 100;

      timerRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(timerRef.current!);
            nextScene();
            return 100;
          }
          return prev + step;
        });
      }, interval);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [isPlaying, currentSceneIndex, project]);

  const currentScene = project?.scenes[currentSceneIndex];

  return (
    <div className="h-screen flex flex-col bg-bg-deep text-text-main font-sans overflow-hidden">
      {/* Header */}
      <header className="h-[60px] px-6 flex items-center justify-between border-b border-surface-accent bg-gradient-to-r from-surface to-bg-deep shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative w-6 h-6 border-2 border-primary rounded-[4px] after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-2 after:h-2 after:bg-primary after:shadow-[0_0_10px_var(--color-primary)]" />
          <h1 className="font-display font-extrabold text-sm tracking-[2px] uppercase text-primary">XANTRAIL VIDEO ENGINE</h1>
        </div>
        <div className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
          PROJECT_ID: <span className="text-primary">XVE-409-NEON</span> &nbsp; | &nbsp; STATUS: <span className="text-[#00ff41]">ENGINE READY</span>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[320px_1fr] gap-[1px] bg-surface-accent overflow-hidden">
        {/* Left Pane: Input */}
        <section className="bg-bg-deep p-6 flex flex-col gap-4 overflow-hidden">
          <div className="text-[10px] uppercase tracking-[1.5px] text-text-dim">Source Narrative</div>
          <Textarea
            placeholder="Enter your story here..."
            className="flex-1 bg-surface border-surface-accent border rounded-lg p-4 text-sm leading-relaxed resize-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all glow-primary"
            value={story}
            onChange={(e) => setStory(e.target.value)}
          />
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !story.trim()}
            className="bg-primary hover:bg-primary/80 text-bg-deep font-bold text-[12px] uppercase tracking-wider h-10 rounded shadow-[0_0_15px_var(--color-primary)] transition-all active:scale-95"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Generate JSON Script"
            )}
          </Button>
          {error && <p className="text-red-500 text-[10px] font-mono">{error}</p>}
        </section>

        {/* Right Pane: Output/Player */}
        <section className="bg-[#08080a] flex flex-col relative overflow-hidden">
          <div className="scan-line" />
          <div className="p-4 flex flex-col h-full overflow-hidden">
            <div className="text-[10px] uppercase tracking-[1.5px] text-text-dim mb-4">Engine Output (JSON)</div>
            
            <div className="flex-1 grid grid-rows-2 gap-4 overflow-hidden">
              {/* JSON View */}
              <div className="bg-surface/30 rounded-lg border border-surface-accent p-4 font-mono text-[11px] overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,64,255,0.05),transparent)] pointer-events-none" />
                <ScrollArea className="h-full">
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    <span className="text-text-dim">{"{"}</span>{"\n"}
                    {"  "}<span className="json-key">"project_title"</span>: <span className="json-string">"{project?.project_title || "Untitled"}"</span>,{"\n"}
                    {"  "}<span className="json-key">"total_scenes"</span>: <span className="json-number">{project?.total_scenes || 0}</span>,{"\n"}
                    {"  "}<span className="json-key">"scenes"</span>: <span className="text-text-dim">[</span>{"\n"}
                    {project?.scenes.slice(0, 2).map((scene, i) => (
                      <span key={i}>
                        {"    "}<span className="text-text-dim">{"{"}</span>{"\n"}
                        {"      "}<span className="json-key">"scene_id"</span>: <span className="json-number">{scene.scene_id}</span>,{"\n"}
                        {"      "}<span className="json-key">"image_description"</span>: <span className="json-string">"{scene.image_description.substring(0, 40)}..."</span>,{"\n"}
                        {"      "}<span className="json-key">"voiceover_text"</span>: <span className="json-string">"{scene.voiceover_text}"</span>,{"\n"}
                        {"      "}<span className="json-key">"duration_seconds"</span>: <span className="json-number">3</span>{"\n"}
                        {"    "}<span className="text-text-dim">{"}"}</span>{i === 0 ? "," : ""}{"\n"}
                      </span>
                    ))}
                    {project && project.scenes.length > 2 && <span className="text-text-dim">    ...</span>}
                    {"  "}<span className="text-text-dim">]</span>{"\n"}
                    <span className="text-text-dim">{"}"}</span>
                  </pre>
                </ScrollArea>
              </div>

              {/* Player View */}
              <div className="relative rounded-lg border border-surface-accent bg-black overflow-hidden group">
                {project ? (
                  <>
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={currentSceneIndex}
                        src={currentScene?.image_url}
                        alt={currentScene?.image_description}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.6 }}
                        exit={{ opacity: 0 }}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </AnimatePresence>
                    <div className="absolute inset-0 flex flex-col justify-between p-6">
                      <div className="flex justify-between items-start">
                        <div className="px-2 py-1 bg-black/80 border border-primary text-primary text-[9px] rounded uppercase">Scene {currentScene?.scene_id}</div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-text-dim hover:text-primary" onClick={() => setIsPlaying(!isPlaying)}>
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-text-dim hover:text-primary" onClick={() => setProject(null)}>
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <p className="text-sm font-serif italic text-text-main max-w-xl leading-relaxed">
                          "{currentScene?.voiceover_text}"
                        </p>
                        <div className="h-[2px] w-full bg-surface-accent relative overflow-hidden">
                          <motion.div 
                            className="absolute top-0 left-0 h-full bg-primary shadow-[0_0_10px_var(--color-primary)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.05, ease: "linear" }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-text-dim gap-4">
                    <Film className="w-12 h-12 opacity-10" />
                    <p className="text-[10px] uppercase tracking-widest opacity-30">Awaiting Narrative Input</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer: Timeline */}
      <footer className="h-[220px] bg-surface border-t border-surface-accent p-5 shrink-0 overflow-hidden">
        <div className="text-[10px] uppercase tracking-[1.5px] text-text-dim mb-4">Production Pipeline Preview</div>
        <ScrollArea className="w-full">
          <div className="flex gap-5 pb-4">
            {project ? (
              project.scenes.map((scene, idx) => (
                <button
                  key={scene.scene_id}
                  onClick={() => {
                    setCurrentSceneIndex(idx);
                    setProgress(0);
                    setIsPlaying(true);
                  }}
                  className={cn(
                    "min-w-[200px] bg-bg-deep rounded-md border overflow-hidden transition-all text-left",
                    currentSceneIndex === idx ? "border-primary" : "border-surface-accent"
                  )}
                >
                  <div className="h-[100px] bg-[#111] relative">
                    <img src={scene.image_url} className="w-full h-full object-cover opacity-60" referrerPolicy="no-referrer" />
                    <div className="absolute top-2 left-2 bg-black/80 border border-primary text-primary text-[9px] px-1.5 py-0.5 rounded">SCENE {scene.scene_id}</div>
                    {currentSceneIndex === idx && (
                      <div className="absolute bottom-0 left-0 h-[3px] bg-primary" style={{ width: `${progress}%` }} />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[11px] text-text-dim line-clamp-2 italic leading-tight">"{scene.voiceover_text}"</p>
                  </div>
                </button>
              ))
            ) : (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="min-w-[200px] bg-bg-deep rounded-md border border-surface-accent h-[150px] flex flex-col opacity-20">
                  <div className="h-[100px] bg-[#111] flex items-center justify-center text-[10px] text-zinc-800">[FRAME_DATA]</div>
                  <div className="p-3 bg-bg-deep flex-1" />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </footer>

      {/* Global Audio */}
      {currentScene && isPlaying && (
        <audio
          ref={audioRef}
          src={currentScene.voiceover_audio_url}
          autoPlay
          muted={isMuted}
          onEnded={() => {}}
        />
      )}
    </div>
  );
}
