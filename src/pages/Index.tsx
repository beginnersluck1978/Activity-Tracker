import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { Activity } from "@/types/activity";
import { Mic, MicOff, ExternalLink, Square, Loader2, Keyboard, ClockIcon, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { userConfig } from "@/config/userConfig";
import {
  fetchCurrentActivity,
  fetchRecentActivities,
  createActivity,
  endActivity,
  formatTimeDisplay,
  formatDateDisplay,
  isToday,
} from "@/lib/api";

const getBgUrl = () => {
  const img = userConfig.backgroundImage;
  if (img.startsWith("http://") || img.startsWith("https://")) return img;
  return `${import.meta.env.BASE_URL}${img}`;
};

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isListening, transcript, startListening, stopListening, resetTranscript, isSupported } =
    useSpeechRecognition();

  const [editableTranscript, setEditableTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const loadData = useCallback(async () => {
    try {
      const [current, recent] = await Promise.all([
        fetchCurrentActivity(),
        fetchRecentActivities(),
      ]);
      setCurrentActivity(current);
      // Recent list excludes the currently active one (it's shown in its own card)
      setRecentActivities(recent.filter((a) => !a.isActive && String(a.isActive) !== "true"));
    } catch {
      toast({
        title: "Failed to load",
        description: "Could not fetch activities. Check your API URL in userConfig.ts.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (transcript) {
      setEditableTranscript(transcript);
      setShowTranscript(true);
    }
  }, [transcript]);

  const handleNewActivity = () => {
    if (isIOS) {
      resetTranscript();
      setEditableTranscript("");
      setShowTranscript(true);
    } else if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setEditableTranscript("");
      setShowTranscript(false);
      startListening();
    }
  };

  const handleSend = async () => {
    if (!editableTranscript.trim()) return;
    setIsSending(true);
    try {
      const newActivity = await createActivity(editableTranscript);
      setCurrentActivity(newActivity);
      setShowTranscript(false);
      setEditableTranscript("");
      resetTranscript();
      toast({ title: "Activity logged", description: newActivity.activity });
      // Refresh the recent list in the background
      fetchRecentActivities()
        .then((recent) =>
          setRecentActivities(recent.filter((a) => !a.isActive && String(a.isActive) !== "true"))
        )
        .catch(() => {});
    } catch {
      toast({ title: "Send failed", description: "Could not save activity. Try again.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleEndActivity = async () => {
    if (!currentActivity) return;
    setIsEnding(true);
    try {
      await endActivity();
      setCurrentActivity(null);
      toast({ title: "Activity ended", description: "Marked as completed." });
      fetchRecentActivities()
        .then((recent) =>
          setRecentActivities(recent.filter((a) => !a.isActive && String(a.isActive) !== "true"))
        )
        .catch(() => {});
    } catch {
      toast({ title: "End failed", description: "Could not end activity. Try again.", variant: "destructive" });
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col px-4 py-6 max-w-md mx-auto select-none">
      {/* Background */}
      <div
        className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${getBgUrl()})` }}
      />
      <div className="fixed inset-0 -z-10 bg-background/75" />

      {/* Header */}
      <div className="w-full flex justify-between items-center mb-5">
        <span className="text-muted-foreground text-sm font-medium tracking-wide">
          {userConfig.displayName}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/history")}
            className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 text-sm border border-foreground/20 rounded-lg px-3 py-1.5"
            title="View & edit history"
          >
            <History className="w-3.5 h-3.5" />
            History
          </button>
          <a
            href={userConfig.sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 text-sm border border-foreground/20 rounded-lg px-3 py-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Sheet
          </a>
        </div>
      </div>

      {/* Currently Active Card */}
      <div className="w-full border border-foreground/20 rounded-xl p-4 bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : currentActivity ? (
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Currently Active
              </p>
              {/* Full text — no truncation */}
              <p className="text-foreground font-medium leading-snug">{currentActivity.activity}</p>
              {currentActivity.startTime && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <ClockIcon className="w-3 h-3" />
                  <span>Started {formatTimeDisplay(currentActivity.startTime)}</span>
                </div>
              )}
            </div>
            <Button
              variant="end"
              size="sm"
              onClick={handleEndActivity}
              disabled={isEnding}
              className="shrink-0 flex items-center gap-1.5 mt-0.5"
            >
              {isEnding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3 fill-current" />}
              End
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-1">No Activity Currently Active</p>
        )}
      </div>

      {/* Recent Completed Activities */}
      {!isLoading && recentActivities.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-1">Recent</p>
          <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-0.5">
            {recentActivities.map((activity) => (
              <div
                key={activity.recordId}
                className="border border-foreground/10 rounded-xl px-4 py-3 bg-card/80"
              >
                <p className="text-foreground text-sm leading-snug">{activity.activity}</p>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  {!isToday(activity.date) && (
                    <span className="text-primary/80">{formatDateDisplay(activity.date)}</span>
                  )}
                  {!isToday(activity.date) && <span>·</span>}
                  <span>
                    {formatTimeDisplay(activity.startTime)}
                    {activity.endTime && String(activity.endTime) !== "false" && String(activity.endTime) !== ""
                      ? ` – ${formatTimeDisplay(activity.endTime)}`
                      : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spacer pushes mic button toward bottom */}
      <div className="flex-1 min-h-6" />

      {/* Mic / New Activity Button */}
      <div className="flex flex-col items-center">
        <Button
          variant="record"
          size="round"
          onClick={handleNewActivity}
          disabled={!isIOS && !isSupported}
          className={isListening ? "animate-pulse" : ""}
        >
          <div className="flex flex-col items-center gap-2">
            {isIOS ? (
              <>
                <Keyboard className="w-8 h-8" />
                <span className="text-xs">New Activity</span>
              </>
            ) : isListening ? (
              <>
                <MicOff className="w-8 h-8" />
                <span className="text-xs">Stop</span>
              </>
            ) : (
              <>
                <Mic className="w-8 h-8" />
                <span className="text-xs">New Activity</span>
              </>
            )}
          </div>
        </Button>

        {!isIOS && !isSupported && (
          <p className="text-destructive text-xs mt-3 text-center">
            Voice recognition not supported in this browser.
            <br />
            Try Safari or Chrome on iPhone.
          </p>
        )}

        {/* Transcript input area */}
        {showTranscript && (
          <div className="w-full mt-6 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {isIOS && (
              <p className="text-muted-foreground text-xs text-center">
                Tap the keyboard mic to dictate
              </p>
            )}
            <textarea
              value={editableTranscript}
              onChange={(e) => setEditableTranscript(e.target.value)}
              className="w-full bg-card border border-foreground/20 rounded-xl p-4 text-foreground text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[80px]"
              placeholder="Type or dictate your activity..."
              autoFocus
            />
            <Button
              variant="action"
              className="w-full h-12 text-base font-semibold"
              onClick={handleSend}
              disabled={!editableTranscript.trim() || isSending}
            >
              {isSending ? "Sending..." : "Send"}
            </Button>
          </div>
        )}
      </div>

      <div className="h-6" />
    </div>
  );
};

export default Index;
