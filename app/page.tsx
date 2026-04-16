"use client";

import { useState, useRef } from "react";
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
  Code,
  MonitorPlay,
  CloudUpload,
  CloudDownload,
  LogIn,
  LogOut,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateVideoProject } from "@/lib/pollinations";
import { VideoProject, Scene } from "@/types";
import { cn } from "@/lib/utils";
import { auth, db } from "@/lib/firebase";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  Timestamp,
  doc,
  setDoc
} from "firebase/firestore";
import { useEffect } from "react";

export default function App() {
  const [story, setStory] = useState("");
  const [project, setProject] = useState<VideoProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("player");
  const [user, setUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [showInputOnMobile, setShowInputOnMobile] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
      setError("Login failed. Please try again.");
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSaveToCloud = async () => {
    if (!project || !user) return;
    
    const projectName = prompt("Enter a unique name for this project:");
    if (!projectName) return;

    setIsSaving(true);
    setError(null);

    try {
      // 1. Check if project name already exists
      const q = query(collection(db, "projects"), where("projectName", "==", projectName));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        throw new Error("Project name already exists. Please choose another.");
      }

      // 2. Upload images to Vercel Blob via our API
      const blobRes = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes: project.scenes, projectName }),
      });

      if (!blobRes.ok) throw new Error("Failed to upload images to cloud storage.");
      const { scenes: cloudScenes } = await blobRes.json();

      // 3. Save metadata to Firestore
      await addDoc(collection(db, "projects"), {
        projectName,
        story: project.story,
        visualAnchor: project.visual_anchor,
        seed: project.seed,
        scenes: cloudScenes,
        createdAt: serverTimestamp(),
        ownerUid: user.uid,
        imagesDeleted: false
      });

      alert("Project saved successfully to cloud!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadFromCloud = async () => {
    const projectName = prompt("Enter the project name to load:");
    if (!projectName) return;

    setIsLoadingCloud(true);
    setError(null);
    setIsExpired(false);

    try {
      const q = query(collection(db, "projects"), where("projectName", "==", projectName));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Project not found.");
      }

      const docData = querySnapshot.docs[0].data();
      const createdAt = (docData.createdAt as Timestamp).toDate();
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      const loadedProject: VideoProject = {
        project_title: docData.projectName,
        story: docData.story,
        visual_anchor: docData.visualAnchor,
        seed: docData.seed,
        total_scenes: docData.scenes.length,
        scenes: docData.scenes
      };

      if (diffDays >= 7) {
        setIsExpired(true);
        // Mark as deleted in DB if not already
        if (!docData.imagesDeleted) {
          await setDoc(doc(db, "projects", querySnapshot.docs[0].id), { imagesDeleted: true }, { merge: true });
        }
      }

      setProject(loadedProject);
      setCurrentSceneIndex(0);
      setActiveTab("player");
      setShowInputOnMobile(false);
      
      if (diffDays < 7) {
        await preloadAssets(loadedProject.scenes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setIsLoadingCloud(false);
    }
  };

  const preloadAssets = async (scenes: Scene[]) => {
    setIsBuffering(true);
    setBufferProgress(0);
    let loadedCount = 0;

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const loadWithRetry = async (url: string, type: 'image' | 'audio', retries = 3): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          if (type === 'image') {
            await new Promise((resolve, reject) => {
              const img = new Image();
              img.src = url;
              img.onload = resolve;
              img.onerror = reject;
            });
          } else {
            await new Promise((resolve, reject) => {
              const audio = new Audio();
              audio.src = url;
              audio.oncanplaythrough = resolve;
              audio.onerror = reject;
            });
          }
          return true;
        } catch (err) {
          if (i === retries - 1) return false;
          await delay(1000 * (i + 1)); // Exponential backoff
        }
      }
      return false;
    };

    for (const scene of scenes) {
      await loadWithRetry(scene.image_url, 'image');
      await loadWithRetry(scene.voiceover_audio_url, 'audio');
      loadedCount++;
      setBufferProgress(Math.round((loadedCount / scenes.length) * 100));
      await delay(200);
    }

    setIsBuffering(false);
  };

  const handleGenerate = async () => {
    if (!story.trim()) return;
    setIsGenerating(true);
    setIsBuffering(true);
    setBufferProgress(0);
    setError(null);
    setShowInputOnMobile(false);
    try {
      const result = await generateVideoProject(story);
      setProject(result);
      setCurrentSceneIndex(0);
      
      await preloadAssets(result.scenes);
      
      setIsPlaying(true);
      setActiveTab("player");
      setShowInputOnMobile(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate project");
      setIsBuffering(false);
      setShowInputOnMobile(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const nextScene = () => {
    if (!project) return;
    if (currentSceneIndex < project.scenes.length - 1) {
      setCurrentSceneIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const prevScene = () => {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex(prev => prev - 1);
    }
  };

  const currentScene = project?.scenes[currentSceneIndex];

  return (
    <div className="h-screen flex flex-col bg-bg-deep text-text-main font-sans overflow-hidden">
      {/* Header */}
      <header className="h-[60px] px-4 md:px-6 flex items-center justify-between border-b border-surface-accent bg-gradient-to-r from-surface to-bg-deep shrink-0">
        <div className="flex items-center gap-3">
          <img src="/Zyntros_logo.png" alt="Zyntros Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
          <h1 className="font-display font-extrabold text-xs md:text-sm tracking-[2px] uppercase text-primary">ZYNTROS</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-[10px] font-mono text-text-dim uppercase tracking-wider mr-4">
            ENGINE: <span className="text-primary">POLLINATIONS AI</span> &nbsp; | &nbsp; STATUS: <span className="text-[#00ff41]">READY</span>
          </div>
          
          <div className="flex items-center gap-2">
            {project && !showInputOnMobile && (
              <Button 
                onClick={() => setShowInputOnMobile(true)} 
                variant="ghost" 
                size="sm" 
                className="md:hidden text-primary text-[10px] uppercase tracking-widest"
              >
                <Sparkles className="w-3 h-3 mr-2" /> New
              </Button>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <div className="text-[10px] font-bold text-text-main leading-none">{user.displayName}</div>
                  <div className="text-[8px] text-text-dim leading-none mt-1 uppercase tracking-tighter">DIRECTOR</div>
                </div>
                <img src={user.photoURL || ""} alt="User" className="w-8 h-8 rounded-full border border-primary/30" />
                <Button variant="ghost" size="icon" onClick={handleLogout} className="text-text-dim hover:text-red-400">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={handleLogin} variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10 text-[10px] uppercase tracking-widest h-8">
                <LogIn className="w-3 h-3 mr-2" /> Login
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* TOP LEFT: Short Sidebar */}
        <aside className={cn(
          "w-full md:w-[320px] border-b md:border-b-0 md:border-r border-surface-accent bg-bg-deep p-4 md:p-6 flex flex-col gap-4 shrink-0 max-h-[40%] md:max-h-none transition-all duration-300",
          !showInputOnMobile && "hidden md:flex"
        )}>
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[1.5px] text-text-dim">Narrative Input</div>
            <Sparkles className="w-3 h-3 text-primary opacity-50" />
          </div>
          <Textarea
            placeholder="Enter your story narrative..."
            className="flex-1 bg-surface border-surface-accent border rounded-lg p-3 md:p-4 text-sm leading-relaxed resize-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all glow-primary"
            value={story}
            onChange={(e) => setStory(e.target.value)}
          />
          
          <div className="grid grid-cols-1 gap-2">
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || !story.trim()}
              className="bg-primary hover:bg-primary/80 text-bg-deep font-bold text-[12px] uppercase tracking-wider h-10 md:h-12 rounded shadow-[0_0_15px_var(--color-primary)] transition-all active:scale-95"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Initialize Engine"
              )}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={handleSaveToCloud}
                disabled={!project || !user || isSaving}
                variant="outline"
                className="border-surface-accent text-text-dim hover:text-primary hover:border-primary/50 text-[10px] uppercase tracking-widest h-10"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CloudUpload className="w-3 h-3 mr-2" /> Save</>}
              </Button>
              <Button 
                onClick={handleLoadFromCloud}
                disabled={isLoadingCloud}
                variant="outline"
                className="border-surface-accent text-text-dim hover:text-primary hover:border-primary/50 text-[10px] uppercase tracking-widest h-10"
              >
                {isLoadingCloud ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CloudDownload className="w-3 h-3 mr-2" /> Load</>}
              </Button>
            </div>
          </div>
          
          {error && <p className="text-red-500 text-[10px] font-mono bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}
        </aside>

        {/* TOP RIGHT: Main Stage */}
        <main className={cn(
          "flex-1 bg-[#08080a] relative overflow-hidden flex flex-col transition-all duration-300",
          showInputOnMobile && "hidden md:flex"
        )}>
          <div className="scan-line" />
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-6 py-3 border-b border-surface-accent flex items-center justify-between bg-surface/30">
              <TabsList className="bg-bg-deep border border-surface-accent">
                <TabsTrigger value="player" className="data-[state=active]:bg-primary data-[state=active]:text-bg-deep text-[10px] uppercase tracking-widest gap-2">
                  <MonitorPlay className="w-3 h-3" /> Master Preview
                </TabsTrigger>
                <TabsTrigger value="json" className="data-[state=active]:bg-primary data-[state=active]:text-bg-deep text-[10px] uppercase tracking-widest gap-2">
                  <Code className="w-3 h-3" /> JSON Blueprint
                </TabsTrigger>
              </TabsList>
              
              {project && (
                <div className="flex items-center gap-4">
                  <div className="text-[10px] font-mono text-text-dim">SEED: <span className="text-primary">{project.seed}</span></div>
                  <Button variant="ghost" size="sm" className="text-[10px] uppercase tracking-widest text-text-dim hover:text-primary" onClick={() => { setProject(null); setIsExpired(false); }}>
                    <RotateCcw className="w-3 h-3 mr-2" /> Reset
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 relative overflow-hidden">
              <TabsContent value="player" className="absolute inset-0 m-0 flex flex-col p-6">
                <div className="flex-1 relative rounded-xl border border-surface-accent bg-black overflow-hidden shadow-2xl group">
                  {isExpired && (
                    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-4 p-8 text-center">
                      <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-red-500 font-display font-bold uppercase tracking-widest">Project Images Deleted</h3>
                        <p className="text-text-dim text-xs max-w-xs mx-auto">
                          Cloud storage for this project has expired (7+ days). The narrative metadata is preserved, but visual assets have been purged.
                        </p>
                      </div>
                      <Button onClick={() => setIsExpired(false)} variant="outline" className="border-red-500/30 text-red-500 hover:bg-red-500/10 text-[10px] uppercase tracking-widest">
                        Dismiss Warning
                      </Button>
                    </div>
                  )}
                  {(isBuffering || isGenerating) && (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <img src="/Zyntros_logo.png" alt="Zyntros" className="w-12 h-12 absolute animate-pulse" referrerPolicy="no-referrer" />
                        <Loader2 className="w-20 h-20 text-primary animate-spin opacity-30" />
                        {isBuffering && (
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-primary mt-16">
                            {bufferProgress}%
                          </div>
                        )}
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-[10px] uppercase tracking-[3px] text-primary">
                          {isGenerating ? "Generating Narrative" : "NOT READY YET"}
                        </p>
                        <p className="text-[8px] font-mono text-text-dim">
                          {isGenerating ? "SYNTHESIZING_SCENES // AI_DIRECTOR_ACTIVE" : "BUFFERING_ASSETS // RETRYING_ON_LIMITS"}
                        </p>
                      </div>
                    </div>
                  )}
                  {project ? (
                    <>
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={currentSceneIndex}
                          src={currentScene?.image_url}
                          alt={currentScene?.image_description}
                          initial={{ opacity: 0, scale: 1.05 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="w-full h-full object-cover opacity-70"
                          referrerPolicy="no-referrer"
                        />
                      </AnimatePresence>
                      
                      <div className="absolute inset-0 flex flex-col justify-between p-8 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                        <div className="flex justify-between items-start">
                          <div className="px-3 py-1.5 bg-black/80 border border-primary text-primary text-[10px] rounded uppercase font-mono tracking-widest">
                            SCENE {currentScene?.scene_id} / {project.total_scenes}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:text-primary bg-black/40 backdrop-blur-md rounded-full" onClick={() => setIsPlaying(!isPlaying)}>
                              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-6">
                          <motion.p 
                            key={currentSceneIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-base md:text-xl font-serif italic text-text-main max-w-2xl leading-relaxed drop-shadow-lg"
                          >
                            "{currentScene?.voiceover_text}"
                          </motion.p>
                          
                          <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" className="text-text-dim hover:text-primary" onClick={prevScene} disabled={currentSceneIndex === 0}>
                              <ChevronLeft className="w-5 h-5" />
                            </Button>
                            <div className="flex-1 h-[2px] bg-surface-accent relative overflow-hidden rounded-full">
                              {isPlaying && (
                                <motion.div 
                                  className="absolute top-0 left-0 h-full bg-primary shadow-[0_0_10px_var(--color-primary)]"
                                  initial={{ width: 0 }}
                                  animate={{ width: "100%" }}
                                  key={currentSceneIndex}
                                  transition={{ 
                                    duration: currentScene?.duration_seconds || 3, 
                                    ease: "linear" 
                                  }}
                                />
                              )}
                            </div>
                            <Button variant="ghost" size="icon" className="text-text-dim hover:text-primary" onClick={nextScene} disabled={currentSceneIndex === project.total_scenes - 1}>
                              <ChevronRight className="w-5 h-5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-text-dim hover:text-primary" onClick={() => setIsMuted(!isMuted)}>
                              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-text-dim gap-6">
                      <div className="w-20 h-20 border-2 border-surface-accent rounded-full flex items-center justify-center animate-pulse">
                        <Film className="w-10 h-10 opacity-20" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-[12px] uppercase tracking-[4px] opacity-30">Awaiting Narrative Input</p>
                        <p className="text-[10px] font-mono opacity-20">SYSTEM_IDLE // STANDBY_MODE</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="json" className="absolute inset-0 m-0 p-6">
                <div className="h-full bg-surface/30 rounded-xl border border-surface-accent p-6 font-mono text-[12px] relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,64,255,0.05),transparent)] pointer-events-none" />
                  <ScrollArea className="h-full">
                    <pre className="whitespace-pre-wrap leading-relaxed">
                      {project ? JSON.stringify(project, null, 2).split('\n').map((line, i) => {
                        if (line.includes('":')) {
                          const [key, value] = line.split('":');
                          return (
                            <div key={i}>
                              <span className="json-key">{key}"</span>:
                              <span className={value.includes('"') ? 'json-string' : 'json-number'}>{value}</span>
                            </div>
                          );
                        }
                        return <div key={i} className="text-text-dim">{line}</div>;
                      }) : <div className="text-text-dim opacity-30 italic">// No project data generated yet...</div>}
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </main>
      </div>

      {/* BOTTOM: Timeline */}
      <footer className="h-[180px] md:h-[200px] bg-surface border-t border-surface-accent p-4 md:p-5 shrink-0 overflow-hidden">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="text-[10px] uppercase tracking-[1.5px] text-text-dim">Production Timeline</div>
          {project && <div className="hidden md:block text-[9px] font-mono text-text-dim uppercase">Visual Anchor: <span className="text-primary">{project.visual_anchor}</span></div>}
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4 flex-nowrap overflow-x-auto">
            {project ? (
              project.scenes.map((scene, idx) => (
                <button
                  key={scene.scene_id}
                  onClick={() => {
                    setCurrentSceneIndex(idx);
                    setIsPlaying(true);
                  }}
                  className={cn(
                    "min-w-[240px] bg-bg-deep rounded-lg border overflow-hidden transition-all text-left group relative",
                    currentSceneIndex === idx ? "border-primary ring-1 ring-primary/20" : "border-surface-accent hover:border-text-dim/30"
                  )}
                >
                  <div className="h-[100px] bg-[#111] relative overflow-hidden">
                    <img src={scene.image_url} className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" referrerPolicy="no-referrer" />
                    <div className="absolute top-2 left-2 bg-black/80 border border-primary text-primary text-[9px] px-2 py-0.5 rounded font-mono">#{scene.scene_id}</div>
                    {currentSceneIndex === idx && isPlaying && (
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-primary/20">
                        <motion.div 
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: "100%" }}
                          key={currentSceneIndex}
                          transition={{ duration: scene.duration_seconds || 3, ease: "linear" }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-surface/50">
                    <p className="text-[10px] text-text-dim line-clamp-2 italic leading-tight group-hover:text-text-main transition-colors">"{scene.voiceover_text}"</p>
                  </div>
                </button>
              ))
            ) : (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="min-w-[240px] bg-bg-deep rounded-lg border border-surface-accent h-[140px] flex flex-col opacity-10">
                  <div className="h-[100px] bg-[#111] flex items-center justify-center text-[10px]">[FRAME_WAIT]</div>
                  <div className="p-3 flex-1" />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </footer>

      {/* Global Audio Engine */}
      {currentScene && isPlaying && (
        <audio
          ref={audioRef}
          key={currentSceneIndex}
          src={currentScene.voiceover_audio_url}
          autoPlay
          muted={isMuted}
          crossOrigin="anonymous"
          playsInline
          onEnded={() => nextScene()}
          onError={() => {
            console.error("Audio playback error");
            setTimeout(nextScene, 3000);
          }}
        />
      )}
    </div>
  );
}
