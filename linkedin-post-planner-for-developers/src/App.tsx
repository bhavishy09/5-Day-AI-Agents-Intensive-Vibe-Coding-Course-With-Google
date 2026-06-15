import React, { useState, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Plus,
  X,
  Share2,
  ThumbsUp,
  MessageSquare,
  Repeat2,
  FileText,
  MousePointerClick,
  Info,
  ChevronRight,
  TrendingUp,
  Cpu,
  BookmarkCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types
interface PostStrategy {
  postDraft: string;
  hookAlternatives: string[];
  hashtags: string[];
}

interface ExampleProject {
  id: string;
  projectName: string;
  projectDescription: string;
  techStack: string;
  problemSolved: string;
  keyLearning: string;
  linkUrl: string;
  tone: string;
  tagline: string;
}

const EXAMPLES: ExampleProject[] = [
  {
    id: "yt-sentiment",
    projectName: "YouTube Comments Sentiment Analyzer",
    projectDescription: "Takes any YouTube video URL, grabs the comments, runs them through an classification classifier, and compiles a clean diagnostic dashboard. Summarizes overall trends smoothly using the Gemini API.",
    techStack: "Python, Flask, Gemini API, NLTK, Tailwind CSS, Recharts",
    problemSolved: "Manually combing through thousands of YouTube comments to understand developer feedback, software bugs, or content reception takes literally hours and is extremely tedious.",
    keyLearning: "Using an ML classifier handles categorical indexing brilliantly, but relying on Gemini to distill complex qualitative feedback into a human-readable action plan is where the true value lies.",
    linkUrl: "https://yt-sentiment-dashboard.app",
    tone: "conversational",
    tagline: "YouTube Sentiment Analyzer",
  },
  {
    id: "fitness-tracker",
    projectName: "FitTrack Pro",
    projectDescription: "A client-first wellness dashboard that tracks macro-nutrition indexes and logs progressive overload metrics across fitness regimens effortlessly with offline support.",
    techStack: "React, Tailwind CSS, TypeScript, IndexedDB, Lucide Icons",
    problemSolved: "Traditional fitness apps are bloated with ads, signups, paywalls, and complicated setup flows just to log a single workout set or meal.",
    keyLearning: "Optimizing database queries around IndexedDB for offline workout synchronization taught me a lot about browser state machines and transactional consistency.",
    linkUrl: "https://fittrack-easy.io",
    tone: "humble",
    tagline: "Fitness & Nutrition Tracker",
  },
  {
    id: "rust-cli",
    projectName: "TreeVis CLI",
    projectDescription: "A lightning-fast command line interface tool that scans nesting paths and automatically generates styled directory visualizer exports with size and extension heatmaps.",
    techStack: "Rust, clap, colored, serde, cargo-build",
    problemSolved: "Configuring ignore files and debugging messy mono-repo layouts visually from the native terminal is challenging without slow, heavy visual tools.",
    keyLearning: "Memory footprint matters. Rewriting raw recursive tree traversals with iterative stack-allocated processing dropped execution time down from several seconds to mere milliseconds.",
    linkUrl: "https://crates.io/crates/treevis-cli",
    tone: "nerdy",
    tagline: "Rust CLI Visualizer",
  }
];

export default function App() {
  // Use user's YouTube Sentiment example as the default state on mount!
  const [formData, setFormData] = useState({
    projectName: EXAMPLES[0].projectName,
    projectDescription: EXAMPLES[0].projectDescription,
    techStack: EXAMPLES[0].techStack,
    problemSolved: EXAMPLES[0].problemSolved,
    keyLearning: EXAMPLES[0].keyLearning,
    linkUrl: EXAMPLES[0].linkUrl,
    tone: EXAMPLES[0].tone,
  });

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [strategy, setStrategy] = useState<PostStrategy | null>(null);
  const [editedDraft, setEditedDraft] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState("");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [refining, setRefining] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [likeCount, setLikeCount] = useState(14);
  const [liked, setLiked] = useState(false);

  const loadingMessages = [
    "Analyzing project parameters...",
    "Drafting authentic hook alternatives...",
    "Injecting credible technical context...",
    "Polishing structured builder story...",
    "Formatting clean human-to-human layout..."
  ];

  // Rotate loading messages while generation is taking place
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 1500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const loadExample = (ex: ExampleProject) => {
    setFormData({
      projectName: ex.projectName,
      projectDescription: ex.projectDescription,
      techStack: ex.techStack,
      problemSolved: ex.problemSolved,
      keyLearning: ex.keyLearning,
      linkUrl: ex.linkUrl,
      tone: ex.tone,
    });
    // Clear old state
    setErrorMessage("");
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setStrategy(null);

    try {
      const response = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate strategy");
      }

      const data: PostStrategy = await response.json();
      setStrategy(data);
      setEditedDraft(data.postDraft);
      setHashtags(data.hashtags || []);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!refinePrompt.trim()) return;
    setRefining(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/refine-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentDraft: editedDraft,
          revisionPrompt: refinePrompt,
          projectName: formData.projectName,
          techStack: formData.techStack,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to refine draft");
      }

      const data: PostStrategy = await response.json();
      setEditedDraft(data.postDraft);
      if (data.hashtags && data.hashtags.length > 0) {
        setHashtags(data.hashtags);
      }
      setRefinePrompt("");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to refine post draft.");
    } finally {
      setRefining(false);
    }
  };

  // Swaps a specific hook into the draft.
  // We search for the first paragraph in the current draft and swap it out.
  const handleSwapHook = (newHook: string) => {
    if (!editedDraft) return;

    // A paragraph break is usually a double newline. Let's find index of double newline
    // Or single newline if double isn't present
    const doubleNewlineIndex = editedDraft.indexOf("\n\n");
    const singleNewlineIndex = editedDraft.indexOf("\n");
    
    let remainder = "";
    if (doubleNewlineIndex !== -1) {
      remainder = editedDraft.slice(doubleNewlineIndex);
    } else if (singleNewlineIndex !== -1) {
      remainder = editedDraft.slice(singleNewlineIndex);
    } else {
      // It's all just one block
      remainder = "";
    }

    // Clean up hook spacing
    const parsedHook = newHook.trim();
    // Rebuild draft
    setEditedDraft(`${parsedHook}${remainder}`);
  };

  const handleAddHashtag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = newHashtag.trim().replace(/^#/, "");
    if (cleanTag && !hashtags.includes(cleanTag)) {
      setHashtags((prev) => [...prev, cleanTag]);
      setNewHashtag("");
    }
  };

  const handleRemoveHashtag = (tagToRemove: string) => {
    setHashtags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const getFullPostTextForCopy = () => {
    if (!editedDraft) return "";
    const tagsText = hashtags.map((t) => `#${t}`).join(" ");
    return `${editedDraft}\n\n${tagsText}`;
  };

  const handleCopyClipboard = () => {
    const fullText = getFullPostTextForCopy();
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Premium Builder Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-semibold shadow-md shadow-indigo-100">
              <Sparkles className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <span className="font-display font-semibold text-lg text-slate-900 block tracking-tight">
                Authentic Link strategist
              </span>
              <span className="text-[11px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase font-medium">
                Builder-To-Builder Model
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Cpu className="w-3.5 h-3.5 text-slate-400 rotate-12" />
            <span>Engined by Gemini 3.5 Flash</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: BUILDER DIALOGUE PANELS (5-Span) */}
          <section className="lg:col-span-5 space-y-6">
            
            {/* Quick Examples Selection */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 uppercase tracking-wider mb-3">
                <BookmarkCheck className="w-4 h-4 text-indigo-500" />
                <span>Pre-fill Project Context</span>
              </div>
              <h2 className="font-display font-semibold text-base text-slate-900 mb-3">
                Select an example to see it in action
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {EXAMPLES.map((ex) => {
                  const isCurrent = formData.projectName === ex.projectName;
                  return (
                    <button
                      key={ex.id}
                      onClick={() => loadExample(ex)}
                      className={`text-left p-3 rounded-xl border text-xs transition-all flex justify-between items-center ${
                        isCurrent
                          ? "bg-indigo-50/70 border-indigo-200 text-indigo-900 font-medium scale-[1.01]"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold block">{ex.tagline}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[280px]">
                          {ex.techStack}
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isCurrent ? "text-indigo-600 translate-x-1" : "text-slate-400"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Interactive Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <FileText className="w-5 h-5 text-indigo-500" />
                <h2 className="font-display font-semibold text-lg text-slate-900">
                  Project Details
                </h2>
              </div>

              <form onSubmit={handleGenerate} className="space-y-4">
                
                {/* Project Name */}
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    name="projectName"
                    value={formData.projectName}
                    onChange={handleInputChange}
                    placeholder="e.g. YouTube Sentiment Analyzer"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors placeholder:text-slate-400"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    What does it do? / Description *
                  </label>
                  <textarea
                    name="projectDescription"
                    value={formData.projectDescription}
                    onChange={handleInputChange}
                    placeholder="Describe how it works and what the core system looks like..."
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors placeholder:text-slate-400 resize-none"
                    required
                  />
                </div>

                {/* Tech Stack */}
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Tech Stack utilized
                  </label>
                  <input
                    type="text"
                    name="techStack"
                    value={formData.techStack}
                    onChange={handleInputChange}
                    placeholder="e.g. Flask, Python, Gemini API"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors placeholder:text-slate-400"
                  />
                </div>

                {/* Relatable problem solved */}
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    The relatable problem it solves
                  </label>
                  <textarea
                    name="problemSolved"
                    value={formData.problemSolved}
                    onChange={handleInputChange}
                    placeholder="What friction exists that led you to build this? Make it specific."
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors placeholder:text-slate-400 resize-none"
                  />
                </div>

                {/* Learnings */}
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    The key engineering learning / takeaway
                  </label>
                  <textarea
                    name="keyLearning"
                    value={formData.keyLearning}
                    onChange={handleInputChange}
                    placeholder="What technical discovery or trade-off did you gain from this build?"
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors placeholder:text-slate-400 resize-none"
                  />
                </div>

                {/* Link URL */}
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Live link / Deployment URL
                  </label>
                  <input
                    type="url"
                    name="linkUrl"
                    value={formData.linkUrl}
                    onChange={handleInputChange}
                    placeholder="https://myproject.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors placeholder:text-slate-400"
                  />
                </div>

                {/* Tone Selectors */}
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Visual Persona / Tone
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "conversational", icon: "🤝", label: "Conversational", desc: "Human, friendly, direct" },
                      { id: "nerdy", icon: "🤓", label: "Technical", desc: "Depth & architectures" },
                      { id: "hot-take", icon: "🔥", label: "The Hot-Take", desc: "Spicy industry view" },
                      { id: "humble", icon: "🙏", label: "Humble Learner", desc: "Lessons & mistakes first" },
                      { id: "minimal", icon: "⚡", label: "Minimalist", desc: "Punchy, spacious, raw" },
                    ].map((t) => {
                      const active = formData.tone === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, tone: t.id }))}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            active
                              ? "bg-slate-900 border-slate-900 text-white scale-[1.01] shadow-sm"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center space-x-1.5 font-semibold text-xs mb-0.5">
                            <span>{t.icon}</span>
                            <span>{t.label}</span>
                          </div>
                          <span className={`text-[10px] block leading-normal ${active ? "text-slate-350" : "text-slate-500"}`}>
                            {t.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all shadow-md shadow-indigo-100 disabled:opacity-50 text-sm flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>{loadingMessages[loadingStep]}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-indigo-200" />
                      <span>Generate Anti-Cringe Post</span>
                    </>
                  )}
                </button>
              </form>
            </div>
            
            {/* Error Message rendering if any API fails */}
            {errorMessage && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start space-x-2">
                <Info className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

          </section>

          {/* RIGHT COLUMN: PREVIEW & INTERACTION PANEL (7-Span) */}
          <section className="lg:col-span-7 space-y-6">
            
            {/* Conditional Render State */}
            {!strategy && !loading ? (
              // Empty/First state placeholder
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs flex flex-col items-center justify-center min-h-[450px]">
                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4 animate-pulse">
                  <TrendingUp className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="font-display font-semibold text-lg text-slate-800 mb-1">
                  Ready to draft your LinkedIn Post?
                </h3>
                <p className="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
                  Provide your builder achievements on the left panel, choose a tone vibe, and click 'Generate'. 
                  We'll output a stunningly credible, structured text strategy.
                </p>
                <button
                  onClick={() => handleGenerate()}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors flex items-center space-x-2 group"
                >
                  <MousePointerClick className="w-3.5 h-3.5 text-slate-500 group-hover:scale-110 transition-transform" />
                  <span>Execute strategy with currently filled details</span>
                </button>
              </div>
            ) : loading ? (
              // Loading Transition view
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs min-h-[450px] flex flex-col justify-center items-center space-y-5">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                  <Sparkles className="w-6 h-6 text-indigo-500 absolute top-5 left-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display font-semibold text-lg text-slate-800">
                    Content Strategist is writing...
                  </h3>
                  <p className="text-xs font-mono text-slate-400">
                    {loadingMessages[loadingStep]}
                  </p>
                </div>
                <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 text-xs text-slate-500 text-left max-w-md italic shadow-inner">
                  "No 'delighted to announce', no rocket emojis, no cringe corporate speak. Just raw, credible builder updates."
                </div>
              </div>
            ) : (
              // The Post Dashboard Strategy Output
              <div className="space-y-6">
                
                {/* 1. Real-Looking interactive LinkedIn Feed Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  
                  {/* Card Premium Bar Header info */}
                  <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest block">
                      Preview: LinkedIn Feed Placement
                    </span>
                    <button
                      onClick={handleCopyClipboard}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                        hasCopied
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                      }`}
                    >
                      {hasCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied perfectly!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-indigo-100" />
                          <span>Copy Clean Post</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Native LinkedIn Layout representation */}
                  <div className="p-6 space-y-4">
                    
                    {/* User profile header spacer */}
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 ring-2 ring-indigo-50 flex items-center justify-center font-bold text-white text-sm">
                        ME
                      </div>
                      <div className="leading-tight">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-sm font-semibold text-slate-900">You (Builder)</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono font-medium">Author</span>
                        </div>
                        <span className="text-xs text-slate-500 block truncate max-w-[400px]">
                          Software Engineer | {formData.techStack || "Builder of cool tech"}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Just now • 🌐 Edited
                        </span>
                      </div>
                    </div>

                    {/* Interactive Text Area letting user tweak output manually */}
                    <div className="relative group">
                      <textarea
                        value={editedDraft}
                        onChange={(e) => setEditedDraft(e.target.value)}
                        rows={12}
                        className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-[13.5px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors placeholder:text-slate-400 focus:bg-white"
                        placeholder="Polished LinkedIn post content drafts here..."
                      />
                      <div className="text-[10px] font-mono text-slate-400 absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                        <span>⌨️ Live Edit Any Word Directly</span>
                      </div>
                    </div>

                    {/* Styled Interactive Hashtags Output Block inside the feed */}
                    <div className="space-y-1 bg-slate-50/40 p-4 rounded-xl border border-dashed border-slate-200">
                      <span className="text-[10px] font-mono text-slate-400 block mb-1 uppercase tracking-wider">
                        Active Tags in Post:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {hashtags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100/70"
                          >
                            #{tag}
                            <button
                              onClick={() => handleRemoveHashtag(tag)}
                              className="ml-1 text-indigo-400 hover:text-indigo-600 transition-colors shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {hashtags.length === 0 && (
                          <span className="text-xs text-slate-400 italic">No hashtags added yet.</span>
                        )}
                      </div>
                    </div>

                    {/* Interactive Simulator Bar to make it feel like LinkedIn */}
                    <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
                      <div className="flex items-center space-x-2">
                        <div className="h-4 w-4 rounded-full bg-indigo-100 flex items-center justify-center">
                          <ThumbsUp className="w-2.5 h-2.5 text-indigo-600 fill-indigo-600" />
                        </div>
                        <span className="text-[11px] font-mono">{liked ? likeCount + 1 : likeCount} organic likes</span>
                      </div>
                      <span className="text-[11px] font-mono">3 reposts • 2 comments</span>
                    </div>

                    {/* Simulation buttons */}
                    <div className="border-t border-slate-100 pt-3 grid grid-cols-4 gap-1">
                      <button
                        onClick={() => setLiked(!liked)}
                        className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
                          liked ? "text-indigo-600 bg-indigo-50" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <ThumbsUp className={`w-4 h-4 ${liked ? "fill-indigo-600" : ""}`} />
                        <span>Like</span>
                      </button>
                      <button className="py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center space-x-1.5">
                        <MessageSquare className="w-4 h-4" />
                        <span>Comment</span>
                      </button>
                      <button className="py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center space-x-1.5">
                        <Repeat2 className="w-4 h-4" />
                        <span>Repost</span>
                      </button>
                      <button className="py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center space-x-1.5">
                        <Share2 className="w-4 h-4" />
                        <span>Send</span>
                      </button>
                    </div>

                  </div>
                </div>

                {/* 2. Interactive Hooks Swapping Panel */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 text-indigo-500" />
                      <h3 className="font-display font-semibold text-base text-slate-900">
                        Hook Alternatives Selector
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase font-bold">
                      Swap into Draft
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    The strategist created 3 diverse opening patterns. Click any line below to instantly hot-swap it with the very first paragraph of your post draft above.
                  </p>
                  
                  <div className="grid grid-cols-1 gap-2.5">
                    {strategy.hookAlternatives?.map((hook, index) => (
                      <div
                        key={index}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors text-xs text-slate-700 leading-relaxed flex items-start justify-between space-x-3 group/hook"
                      >
                        <div className="space-y-1">
                          <span className="inline-block text-[10px] font-mono font-bold bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded mb-1">
                            Option {index + 1}
                          </span>
                          <p className="font-medium text-slate-800 italic">"{hook}"</p>
                        </div>
                        <button
                          onClick={() => handleSwapHook(hook)}
                          className="shrink-0 text-[10px] font-mono font-bold font-semibold bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100/50 transition-all shadow-xs"
                        >
                          + Swap In
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Refinement Dialogue & Hashtag Adder */}
                <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <h3 className="font-display font-semibold text-base">
                      AI Co-Writing & Refining
                    </h3>
                  </div>
                  <p className="text-xs text-slate-350">
                    Not fully satisfied with specific framing? Enter quick interactive editing comments (e.g., 
                    <em>"make the opening sentence even more humble"</em>, 
                    <em>"condense the whole post into 100 words"</em>, 
                    or <em>"sound conversational but extremely urgent"</em>).
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1.5">
                    
                    {/* Refinement input */}
                    <div className="md:col-span-8 flex space-x-2">
                      <input
                        type="text"
                        value={refinePrompt}
                        onChange={(e) => setRefinePrompt(e.target.value)}
                        placeholder="e.g., Make it run slightly shorter and and more casual..."
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-850 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !refining) {
                            handleRefine();
                          }
                        }}
                      />
                      <button
                        onClick={handleRefine}
                        disabled={refining || !refinePrompt.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-xs font-semibold px-4 py-2 rounded-xl transition-all text-white shrink-0 flex items-center space-x-1"
                      >
                        {refining ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>Refine</span>
                        )}
                      </button>
                    </div>

                    {/* Hashtag adder */}
                    <div className="md:col-span-4">
                      <form onSubmit={handleAddHashtag} className="flex space-x-1.5">
                        <input
                          type="text"
                          value={newHashtag}
                          onChange={(e) => setNewHashtag(e.target.value)}
                          placeholder="Add custom hashtag..."
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-850 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                        <button
                          type="submit"
                          className="bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 px-3 py-2 rounded-xl transition-all shrink-0 border border-slate-700 flex items-center justify-center font-bold"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </form>
                    </div>

                  </div>
                </div>

              </div>
            )}

          </section>

        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-16 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 Developer LinkedIn Post Planner. Built for programmers who hate writing cringey corporate announcements.</p>
        </div>
      </footer>
    </div>
  );
}
